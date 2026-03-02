"""
Voice Authentication API routes.
Handles enrollment (3 samples) and delivery verification flows.
"""
import uuid
import random
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.models.voice_auth import (
    VoiceEnrollment,
    VoiceEnrollmentSample,
    VoiceProfile,
    VoiceVerification,
)
from app.models.shipment import Shipment
from app.schemas.voice_auth import (
    EnrollmentStartResponse,
    EnrollmentSampleResponse,
    EnrollmentStatusResponse,
    VerificationStartRequest,
    VerificationStartResponse,
    VerificationSubmitResponse,
    VerificationStatusResponse,
)
from app.services.auth import get_current_user
from app.services.voice_pipeline import analyze_voice_sample
from app.services.replay_guard import replay_guard
from app.services.speaker_encoder import (
    extract_speaker_embedding,
    extract_full_voiceprint,
    compare_enrollment_samples,
    verify_speaker,
    centroid,
    build_enriched_profile,
    SPEAKER_EMBEDDING_DIM,
    MFCC_FEATURE_DIM,
)
from app.services.audio_utils import validate_upload
from app.services.voice_config import (
    ENROLLMENT_REQUIRED_SAMPLES,
    ENROLLMENT_TTL_SECONDS,
    VERIFICATION_TTL_SECONDS,
    CHALLENGE_PHRASES,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice-auth", tags=["Voice Authentication"])


# ═══════════════════════════════════════════════════════════════
#  ENROLLMENT ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@router.get("/enrollment/status", response_model=EnrollmentStatusResponse)
def get_enrollment_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check if the current customer is enrolled for voice auth."""
    if current_user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=403, detail="Only customers can enroll for voice auth")

    # Check if already has a voice profile
    profile = db.query(VoiceProfile).filter(VoiceProfile.user_id == current_user.id).first()
    if profile and profile.is_active:
        return {
            "enrolled": True,
            "status": "completed",
            "verified_samples": profile.sample_count,
            "required_samples": ENROLLMENT_REQUIRED_SAMPLES,
            "enrollment_id": None,
        }

    # Check for active enrollment session
    enrollment = (
        db.query(VoiceEnrollment)
        .filter(
            VoiceEnrollment.user_id == current_user.id,
            VoiceEnrollment.status == "pending",
            VoiceEnrollment.expires_at > datetime.utcnow(),
        )
        .first()
    )
    if enrollment:
        return {
            "enrolled": False,
            "status": "pending",
            "verified_samples": enrollment.verified_samples,
            "required_samples": enrollment.required_samples,
            "enrollment_id": enrollment.enrollment_id,
        }

    return {
        "enrolled": False,
        "status": None,
        "verified_samples": 0,
        "required_samples": ENROLLMENT_REQUIRED_SAMPLES,
        "enrollment_id": None,
    }


@router.delete("/enrollment/reset")
def reset_voice_enrollment(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deactivate the current voice profile so the customer can re-enroll."""
    if current_user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=403, detail="Only customers can reset voice enrollment")

    profile = db.query(VoiceProfile).filter(
        VoiceProfile.user_id == current_user.id,
        VoiceProfile.is_active == True,
    ).first()
    if not profile:
        raise HTTPException(status_code=400, detail="No active voice profile found")

    profile.is_active = False
    current_user.voice_enrolled = False

    # Cancel any pending enrollments
    db.query(VoiceEnrollment).filter(
        VoiceEnrollment.user_id == current_user.id,
        VoiceEnrollment.status == "pending",
    ).update({"status": "denied", "denied_reason": "Profile reset by user"})

    db.commit()
    logger.info(f"Voice profile deactivated for user {current_user.id}")
    return {"status": "success", "message": "Voice profile has been reset. You can now re-enroll."}


