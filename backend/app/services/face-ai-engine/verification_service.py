"""
Verification Service — runs the AI face+voice comparison pipeline.

Called as a background task after a customer submits their verification video.
Compares the reference video (from shipment) with the live video (from verification link)
using ArcFace (face) and WavLM (voice), then stores the result in the database.
"""

import os
import logging
from sqlalchemy.orm import Session
from datetime import datetime

logger = logging.getLogger(__name__)


def _resolve_reference_video_path(video_url: str) -> str:
    """
    Convert a shipment's video_url or image_url (e.g. '/uploads/shipments/abc.mp4')
    to an absolute filesystem path.
    """
    app_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
    app_dir = os.path.normpath(app_dir)
    return os.path.join(app_dir, video_url.lstrip("/"))


def run_ai_verification(
    verification_link_id: int,
    reference_video_url: str,
    live_video_path: str,
    db_session_factory,
    reference_media_type: str = "video",
    live_audio_path: str = None,
    reference_audio_url: str = None,
):
    """
    Background task: compare reference media with live video using the AI engine.

    Args:
        verification_link_id: ID of the VerificationLink record to update
        reference_video_url: The shipment's video_url or image_url (relative URL)
        live_video_path: Absolute path to the customer's live verification video
        db_session_factory: Callable that returns a new DB session
        reference_media_type: 'video' or 'image' — determines which AI pipeline to use
        live_audio_path: Optional absolute path to separate live audio file
        reference_audio_url: Optional relative URL to separate reference audio file
    """
    db: Session = db_session_factory()

    try:
        from app.models.face_ai_engine.verification_link import VerificationLink

        vlink = db.query(VerificationLink).filter(
            VerificationLink.id == verification_link_id
        ).first()

        if not vlink:
            logger.error(f"VerificationLink {verification_link_id} not found")
            return

        # Mark as processing
        vlink.status = "processing"
        db.commit()

        # Resolve the reference video path
        reference_path = _resolve_reference_video_path(reference_video_url)

        if not os.path.isfile(reference_path):
            vlink.ai_error = f"Reference video not found: {reference_path}"
            vlink.status = "verified"
            db.commit()
            logger.error(f"Reference video not found: {reference_path}")
            return

        if not os.path.isfile(live_video_path):
            vlink.ai_error = f"Live video not found: {live_video_path}"
            vlink.status = "verified"
            db.commit()
            logger.error(f"Live video not found: {live_video_path}")
            return

        logger.info(
            f"Starting AI verification (link {verification_link_id}): "
            f"reference={reference_path} vs live={live_video_path}"
            f"{' + live_audio=' + live_audio_path if live_audio_path else ''}"
        )

        # Resolve reference audio path if provided
        reference_audio_path = None
        if reference_audio_url:
            reference_audio_path = _resolve_reference_video_path(reference_audio_url)
            if not os.path.isfile(reference_audio_path):
                logger.warning(f"Reference audio not found: {reference_audio_path}")
                reference_audio_path = None

        # Run the AI engine
        if reference_media_type == "image":
            from .ai_model.verifier import verify_mixed
            logger.info(f"Using image-based verification (face-only, no voice)")
            result = verify_mixed(reference_path, live_video_path)
        else:
            from .ai_model.verifier import verify
            result = verify(
                reference_path, live_video_path,
                live_audio_path=live_audio_path,
                reference_audio_path=reference_audio_path,
            )

        # Run liveness detection on live video frames
        liveness_passed = None
        liveness_score = None
        liveness_confidence = None
        try:
            import cv2
            from .ai_model.liveness_detector import check_liveness
            from .ai_model.face_verifier import extract_best_frames

            live_frames = extract_best_frames(live_video_path, n=10)
            if live_frames:
                liveness_result = check_liveness(live_frames)
                liveness_passed = liveness_result["is_live"]
                liveness_score = liveness_result["liveness_score"]
                liveness_confidence = liveness_result["confidence"]
                logger.info(
                    f"Video liveness check: passed={liveness_passed}, "
                    f"score={liveness_score:.4f}, confidence={liveness_confidence}"
                )

                # If liveness failed, override the match result
                if not liveness_passed:
                    result["match"] = False
                    result["verdict"] = "LIVENESS FAILED"
                    logger.warning(
                        f"Liveness check FAILED for link {verification_link_id}: "
                        f"{liveness_result['reason']}"
                    )
        except Exception as liveness_err:
            logger.warning(f"Liveness check error (non-fatal): {liveness_err}")

        # Store results
        vlink.ai_match = result["match"]
        vlink.face_score = result["face_score"]
        vlink.voice_score = result["voice_score"]
        vlink.combined_score = result["combined_score"]
        vlink.confidence = result["confidence"]
        vlink.verdict = result["verdict"]
        vlink.face_available = result["face_available"]
        vlink.voice_available = result["voice_available"]
        vlink.liveness_passed = liveness_passed
        vlink.liveness_score = liveness_score
        vlink.liveness_confidence = liveness_confidence
        vlink.ai_error = None
        vlink.status = "verified"
        db.commit()

        logger.info(
            f"AI verification complete (link {verification_link_id}): "
            f"verdict={result['verdict']}, confidence={result['confidence']}, "
            f"combined={result['combined_score']:.4f}"
        )

        # ── Auto-reverse shipment if verification FAILED ──────────────────
        if not result["match"]:
            try:
                from app.models.shipment import Shipment

                shipment = db.query(Shipment).filter(
                    Shipment.id == vlink.shipment_id
                ).first()
                if shipment and shipment.status not in ("Reversed", "Delivered"):
                    shipment.status = "Reversed"
                    db.commit()
                    logger.info(
                        f"Shipment {shipment.id} (TRK-{shipment.tracking_number}) "
                        f"auto-reversed due to failed identity verification"
                    )
            except Exception as rev_err:
                logger.error(f"Failed to auto-reverse shipment: {rev_err}")

    except Exception as e:
        logger.error(f"AI verification failed (link {verification_link_id}): {e}", exc_info=True)
        try:
            vlink = db.query(VerificationLink).filter(
                VerificationLink.id == verification_link_id
            ).first()
            if vlink:
                vlink.ai_error = str(e)[:500]
                vlink.status = "verified"  # Mark as done even on error
                db.commit()
        except Exception:
            pass
    finally:
        db.close()
