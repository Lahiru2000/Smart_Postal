"""
Verification Link Routes – couriers generate one-time links, customers
open them to record/upload a video without authentication.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request, BackgroundTasks, Form
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import List
import os
import uuid
import logging
import base64
import numpy as np

from app.database import get_db, SessionLocal
from app.services.auth import get_current_user
from app.models.user import User
from app.models.shipment import Shipment
from app.models.face_ai_engine.verification_link import VerificationLink
from app.schemas.face_ai_engine.verification_link import (
    VerificationLinkCreate,
    VerificationLinkResponse,
    VerificationLinkPublic,
    VerificationResultResponse,
)

logger = logging.getLogger(__name__)


def _video_path_to_url(video_path: str | None) -> str | None:
    """Convert an absolute filesystem video_path to a web-servable URL."""
    if not video_path:
        return None
    # video_path is like /…/app/uploads/verifications/token_hash.webm
    idx = video_path.find("/uploads/verifications/")
    if idx != -1:
        return video_path[idx:]  # → /uploads/verifications/filename
    # fallback: try basename
    basename = os.path.basename(video_path)
    return f"/uploads/verifications/{basename}"

router = APIRouter(prefix="/verification-link", tags=["Verification Link"])

# Directory to store uploaded videos
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "uploads", "verifications")
os.makedirs(UPLOAD_DIR, exist_ok=True)

LINK_EXPIRY_MINUTES = 30  # link valid for 30 minutes


# ── Courier endpoints (auth required) ───────────────────


@router.post("/generate", response_model=VerificationLinkResponse)
def generate_link(
    payload: VerificationLinkCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Courier generates a one-time verification link for the customer."""
    # Only couriers can generate links
    if current_user.role != "courier":
        raise HTTPException(status_code=403, detail="Only couriers can generate verification links")

    shipment = db.query(Shipment).filter(Shipment.id == payload.shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    if shipment.courier_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not the assigned courier for this shipment")

    # Expire any existing pending links for this shipment
    existing = (
        db.query(VerificationLink)
        .filter(
            VerificationLink.shipment_id == payload.shipment_id,
            VerificationLink.status == "pending",
        )
        .all()
    )
    for link in existing:
        link.status = "expired"
        link.completed_at = datetime.utcnow()

    # Create new link
    vlink = VerificationLink(
        shipment_id=shipment.id,
        courier_id=current_user.id,
        customer_id=shipment.sender_id,
        expires_at=datetime.utcnow() + timedelta(minutes=LINK_EXPIRY_MINUTES),
    )
    db.add(vlink)
    db.commit()
    db.refresh(vlink)

    # Build the customer-facing URL (customer frontend port 3001)
    customer_link = f"http://localhost:3001/verification/{vlink.token}"

    return VerificationLinkResponse(
        id=vlink.id,
        token=vlink.token,
        shipment_id=vlink.shipment_id,
        courier_id=vlink.courier_id,
        customer_id=vlink.customer_id,
        status=vlink.status,
        video_path=vlink.video_path,
        created_at=vlink.created_at,
        completed_at=vlink.completed_at,
        expires_at=vlink.expires_at,
        link=customer_link,
        ai_match=vlink.ai_match,
        face_score=vlink.face_score,
        voice_score=vlink.voice_score,
        combined_score=vlink.combined_score,
        confidence=vlink.confidence,
        verdict=vlink.verdict,
        face_available=vlink.face_available,
        voice_available=vlink.voice_available,
        ai_error=vlink.ai_error,
    )


@router.get("/shipment/{shipment_id}", response_model=list[VerificationLinkResponse])
def get_links_for_shipment(
    shipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all verification links for a shipment (courier only)."""
    links = (
        db.query(VerificationLink)
        .filter(VerificationLink.shipment_id == shipment_id)
        .order_by(VerificationLink.created_at.desc())
        .all()
    )
    results = []
    for vl in links:
        results.append(VerificationLinkResponse(
            id=vl.id,
            token=vl.token,
            shipment_id=vl.shipment_id,
            courier_id=vl.courier_id,
            customer_id=vl.customer_id,
            status=vl.status,
            video_path=vl.video_path,
            video_url=_video_path_to_url(vl.video_path),
            created_at=vl.created_at,
            completed_at=vl.completed_at,
            expires_at=vl.expires_at,
            link=f"http://localhost:3001/verification/{vl.token}",
            ai_match=vl.ai_match,
            face_score=vl.face_score,
            voice_score=vl.voice_score,
            combined_score=vl.combined_score,
            confidence=vl.confidence,
            verdict=vl.verdict,
            face_available=vl.face_available,
            voice_available=vl.voice_available,
            ai_error=vl.ai_error,
        ))
    return results


@router.get("/customer/shipment/{shipment_id}")
def get_pending_link_for_customer(
    shipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Customer checks if there is a pending verification link for their shipment."""
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    # Must be the sender (customer) of this shipment
    if shipment.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your shipment")

    vlink = (
        db.query(VerificationLink)
        .filter(
            VerificationLink.shipment_id == shipment_id,
            VerificationLink.customer_id == current_user.id,
            VerificationLink.status == "pending",
        )
        .order_by(VerificationLink.created_at.desc())
        .first()
    )

    if not vlink:
        return None

    # Check expiry
    if vlink.expires_at and datetime.utcnow() > vlink.expires_at:
        vlink.status = "expired"
        vlink.completed_at = datetime.utcnow()
        db.commit()
        return None

    courier = db.query(User).filter(User.id == vlink.courier_id).first()

    return {
        "token": vlink.token,
        "courier_name": courier.full_name if courier else None,
        "expires_at": vlink.expires_at.isoformat() if vlink.expires_at else None,
        "link": f"http://localhost:3001/verification/{vlink.token}",
    }


@router.get("/status/{token}")
def get_link_status(
    token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Courier polls this to see if the customer completed the verification."""
    vlink = db.query(VerificationLink).filter(VerificationLink.token == token).first()
    if not vlink:
        raise HTTPException(status_code=404, detail="Link not found")

    # Check expiry
    if vlink.status == "pending" and vlink.expires_at and datetime.utcnow() > vlink.expires_at:
        vlink.status = "expired"
        vlink.completed_at = datetime.utcnow()
        db.commit()

    return {
        "token": vlink.token,
        "status": vlink.status,
        "video_path": vlink.video_path,
        "video_url": _video_path_to_url(vlink.video_path),
        "completed_at": vlink.completed_at,
        # AI verification results
        "ai_match": vlink.ai_match,
        "face_score": vlink.face_score,
        "voice_score": vlink.voice_score,
        "combined_score": vlink.combined_score,
        "confidence": vlink.confidence,
        "verdict": vlink.verdict,
        "face_available": vlink.face_available,
        "voice_available": vlink.voice_available,
        "ai_error": vlink.ai_error,
    }


# ── Public endpoints (NO auth – customer uses token) ─────


@router.get("/public/{token}", response_model=VerificationLinkPublic)
def get_link_public(
    token: str,
    db: Session = Depends(get_db),
):
    """
    Customer opens the link → we return info about the verification
    request WITHOUT requiring login.
    """
    vlink = db.query(VerificationLink).filter(VerificationLink.token == token).first()
    if not vlink:
        raise HTTPException(status_code=404, detail="Verification link not found or invalid")

    # Check expiry
    if vlink.status == "pending" and vlink.expires_at and datetime.utcnow() > vlink.expires_at:
        vlink.status = "expired"
        vlink.completed_at = datetime.utcnow()
        db.commit()

    if vlink.status != "pending":
        raise HTTPException(
            status_code=410,
            detail=f"This link has already been {vlink.status}. Please ask the courier for a new link."
        )

    # Get shipment tracking + courier name
    shipment = db.query(Shipment).filter(Shipment.id == vlink.shipment_id).first()
    courier = db.query(User).filter(User.id == vlink.courier_id).first()

    return VerificationLinkPublic(
        token=vlink.token,
        shipment_tracking=shipment.tracking_number if shipment else None,
        courier_name=courier.full_name if courier else None,
        status=vlink.status,
        expires_at=vlink.expires_at,
    )


@router.post("/public/{token}/submit")
async def submit_verification_video(
    token: str,
    background_tasks: BackgroundTasks,
    video: UploadFile = File(...),
    audio: UploadFile = File(None),
    db: Session = Depends(get_db),
):
    """
    Customer submits their recorded/uploaded video + optional separate audio track.
    No auth required – the one-time token IS the auth.
    After saving, triggers AI face+voice comparison in the background.
    The separate audio file guarantees voice capture even when browsers
    fail to include audio in the video MediaRecorder output.
    """
    vlink = db.query(VerificationLink).filter(VerificationLink.token == token).first()
    if not vlink:
        raise HTTPException(status_code=404, detail="Verification link not found")

    # Expiry check
    if vlink.status == "pending" and vlink.expires_at and datetime.utcnow() > vlink.expires_at:
        vlink.status = "expired"
        vlink.completed_at = datetime.utcnow()
        db.commit()
        raise HTTPException(status_code=410, detail="This verification link has expired")

    if vlink.status != "pending":
        raise HTTPException(
            status_code=410,
            detail=f"This link has already been {vlink.status}. Please ask the courier for a new link."
        )

    # Validate file type (strip codec params like "video/webm;codecs=vp8,opus" → "video/webm")
    allowed = {"video/webm", "video/mp4", "video/quicktime", "video/x-matroska", "video/avi"}
    base_content_type = (video.content_type or "").split(";")[0].strip().lower()
    if base_content_type not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported video type: {video.content_type}. Accepted: mp4, webm, mov, mkv")

    # Save file
    ext = video.filename.split(".")[-1] if "." in video.filename else "webm"
    filename = f"{vlink.token}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    contents = await video.read()
    with open(filepath, "wb") as f:
        f.write(contents)

    # Update link status
    vlink.status = "completed"
    vlink.video_path = filepath
    vlink.completed_at = datetime.utcnow()
    db.commit()

    logger.info(f"Verification video submitted for token {token}: {filepath}")

    # ── Save separate audio file if provided ──────────────────────
    live_audio_path = None
    if audio and audio.filename:
        audio_contents = await audio.read()
        if len(audio_contents) > 1000:  # at least 1KB of real audio
            audio_ext = audio.filename.rsplit(".", 1)[-1] if "." in audio.filename else "webm"
            audio_filename = f"{vlink.token}_{uuid.uuid4().hex[:8]}_audio.{audio_ext}"
            live_audio_path = os.path.join(UPLOAD_DIR, audio_filename)
            with open(live_audio_path, "wb") as f:
                f.write(audio_contents)
            logger.info(f"Separate audio track saved: {live_audio_path} ({len(audio_contents)} bytes)")
        else:
            logger.warning(f"Audio file too small ({len(audio_contents)} bytes), ignoring")

    # ── Trigger AI comparison in the background ────────────────────
    shipment = db.query(Shipment).filter(Shipment.id == vlink.shipment_id).first()
    reference_url = None
    reference_media_type = None
    reference_audio_url = None

    if shipment and shipment.video_url:
        reference_url = shipment.video_url
        reference_media_type = "video"
    elif shipment and shipment.image_url:
        reference_url = shipment.image_url
        reference_media_type = "image"

    # Check for separate reference audio
    if shipment and hasattr(shipment, 'audio_url') and shipment.audio_url:
        reference_audio_url = shipment.audio_url

    if reference_url:
        from app.services.face_ai_engine.verification_service import run_ai_verification

        background_tasks.add_task(
            run_ai_verification,
            verification_link_id=vlink.id,
            reference_video_url=reference_url,
            live_video_path=filepath,
            db_session_factory=SessionLocal,
            reference_media_type=reference_media_type,
            live_audio_path=live_audio_path,
            reference_audio_url=reference_audio_url,
        )
        logger.info(f"AI verification queued for link {vlink.id} (ref={reference_media_type}, "
                     f"live_audio={'yes' if live_audio_path else 'no'}, "
                     f"ref_audio={'yes' if reference_audio_url else 'no'})")
    else:
        logger.warning(
            f"No reference media on shipment {vlink.shipment_id} — "
            f"AI comparison skipped"
        )

    return {
        "detail": "Video submitted successfully. AI verification is processing.",
        "token": token,
        "status": "completed",
    }


# ── Live Camera Scan (public – token-based, face + voice) ────────────


@router.post("/public/{token}/scan")
async def submit_verification_scan(
    token: str,
    scan_data: str = Form(...),
    audio: UploadFile = File(None),
    db: Session = Depends(get_db),
):
    """
    Customer opens their camera and the frontend captures multiple frames
    automatically while recording audio. We extract ArcFace embeddings for
    face comparison AND use the recorded audio for voice verification (dual-model
    WavLM + ECAPA-TDNN ensemble).
    No auth required – the one-time token IS the auth.
    Face + voice verification when audio is provided; face-only when no audio.
    """
    import cv2
    import json as json_lib

    # Parse the scan_data JSON
    try:
        scan_payload = json_lib.loads(scan_data)
        snapshots = scan_payload.get("snapshots", [])
    except (json_lib.JSONDecodeError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid scan data format")

    vlink = db.query(VerificationLink).filter(VerificationLink.token == token).first()
    if not vlink:
        raise HTTPException(status_code=404, detail="Verification link not found")

    # Expiry check
    if vlink.status == "pending" and vlink.expires_at and datetime.utcnow() > vlink.expires_at:
        vlink.status = "expired"
        vlink.completed_at = datetime.utcnow()
        db.commit()
        raise HTTPException(status_code=410, detail="This verification link has expired")

    if vlink.status != "pending":
        raise HTTPException(
            status_code=410,
            detail=f"This link has already been {vlink.status}. Please ask the courier for a new link."
        )

    if not snapshots or len(snapshots) < 1:
        raise HTTPException(status_code=400, detail="At least one snapshot is required")

    # Save audio file if provided (for voice verification)
    audio_path = None
    if audio is not None:
        try:
            ext = audio.filename.split(".")[-1] if audio.filename and "." in audio.filename else "webm"
            audio_filename = f"scan_audio_{token}_{uuid.uuid4().hex[:8]}.{ext}"
            audio_path = os.path.join(UPLOAD_DIR, audio_filename)
            audio_contents = await audio.read()
            if len(audio_contents) > 1000:  # Only save if meaningful audio data
                with open(audio_path, "wb") as f:
                    f.write(audio_contents)
                logger.info(f"Scan audio saved: {audio_path} ({len(audio_contents)} bytes)")
            else:
                audio_path = None
                logger.info("Scan audio too small, skipping voice verification")
        except Exception as e:
            logger.warning(f"Failed to save scan audio: {e}")
            audio_path = None

    # 1. Get the shipment reference media
    shipment = db.query(Shipment).filter(Shipment.id == vlink.shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    if not shipment.image_url and not shipment.video_url:
        raise HTTPException(
            status_code=400,
            detail="No reference media on this shipment. Cannot verify."
        )

    # 2. Decode all snapshots into OpenCV frames
    live_frames = []
    for snapshot_data in snapshots:
        raw = snapshot_data
        if "," in raw:
            raw = raw.split(",", 1)[1]
        try:
            img_bytes = base64.b64decode(raw)
            img_array = np.frombuffer(img_bytes, dtype=np.uint8)
            frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
            if frame is not None:
                live_frames.append(frame)
        except Exception:
            continue

    if not live_frames:
        raise HTTPException(status_code=400, detail="No valid frames could be decoded from snapshots")

    # 3. Extract face embeddings from live frames
    from app.services.face_ai_engine.ai_model.face_verifier import (
        get_face_embedding, get_robust_embedding, get_image_embedding,
        SIGMOID_STEEPNESS, SIGMOID_MIDPOINT,
    )

    live_embeddings = []
    for frame in live_frames:
        emb = get_face_embedding(frame)
        if emb is not None:
            live_embeddings.append(emb)

    if not live_embeddings:
        # Mark as completed but with error
        vlink.status = "verified"
        vlink.ai_error = "No face detected in camera frames"
        vlink.completed_at = datetime.utcnow()
        db.commit()
        return {
            "success": False,
            "error": "No face detected. Please ensure your face is clearly visible and well-lit.",
            "token": token, "status": "verified",
            "face_score": None, "verdict": None, "confidence": None,
            "ai_match": None,
        }

    # Robust aggregation: outlier removal + average
    if len(live_embeddings) >= 3:
        stacked = np.stack(live_embeddings)
        median = np.median(stacked, axis=0)
        distances = [np.linalg.norm(e - median) for e in live_embeddings]
        dist_mean = np.mean(distances)
        dist_std = np.std(distances)
        threshold = dist_mean + 1.5 * dist_std
        filtered = [e for e, d in zip(live_embeddings, distances) if d <= threshold]
        if filtered:
            live_embeddings = filtered

    avg_live = np.mean(live_embeddings, axis=0)
    norm = np.linalg.norm(avg_live)
    if norm > 0:
        avg_live = avg_live / norm

    logger.info(f"Scan: {len(live_embeddings)} face embeddings from {len(live_frames)} frames")

    # 4. Get reference embedding
    ref_embedding = None
    media_source = None
    base_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "uploads")

    if shipment.video_url:
        rel = shipment.video_url[len("/uploads/"):] if shipment.video_url.startswith("/uploads/") else shipment.video_url.lstrip("/")
        ref_path = os.path.join(base_dir, rel)
        if os.path.exists(ref_path):
            ref_embedding, frame_count = get_robust_embedding(ref_path)
            media_source = "video"
        else:
            logger.warning(f"Reference video not found at: {ref_path}")

    if ref_embedding is None and shipment.image_url:
        rel = shipment.image_url[len("/uploads/"):] if shipment.image_url.startswith("/uploads/") else shipment.image_url.lstrip("/")
        ref_path = os.path.join(base_dir, rel)
        if os.path.exists(ref_path):
            ref_embedding = get_image_embedding(ref_path)
            media_source = "image"
        else:
            logger.warning(f"Reference image not found at: {ref_path}")

    if ref_embedding is None:
        vlink.status = "verified"
        vlink.ai_error = "Could not extract face from reference media"
        vlink.completed_at = datetime.utcnow()
        db.commit()
        return {
            "success": False,
            "error": "Could not extract face from reference media.",
            "token": token, "status": "verified",
            "face_score": None, "verdict": None, "confidence": None,
            "ai_match": None,
        }

    # 5. Compare face embeddings
    cos_sim = float(np.dot(avg_live, ref_embedding) / (
        np.linalg.norm(avg_live) * np.linalg.norm(ref_embedding)
    ))

    face_score = 1.0 / (1.0 + np.exp(-SIGMOID_STEEPNESS * (cos_sim - SIGMOID_MIDPOINT)))
    face_score = float(np.clip(face_score, 0.0, 1.0))
    face_score = round(face_score, 4)

    # 6. Voice comparison (if audio was captured and reference is a video)
    voice_score = 0.0
    voice_available = False

    if audio_path and media_source == "video" and shipment.video_url:
        try:
            from app.services.face_ai_engine.ai_model.voice_verifier import compare_voice_with_reference_audio

            ref_rel = shipment.video_url[len("/uploads/"):] if shipment.video_url.startswith("/uploads/") else shipment.video_url.lstrip("/")
            ref_video_path = os.path.join(base_dir, ref_rel)

            if os.path.exists(ref_video_path):
                voice_score = compare_voice_with_reference_audio(ref_video_path, audio_path)
                voice_available = voice_score > 0.0
                logger.info(f"Scan voice verification: score={voice_score:.4f}")
        except Exception as e:
            logger.error(f"Scan voice verification failed: {e}")
            voice_score = 0.0
            voice_available = False

    # Clean up audio file
    if audio_path:
        try:
            os.unlink(audio_path)
        except Exception:
            pass

    # 7. Combined decision (face + voice when available)
    FACE_WEIGHT = 0.55
    VOICE_WEIGHT = 0.45
    FACE_MIN_GATE = 0.50
    VOICE_MIN_GATE = 0.40
    MATCH_THRESHOLD = 0.62
    FACE_ONLY_THRESHOLD = 0.68

    if voice_available:
        combined_score = (face_score * FACE_WEIGHT) + (voice_score * VOICE_WEIGHT)
        threshold = MATCH_THRESHOLD
    else:
        combined_score = face_score
        threshold = FACE_ONLY_THRESHOLD

    combined_score = round(combined_score, 4)

    # Individual score gates
    gated_out = False
    if face_score < FACE_MIN_GATE:
        gated_out = True
    if voice_available and voice_score < VOICE_MIN_GATE:
        gated_out = True

    is_match = (combined_score >= threshold) and not gated_out

    if combined_score >= 0.80:
        confidence = "HIGH"
    elif combined_score >= 0.50:
        confidence = "MEDIUM"
    else:
        confidence = "LOW"

    verdict = "SAME PERSON" if is_match else "DIFFERENT PERSON"

    logger.info(
        f"Scan verification: face_cos={cos_sim:.4f}, face_score={face_score:.4f}, "
        f"voice_score={voice_score:.4f}, combined={combined_score:.4f}, "
        f"verdict={verdict}, confidence={confidence}, ref={media_source}"
    )

    # 8. Store results in the verification link record
    vlink.status = "verified"
    vlink.ai_match = is_match
    vlink.face_score = face_score
    vlink.voice_score = voice_score
    vlink.combined_score = combined_score
    vlink.confidence = confidence
    vlink.verdict = verdict
    vlink.face_available = True
    vlink.voice_available = voice_available
    vlink.ai_error = None
    vlink.completed_at = datetime.utcnow()
    db.commit()

    return {
        "success": True,
        "token": token,
        "status": "verified",
        "face_score": round(face_score * 100, 1),
        "voice_score": round(voice_score * 100, 1) if voice_available else None,
        "cos_similarity": round(cos_sim, 4),
        "verdict": verdict,
        "confidence": confidence,
        "ai_match": is_match,
        "reference_type": media_source,
        "combined_score": combined_score,
        "face_available": True,
        "voice_available": voice_available,
        "error": None,
    }


# ── Verification Result endpoint (public – token-based) ───────────


@router.get("/result/{token}", response_model=VerificationResultResponse)
def get_verification_result(
    token: str,
    db: Session = Depends(get_db),
):
    """
    Poll this endpoint to get AI verification results.
    No auth required – customer can check with their token.
    Courier uses the authenticated /status/{token} endpoint.
    """
    vlink = db.query(VerificationLink).filter(VerificationLink.token == token).first()
    if not vlink:
        raise HTTPException(status_code=404, detail="Verification link not found")

    return VerificationResultResponse(
        token=vlink.token,
        status=vlink.status,
        ai_match=vlink.ai_match,
        face_score=vlink.face_score,
        voice_score=vlink.voice_score,
        combined_score=vlink.combined_score,
        confidence=vlink.confidence,
        verdict=vlink.verdict,
        face_available=vlink.face_available,
        voice_available=vlink.voice_available,
        ai_error=vlink.ai_error,
        completed_at=vlink.completed_at,
    )