@router.post("/enrollment/start", response_model=EnrollmentStartResponse)
def start_enrollment(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start a new voice enrollment session. Customer must submit 3 verified human voice samples."""
    if current_user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=403, detail="Only customers can enroll for voice auth")

    # Check if already enrolled
    existing_profile = db.query(VoiceProfile).filter(
        VoiceProfile.user_id == current_user.id,
        VoiceProfile.is_active == True,
    ).first()
    if existing_profile:
        # Allow re-enrollment if profile has an outdated vector format
        # (old profiles used 8-dim spectral/prosodic vectors instead of 256-dim Resemblyzer embeddings)
        if (
            existing_profile.voice_vector
            and len(existing_profile.voice_vector) == SPEAKER_EMBEDDING_DIM
        ):
            raise HTTPException(status_code=400, detail="Already enrolled for voice authentication")
        else:
            logger.info(
                f"Deactivating outdated voice profile for user {current_user.id} "
                f"(dim={len(existing_profile.voice_vector) if existing_profile.voice_vector else 0}, "
                f"expected={SPEAKER_EMBEDDING_DIM}) to allow re-enrollment"
            )
            existing_profile.is_active = False
            current_user.voice_enrolled = False
            db.commit()

    # Cancel any existing pending enrollment
    db.query(VoiceEnrollment).filter(
        VoiceEnrollment.user_id == current_user.id,
        VoiceEnrollment.status == "pending",
    ).update({"status": "denied", "denied_reason": "Superseded by new enrollment"})

    enrollment_id = f"ENR-{uuid.uuid4().hex[:12].upper()}"
    enrollment = VoiceEnrollment(
        enrollment_id=enrollment_id,
        user_id=current_user.id,
        required_samples=ENROLLMENT_REQUIRED_SAMPLES,
        verified_samples=0,
        status="pending",
        expires_at=datetime.utcnow() + timedelta(seconds=ENROLLMENT_TTL_SECONDS),
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)

    logger.info(f"Enrollment session created for user {current_user.id}: {enrollment_id}")

    return {
        "status": "success",
        "enrollment_id": enrollment_id,
        "customer_id": current_user.id,
        "required_samples": ENROLLMENT_REQUIRED_SAMPLES,
        "verified_samples": 0,
        "expires_in_seconds": ENROLLMENT_TTL_SECONDS,
        "message": "Enrollment session created. Submit 3 verified human voice samples.",
    }


@router.post("/enrollment/{enrollment_id}/sample", response_model=EnrollmentSampleResponse)
async def submit_enrollment_sample(
    enrollment_id: str,
    audio: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit a voice sample for enrollment. Each sample is checked for AI-generated content."""
    enrollment = (
        db.query(VoiceEnrollment)
        .filter(VoiceEnrollment.enrollment_id == enrollment_id)
        .first()
    )

    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment session not found")
    if enrollment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if enrollment.status == "denied":
        raise HTTPException(status_code=400, detail=f"Enrollment is denied: {enrollment.denied_reason}")
    if enrollment.status == "completed":
        raise HTTPException(status_code=400, detail="Enrollment already completed")
    if enrollment.expires_at < datetime.utcnow():
        enrollment.status = "denied"
        enrollment.denied_reason = "Session expired"
        db.commit()
        raise HTTPException(status_code=400, detail="Enrollment session has expired")

    # Validate and read audio
    audio_bytes = await validate_upload(audio)

    # Replay detection
    if replay_guard.is_replay(audio_bytes):
        enrollment.status = "denied"
        enrollment.denied_reason = "Replay audio detected"
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="Replay audio detected. Enrollment denied.",
        )

    # Run voice analysis pipeline
    try:
        analysis = await analyze_voice_sample(audio_bytes, audio.filename or "audio.mp3")
    except Exception as e:
        logger.error(f"Voice analysis pipeline failed for enrollment {enrollment_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Voice analysis failed: {str(e)}. Please try again.",
        )

    # Check if AI-generated
    if analysis["ai_generated"]:
        enrollment.status = "denied"
        enrollment.denied_reason = "AI/synthetic voice detected"
        db.commit()

        # Save the failed sample for audit
        sample = VoiceEnrollmentSample(
            enrollment_id=enrollment.id,
            sample_number=enrollment.verified_samples + 1,
            is_human=False,
            confidence=analysis["confidence"],
            ai_probability=analysis.get("ai_probability", 0),
            analysis_details=analysis,
        )
        db.add(sample)
        db.commit()

        raise HTTPException(
            status_code=400,
            detail="AI-generated or suspicious voice detected. Enrollment denied.",
        )

    # Extract full voiceprint (256-dim neural embedding + 47-dim MFCC features)
    voiceprint = await extract_full_voiceprint(audio_bytes, audio.filename or "audio.mp3")
    voice_vector = voiceprint["embedding"]
    mfcc_vector = voiceprint["mfcc"]

    # Cross-sample speaker verification (from sample 2 onwards)
    existing_samples = (
        db.query(VoiceEnrollmentSample)
        .filter(
            VoiceEnrollmentSample.enrollment_id == enrollment.id,
            VoiceEnrollmentSample.is_human == True,
        )
        .all()
    )
    existing_vectors = [
        s.analysis_details.get("voice_vector", [])
        for s in existing_samples
        if s.analysis_details and "voice_vector" in s.analysis_details
        and len(s.analysis_details.get("voice_vector", [])) == SPEAKER_EMBEDDING_DIM
    ]

    if existing_vectors:
        speaker_match = compare_enrollment_samples(voice_vector, existing_vectors)
        if not speaker_match["match"]:
            enrollment.status = "denied"
            enrollment.denied_reason = "Speaker mismatch across enrollment samples"
            db.commit()
            raise HTTPException(
                status_code=400,
                detail="Enrollment samples do not match the same speaker. Enrollment denied.",
            )

    # Save successful sample (store both embedding and MFCC features)
    sample_analysis = {**analysis, "voice_vector": voice_vector, "mfcc_vector": mfcc_vector}
    sample = VoiceEnrollmentSample(
        enrollment_id=enrollment.id,
        sample_number=enrollment.verified_samples + 1,
        is_human=True,
        confidence=analysis["confidence"],
        ai_probability=analysis.get("ai_probability", 0),
        analysis_details=sample_analysis,
    )
    db.add(sample)

    enrollment.verified_samples += 1

    # Check if enrollment is complete
    enrollment_complete = enrollment.verified_samples >= enrollment.required_samples
    if enrollment_complete:
        enrollment.status = "completed"
        enrollment.completed_at = datetime.utcnow()

        # Gather all sample embeddings and MFCC features
        all_embeddings = existing_vectors + [voice_vector]
        all_mfccs = [
            s.analysis_details.get("mfcc_vector", [])
            for s in existing_samples
            if s.analysis_details and "mfcc_vector" in s.analysis_details
            and len(s.analysis_details.get("mfcc_vector", [])) == MFCC_FEATURE_DIM
        ] + [mfcc_vector]

        # Build enriched profile with multi-probe data and adaptive thresholds
        profile_data = build_enriched_profile(all_embeddings, all_mfccs)

        # Upsert voice profile
        profile = db.query(VoiceProfile).filter(VoiceProfile.user_id == current_user.id).first()
        if profile:
            profile.voice_vector = profile_data
            profile.sample_count = enrollment.verified_samples
            profile.is_active = True
            profile.updated_at = datetime.utcnow()
        else:
            profile = VoiceProfile(
                user_id=current_user.id,
                voice_vector=profile_data,
                sample_count=enrollment.verified_samples,
                is_active=True,
            )
            db.add(profile)

        # Mark user as voice enrolled
        current_user.voice_enrolled = True

        message = "Enrollment completed successfully."
        logger.info(f"User {current_user.id} voice enrollment completed.")
    else:
        message = f"Voice sample accepted. Submit the next sample. ({enrollment.verified_samples}/{enrollment.required_samples})"

    db.commit()

    return {
        "status": "success",
        "enrollment_id": enrollment_id,
        "customer_id": current_user.id,
        "verified_samples": enrollment.verified_samples,
        "required_samples": enrollment.required_samples,
        "enrollment_complete": enrollment_complete,
        "message": message,
        "analysis": {
            "is_human": not analysis["ai_generated"],
            "confidence": analysis["confidence"],
            "risk_tier": analysis.get("risk_tier"),
        },
    }


