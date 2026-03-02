from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
import pickle
import numpy as np
from typing import Optional

from models.database import get_db
from models.user import User
from models.order import Order
from models.biometric import VoiceTemplate, VerificationLog
from api.schemas.biometric import (
    VoiceEnrollmentResponse, 
    VoiceVerificationResponse,
    ChallengeCreateRequest,
    ChallengeCreateResponse,
    ChallengeVerifyRequest,
    ChallengeVerifyResponse
)
from api.middleware.auth import get_current_user
from utils.voice_banking import voice_processor
from utils.anti_spoof import (
    decision_engine, challenge_manager, lfcc_extractor,
    DecisionType, RiskLevel
)
from config.settings import get_settings
from loguru import logger

router = APIRouter(prefix="/api/voice", tags=["Voice Authentication"])
settings = get_settings()

@router.post("/enroll", response_model=VoiceEnrollmentResponse)
async def enroll_voice(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Enroll a voice sample for the current user.
    Requires multiple samples to build a robust template.
    """
    # 1. Process the audio file with quality checks and AI detection
    try:
        result = await voice_processor.process_audio(
            file,
            perform_quality_check=True,
            perform_liveness_check=False,  # Less strict for enrollment
            perform_ai_detection=True,  # CRITICAL: Detect AI voices during enrollment
            ai_detection_strict_mode=True  # Strict mode for enrollment security
        )
        
        if not result["success"]:
            error_code = result.get("error_code", "UNKNOWN_ERROR")
            error_msg = result.get("error", "Audio validation failed")
            
            # Special handling for AI detection failures
            if error_code == "AI_SYNTHETIC_VOICE_DETECTED":
                ai_metrics = result.get("ai_detection_metrics", {})
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "error": error_msg,
                        "error_code": error_code,
                        "ai_probability": ai_metrics.get("ai_probability", 0.0),
                        "is_rerecorded": ai_metrics.get("is_rerecorded", False),
                        "detection_method": ai_metrics.get("detection_method", "UNKNOWN"),
                        "message": "Voice enrollment blocked due to AI/synthetic voice detection. Please use your natural voice directly into the microphone."
                    }
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Audio validation failed: {error_msg}"
                )
        
        new_embedding = result["embedding"]
        quality_metrics = result.get("quality_metrics", {})
        liveness_metrics = result.get("liveness_metrics", {})
        ai_detection_metrics = result.get("ai_detection_metrics", {})
        
        logger.info(f"Enrollment audio processed - Quality: {quality_metrics}, "
                   f"Liveness: {liveness_metrics}, AI Detection: {ai_detection_metrics}")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error processing audio: {str(e)}"
        )

    # 2. Get or create voice template
    voice_template = db.query(VoiceTemplate).filter(
        VoiceTemplate.user_id == current_user.id
    ).first()

    if not voice_template:
        embedding_bytes = pickle.dumps(new_embedding)
        voice_template = VoiceTemplate(
            user_id=current_user.id,
            embedding_data=embedding_bytes,
            sample_count=1,
            is_active=True
        )
        db.add(voice_template)
    else:
        # Update existing template (averaging)
        try:
            current_embedding = pickle.loads(voice_template.embedding_data)
            n = voice_template.sample_count
            
            # Weighted average: (old * n + new) / (n + 1)
            updated_embedding = (current_embedding * n + new_embedding) / (n + 1)
            # Re-normalize
            updated_embedding = updated_embedding / (np.linalg.norm(updated_embedding) + 1e-8)
            
            embedding_bytes = pickle.dumps(updated_embedding)
            voice_template.embedding_data = embedding_bytes
            voice_template.sample_count += 1
        except (pickle.UnpicklingError, Exception) as e:
            # If old data is corrupted, replace it with new data
            embedding_bytes = pickle.dumps(new_embedding)
            voice_template.embedding_data = embedding_bytes
            voice_template.sample_count = 1

    db.commit()
    db.refresh(voice_template)

    # 3. Enhanced Decision Engine Evaluation
    decision_result = decision_engine.evaluate(
        user_id=current_user.id,
        asv_score=0.95,  # Enrollment doesn't have ASV score yet
        ai_probability=ai_detection_metrics.get("ai_probability", 0.0),
        ai_flags=ai_detection_metrics.get("flags", []),
        metadata=None,  # TODO: Extract from request
        is_enrollment=True
    )
    
    logger.info(f"Enrollment decision: {decision_result.decision}, Risk: {decision_result.risk_level}")
    
    # If high risk, require challenge
    if decision_result.decision == DecisionType.CHALLENGE:
        return VoiceEnrollmentResponse(
            success=True,
            message="Voice sample processed - Active liveness verification required",
            samples_recorded=voice_template.sample_count,
            samples_required=settings.MIN_VOICE_SAMPLES,
            enrollment_complete=False,
            quality_score=0.95,
            decision=decision_result.decision.value,
            risk_level=decision_result.risk_level.value,
            risk_score=decision_result.risk_score,
            challenge_id=decision_result.challenge.challenge_id if decision_result.challenge else None
        )
    
    # If critical risk, deny enrollment
    if decision_result.decision in [DecisionType.DENY, DecisionType.REQUIRE_2FA]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": decision_result.reason,
                "decision": decision_result.decision.value,
                "risk_level": decision_result.risk_level.value,
                "require_2fa": decision_result.require_2fa
            }
        )
    
    # 4. Check if enrollment is complete
    is_complete = voice_template.sample_count >= settings.MIN_VOICE_SAMPLES
    
    return VoiceEnrollmentResponse(
        success=True,
        message="Voice sample processed successfully",
        samples_recorded=voice_template.sample_count,
        samples_required=settings.MIN_VOICE_SAMPLES,
        enrollment_complete=is_complete,
        quality_score=0.95,
        decision=decision_result.decision.value,
        risk_level=decision_result.risk_level.value,
        risk_score=decision_result.risk_score
    )

@router.post("/verify", response_model=VoiceVerificationResponse)
async def verify_voice(
    order_id: int = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Verify voice against the enrolled template.
    If order_id is provided, verifies against the order's customer.
    Otherwise, verifies against the current user.
    """
    # 1. Determine which user to verify against
    if order_id:
        # Validate Order
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        customer_id = order.customer_id
    else:
        # For testing: verify against current user
        customer_id = current_user.id

    # 2. Get Customer's Voice Template
    voice_template = db.query(VoiceTemplate).filter(
        VoiceTemplate.user_id == customer_id
    ).first()

    if not voice_template or not voice_template.embedding_data:
        raise HTTPException(
            status_code=400, 
            detail="User has not enrolled for voice authentication"
        )

    # 3. Process incoming audio with full security checks including AI detection
    try:
        result = await voice_processor.process_audio(
            file,
            perform_quality_check=True,
            perform_liveness_check=True,
            perform_ai_detection=True,  # CRITICAL: Detect AI voices during verification
            ai_detection_strict_mode=True  # Strict mode for verification security
        )
        
        if not result["success"]:
            error_code = result.get("error_code", "UNKNOWN_ERROR")
            error_msg = result.get("error", "Audio validation failed")
            
            # Special handling for AI detection failures
            if error_code == "AI_SYNTHETIC_VOICE_DETECTED":
                ai_metrics = result.get("ai_detection_metrics", {})
                
                # Log the failed verification attempt with AI detection flag
                log = VerificationLog(
                    user_id=customer_id,
                    order_id=order_id,
                    verification_type="voice",
                    success=False,
                    confidence_score=0.0,
                    ai_detected=True,
                    ai_detection_score=ai_metrics.get("ai_probability", 1.0),
                    ip_address="0.0.0.0",  # TODO: Get from request
                    device_info="unknown",  # TODO: Get from request
                    failure_reason="AI_SYNTHETIC_VOICE_DETECTED"
                )
                db.add(log)
                db.commit()
                
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "error": error_msg,
                        "error_code": error_code,
                        "ai_probability": ai_metrics.get("ai_probability", 0.0),
                        "is_rerecorded": ai_metrics.get("is_rerecorded", False),
                        "detection_method": ai_metrics.get("detection_method", "UNKNOWN"),
                        "message": "Voice verification blocked due to AI/synthetic voice detection. Authentication failed."
                    }
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Audio validation failed: {error_msg}"
                )
        
        incoming_embedding = result["embedding"]
        quality_metrics = result.get("quality_metrics", {})
        liveness_metrics = result.get("liveness_metrics", {})
        ai_detection_metrics = result.get("ai_detection_metrics", {})
        
        logger.info(f"Verification audio processed - Quality: {quality_metrics}, "
                   f"Liveness: {liveness_metrics}, AI Detection: {ai_detection_metrics}")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing audio: {str(e)}")

    # 4. Verify
    try:
        stored_embedding = pickle.loads(voice_template.embedding_data)
    except (pickle.UnpicklingError, Exception) as e:
        raise HTTPException(
            status_code=400,
            detail="Voice template data is corrupted. Please re-enroll."
        )
    
    # Use ensemble verification (banking-grade)
    is_verified, ensemble_score, verification_metrics = voice_processor.verify_voice_ensemble(
        incoming_embedding, 
        stored_embedding,
        use_strict_threshold=False  # Set True for high-security transactions
    )
    
    logger.info(f"Verification metrics: {verification_metrics}")
    
    # AI detection check performed during audio processing
    # The ai_detection_metrics contains comprehensive AI/synthetic detection results
    is_ai = not ai_detection_metrics.get("is_human", True) if ai_detection_metrics else False
    ai_score = ai_detection_metrics.get("ai_probability", 0.0) if ai_detection_metrics else 0.0
    is_rerecorded = ai_detection_metrics.get("is_rerecorded", False) if ai_detection_metrics else False
    
    # Note: AI detection already handled in process_audio - this is double-check
    if is_ai:
        is_verified = False
        if is_rerecorded:
            message = f"Voice verification failed: Re-recorded AI voice detected (AI probability: {ai_score:.1%})"
        else:
            message = f"Voice verification failed: AI-generated voice detected (AI probability: {ai_score:.1%})"
    elif is_verified:
        message = f"✓ Voice verification successful (Ensemble: {ensemble_score:.3f}, Cosine: {verification_metrics['cosine_similarity']:.3f})"
        
        # --- Adaptive Learning: Update template with verified sample ---
        try:
            # We already have stored_embedding loaded
            n = voice_template.sample_count
            
            # Weighted average: (old * n + new) / (n + 1)
            updated_embedding = (stored_embedding * n + incoming_embedding) / (n + 1)
            # Re-normalize
            updated_embedding = updated_embedding / (np.linalg.norm(updated_embedding) + 1e-8)
            
            voice_template.embedding_data = pickle.dumps(updated_embedding)
            voice_template.sample_count += 1
            db.add(voice_template)
            logger.info(f"✓ Adaptive Learning: Template updated (samples: {n} -> {n+1})")
        except Exception as e:
            logger.error(f"Failed to update voice template: {e}")
            # Don't fail verification if update fails
            
    else:
        # Use specific failure reason if available
        fail_reason = verification_metrics.get('fail_reason')
        if fail_reason:
            message = f"✗ Voice verification failed: {fail_reason}"
        else:
            actual_threshold = verification_metrics.get('threshold_used', settings.VOICE_SIMILARITY_THRESHOLD)
            message = f"✗ Voice verification failed: Voice did not match (Ensemble: {ensemble_score:.3f}, Threshold: {actual_threshold:.3f})"

    # 5. Log the attempt with enhanced security metrics
    log = VerificationLog(
        user_id=customer_id,
        order_id=order_id,
        verification_type="voice",
        success=is_verified,
        confidence_score=ensemble_score,
        ai_detected=is_ai,
        ai_detection_score=ai_score,
        ip_address="0.0.0.0", # TODO: Get from request
        device_info="unknown" # TODO: Get from request
    )
    db.add(log)
    db.commit()

    # 6. Enhanced Decision Engine Evaluation
    decision_result = decision_engine.evaluate(
        user_id=customer_id,
        asv_score=ensemble_score,
        ai_probability=ai_score,
        ai_flags=ai_detection_metrics.get("flags", []),
        metadata=None,  # TODO: Extract from request
        is_enrollment=False
    )
    
    logger.info(f"Verification decision: {decision_result.decision}, Risk: {decision_result.risk_level}")
    
    # If challenge required
    if decision_result.decision == DecisionType.CHALLENGE:
        return VoiceVerificationResponse(
            success=True,
            verified=False,
            confidence_score=ensemble_score,
            ai_detected=is_ai,
            ai_detection_score=ai_score,
            ai_probability=ai_score,
            is_rerecorded=is_rerecorded,
            message="Active liveness verification required",
            decision=decision_result.decision.value,
            risk_level=decision_result.risk_level.value,
            risk_score=decision_result.risk_score,
            challenge_id=decision_result.challenge.challenge_id if decision_result.challenge else None,
            challenge_phrase=decision_result.challenge.phrase if decision_result.challenge else None
        )
    
    # If 2FA required
    if decision_result.decision == DecisionType.REQUIRE_2FA:
        return VoiceVerificationResponse(
            success=False,
            verified=False,
            confidence_score=ensemble_score,
            ai_detected=is_ai,
            ai_detection_score=ai_score,
            ai_probability=ai_score,
            is_rerecorded=is_rerecorded,
            message=f"Critical security risk - Two-factor authentication required: {decision_result.reason}",
            decision=decision_result.decision.value,
            risk_level=decision_result.risk_level.value,
            risk_score=decision_result.risk_score,
            should_flag=True
        )

    return VoiceVerificationResponse(
        success=True,
        verified=is_verified,
        confidence_score=ensemble_score,
        ai_detected=is_ai,
        ai_detection_score=ai_score,
        ai_probability=ai_score,
        is_rerecorded=is_rerecorded,
        message=message,
        decision=decision_result.decision.value,
        risk_level=decision_result.risk_level.value,
        risk_score=decision_result.risk_score,
        should_flag=decision_result.should_flag
    )


@router.post("/challenge/create", response_model=ChallengeCreateResponse)
async def create_challenge(
    request: ChallengeCreateRequest = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create an active liveness challenge for high-risk verification attempts.
    Returns a random phrase that the user must speak.
    """
    user_id = request.user_id if request and request.user_id else current_user.id
    
    # Verify user has permission
    if user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to create challenge for this user"
        )
    
    # Generate challenge
    challenge = challenge_manager.generate_challenge(user_id)
    
    logger.info(f"Challenge created for user {user_id}: {challenge.challenge_id}")
    
    return ChallengeCreateResponse(
        success=True,
        challenge_id=challenge.challenge_id,
        phrase=challenge.phrase,
        expires_in_seconds=300,  # 5 minutes
        message="Please record yourself saying the following phrase"
    )


@router.post("/challenge/verify", response_model=ChallengeVerifyResponse)
async def verify_challenge(
    challenge_id: str = Form(...),
    order_id: int = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Verify a challenge response with voice audio.
    This provides active liveness detection through challenge-response.
    """
    # 1. Validate Challenge
    challenge = challenge_manager.get_challenge(challenge_id)
    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found or expired"
        )
    
    # Verify user matches challenge
    if challenge.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Challenge does not belong to current user"
        )
    
    # Determine target user for verification
    if order_id:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        customer_id = order.customer_id
    else:
        customer_id = current_user.id
    
    # 2. Get Voice Template
    voice_template = db.query(VoiceTemplate).filter(
        VoiceTemplate.user_id == customer_id
    ).first()
    
    if not voice_template or not voice_template.embedding_data:
        raise HTTPException(
            status_code=400,
            detail="User has not enrolled for voice authentication"
        )
    
    # 3. Process Challenge Audio (STRICT checks)
    try:
        result = await voice_processor.process_audio(
            file,
            perform_quality_check=True,
            perform_liveness_check=True,
            perform_ai_detection=True,
            ai_detection_strict_mode=True  # Maximum strictness for challenges
        )
        
        if not result["success"]:
            error_msg = result.get("error", "Audio validation failed")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Challenge audio validation failed: {error_msg}"
            )
        
        incoming_embedding = result["embedding"]
        ai_detection_metrics = result.get("ai_detection_metrics", {})
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Error processing challenge audio: {str(e)}"
        )
    
    # 4. Verify Voice
    try:
        stored_embedding = pickle.loads(voice_template.embedding_data)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail="Voice template corrupted. Please re-enroll."
        )
    
    is_verified, ensemble_score, verification_metrics = voice_processor.verify_voice_ensemble(
        incoming_embedding,
        stored_embedding,
        use_strict_threshold=True  # Use strict threshold for challenges
    )
    
    # 5. Enhanced Decision for Challenge Response
    ai_score = ai_detection_metrics.get("ai_probability", 0.0)
    
    decision_result = decision_engine.evaluate(
        user_id=customer_id,
        asv_score=ensemble_score,
        ai_probability=ai_score,
        ai_flags=ai_detection_metrics.get("flags", []),
        metadata={"challenge_response": True},
        is_enrollment=False
    )
    
    # Mark challenge as used
    challenge_manager.mark_used(challenge_id)
    
    # 6. Log Challenge Verification
    log = VerificationLog(
        user_id=customer_id,
        order_id=order_id,
        verification_type="voice_challenge",
        success=is_verified and decision_result.decision == DecisionType.ACCEPT,
        confidence_score=ensemble_score,
        ai_detected=not ai_detection_metrics.get("is_human", True),
        ai_detection_score=ai_score,
        ip_address="0.0.0.0",  # TODO: Get from request
        device_info="challenge_response"
    )
    db.add(log)
    db.commit()
    
    # 7. Determine Final Result
    challenge_passed = (
        is_verified and 
        decision_result.decision == DecisionType.ACCEPT and
        ai_score < 0.35  # Extra strict for challenges
    )
    
    if challenge_passed:
        message = f"✓ Challenge passed! Voice verified with {ensemble_score:.1%} confidence"
    else:
        if not is_verified:
            message = f"✗ Challenge failed: Voice did not match (Score: {ensemble_score:.1%})"
        elif decision_result.decision != DecisionType.ACCEPT:
            message = f"✗ Challenge failed: {decision_result.reason}"
        else:
            message = f"✗ Challenge failed: AI detection flagged (AI probability: {ai_score:.1%})"
    
    logger.info(f"Challenge {challenge_id} result: Passed={challenge_passed}, "
               f"Ensemble={ensemble_score:.3f}, AI={ai_score:.3f}")
    
    return ChallengeVerifyResponse(
        success=True,
        verified=is_verified,
        challenge_passed=challenge_passed,
        confidence_score=ensemble_score,
        ai_detected=not ai_detection_metrics.get("is_human", True),
        message=message,
        decision=decision_result.decision.value,
        risk_level=decision_result.risk_level.value
    )