# ═══════════════════════════════════════════════════════════════
#  DELIVERY VERIFICATION ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@router.post("/verification/start", response_model=VerificationStartResponse)
def start_delivery_verification(
    payload: VerificationStartRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Courier initiates voice verification for a shipment.
    Generates a verification link for the customer.
    """
    if current_user.role != UserRole.COURIER:
        raise HTTPException(status_code=403, detail="Only couriers can initiate delivery verification")

    shipment = db.query(Shipment).filter(Shipment.id == payload.shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if shipment.courier_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized for this shipment")

    # Check if customer is enrolled
    customer_id = shipment.sender_id
    profile = db.query(VoiceProfile).filter(
        VoiceProfile.user_id == customer_id,
        VoiceProfile.is_active == True,
    ).first()
    if not profile:
        raise HTTPException(
            status_code=400,
            detail="Customer is not enrolled for voice authentication",
        )

    # Generate challenge phrase
    challenge_phrase = random.choice(CHALLENGE_PHRASES)

    verification_id = f"VRF-{uuid.uuid4().hex[:12].upper()}"
    verification = VoiceVerification(
        verification_id=verification_id,
        shipment_id=shipment.id,
        customer_id=customer_id,
        courier_id=current_user.id,
        challenge_phrase=challenge_phrase,
        status="pending",
        expires_at=datetime.utcnow() + timedelta(seconds=VERIFICATION_TTL_SECONDS),
    )
    db.add(verification)

    # Update shipment status
    shipment.voice_verification_required = True
    shipment.voice_verification_status = "pending"

    db.commit()

    # Generate verification link (customer frontend)
    verification_link = f"http://localhost:3001/verify/{verification_id}"

    logger.info(
        f"Verification started for shipment {shipment.id}: {verification_id}"
    )

    return {
        "status": "success",
        "verification_id": verification_id,
        "customer_id": customer_id,
        "shipment_id": shipment.id,
        "challenge_phrase": challenge_phrase,
        "verification_link": verification_link,
        "expires_in_seconds": VERIFICATION_TTL_SECONDS,
        "message": "Verification link created. Customer must submit a live human voice sample.",
    }


@router.post("/verification/{verification_id}/submit", response_model=VerificationSubmitResponse)
async def complete_delivery_verification(
    verification_id: str,
    audio: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Customer submits voice sample for delivery verification.
    Voice must be human AND match the enrolled voice profile.
    """
    verification = (
        db.query(VoiceVerification)
        .filter(VoiceVerification.verification_id == verification_id)
        .first()
    )

    if not verification:
        raise HTTPException(status_code=404, detail="Verification session not found")
    if verification.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if verification.status != "pending":
        raise HTTPException(status_code=400, detail="Verification already completed")
    if verification.expires_at < datetime.utcnow():
        verification.status = "expired"
        db.commit()
        raise HTTPException(status_code=400, detail="Verification session has expired")

    # Get customer's voice profile
    profile = db.query(VoiceProfile).filter(
        VoiceProfile.user_id == current_user.id,
        VoiceProfile.is_active == True,
    ).first()
    if not profile:
        raise HTTPException(status_code=400, detail="Customer voice profile not found")

    # Validate and read audio
    audio_bytes = await validate_upload(audio)

    # Replay detection
    if replay_guard.is_replay(audio_bytes):
        verification.status = "failed"
        verification.delivery_approved = False
        verification.analysis_details = {"failure_reason": "replay_detected"}
        _update_shipment_voice_status(db, verification.shipment_id, "failed")
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="Replay audio detected. Verification failed.",
        )

    # Run voice analysis pipeline
    try:
        analysis = await analyze_voice_sample(audio_bytes, audio.filename or "audio.mp3")
    except Exception as e:
        logger.error(f"Voice analysis pipeline failed for verification {verification_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Voice analysis failed: {str(e)}. Please try again.",
        )

    # Check AI detection
    if analysis["ai_generated"]:
        verification.status = "failed"
        verification.is_human = False
        verification.confidence = analysis["confidence"]
        verification.delivery_approved = False
        verification.analysis_details = analysis
        verification.completed_at = datetime.utcnow()
        _update_shipment_voice_status(db, verification.shipment_id, "failed")
        db.commit()

        return {
            "status": "failed",
            "verification_id": verification_id,
            "customer_id": current_user.id,
            "shipment_id": verification.shipment_id,
            "delivery_approved": False,
            "is_human": False,
            "confidence": analysis["confidence"],
            "speaker_similarity": None,
            "message": "AI-generated voice detected. Verification failed. Do not complete delivery.",
            "analysis": analysis,
        }

    # Speaker verification — extract full voiceprint and compare with enrolled profile
    voiceprint = await extract_full_voiceprint(audio_bytes, audio.filename or "audio.mp3")
    verification_vector = voiceprint["embedding"]
    verification_mfcc = voiceprint["mfcc"]
    profile_data = profile.voice_vector

    # Check for outdated profile format (must be enriched v2 dict or 256-dim list)
    if not profile_data:
        verification.status = "failed"
        verification.delivery_approved = False
        verification.analysis_details = {"failure_reason": "profile_needs_reenrollment"}
        verification.completed_at = datetime.utcnow()
        _update_shipment_voice_status(db, verification.shipment_id, "failed")
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="Customer's voice profile is missing. Please re-enroll for voice authentication.",
        )

    # Validate profile format — must be v2 dict or legacy 256-dim list
    if isinstance(profile_data, list) and len(profile_data) != SPEAKER_EMBEDDING_DIM:
        verification.status = "failed"
        verification.delivery_approved = False
        verification.analysis_details = {"failure_reason": "profile_needs_reenrollment"}
        verification.completed_at = datetime.utcnow()
        _update_shipment_voice_status(db, verification.shipment_id, "failed")
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="Customer's voice profile uses an outdated format. Please re-enroll for voice authentication.",
        )

    speaker_result = verify_speaker(verification_vector, profile_data, verification_mfcc=verification_mfcc)

    if not speaker_result["match"]:
        verification.status = "failed"
        verification.is_human = True
        verification.confidence = analysis["confidence"]
        verification.speaker_similarity = speaker_result["similarity"]
        verification.delivery_approved = False
        verification.analysis_details = {**analysis, "speaker_verification": speaker_result}
        verification.completed_at = datetime.utcnow()
        _update_shipment_voice_status(db, verification.shipment_id, "failed")
        db.commit()

        return {
            "status": "failed",
            "verification_id": verification_id,
            "customer_id": current_user.id,
            "shipment_id": verification.shipment_id,
            "delivery_approved": False,
            "is_human": True,
            "confidence": analysis["confidence"],
            "speaker_similarity": speaker_result["similarity"],
            "message": "Voice is human but does not match the enrolled speaker. Verification failed.",
            "analysis": {**analysis, "speaker_verification": speaker_result},
        }

    # Verification passed!
    verification.status = "approved"
    verification.is_human = True
    verification.confidence = analysis["confidence"]
    verification.speaker_similarity = speaker_result["similarity"]
    verification.delivery_approved = True
    verification.analysis_details = {**analysis, "speaker_verification": speaker_result}
    verification.completed_at = datetime.utcnow()
    _update_shipment_voice_status(db, verification.shipment_id, "approved")
    db.commit()

    logger.info(
        f"Verification approved for shipment {verification.shipment_id}, "
        f"similarity={speaker_result['similarity']}"
    )

    return {
        "status": "success",
        "verification_id": verification_id,
        "customer_id": current_user.id,
        "shipment_id": verification.shipment_id,
        "delivery_approved": True,
        "is_human": True,
        "confidence": analysis["confidence"],
        "speaker_similarity": speaker_result["similarity"],
        "message": "Voice verification passed. Delivery can be completed.",
        "analysis": {**analysis, "speaker_verification": speaker_result},
    }


@router.get("/verification/{verification_id}/status", response_model=VerificationStatusResponse)
def get_verification_status(
    verification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check the status of a voice verification session."""
    verification = (
        db.query(VoiceVerification)
        .filter(VoiceVerification.verification_id == verification_id)
        .first()
    )
    if not verification:
        raise HTTPException(status_code=404, detail="Verification session not found")
    if verification.customer_id != current_user.id and verification.courier_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    status_messages = {
        "pending": "Awaiting customer voice submission.",
        "approved": "Voice verification passed. Delivery approved.",
        "failed": "Voice verification failed. Do not complete delivery.",
        "expired": "Verification session has expired.",
    }

    return {
        "verification_id": verification_id,
        "shipment_id": verification.shipment_id,
        "status": verification.status,
        "delivery_approved": verification.delivery_approved,
        "challenge_phrase": verification.challenge_phrase,
        "expires_at": verification.expires_at.isoformat() if verification.expires_at else None,
        "message": status_messages.get(verification.status, "Unknown status"),
    }


def _update_shipment_voice_status(db: Session, shipment_id: int, status: str):
    """Helper to update the shipment's voice verification status."""
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if shipment:
        shipment.voice_verification_status = status
