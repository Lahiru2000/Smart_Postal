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
    Convert a shipment's video_url (e.g. '/uploads/shipments/abc.mp4')
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
):
    """
    Background task: compare two videos using the AI engine and store results.

    Args:
        verification_link_id: ID of the VerificationLink record to update
        reference_video_url: The shipment's video_url (relative URL)
        live_video_path: Absolute path to the customer's live verification video
        db_session_factory: Callable that returns a new DB session
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
        )

        # Run the AI engine
        from .ai_model.verifier import verify

        result = verify(reference_path, live_video_path)

        # Store results
        vlink.ai_match = result["match"]
        vlink.face_score = result["face_score"]
        vlink.voice_score = result["voice_score"]
        vlink.combined_score = result["combined_score"]
        vlink.confidence = result["confidence"]
        vlink.verdict = result["verdict"]
        vlink.face_available = result["face_available"]
        vlink.voice_available = result["voice_available"]
        vlink.ai_error = None
        vlink.status = "verified"
        db.commit()

        logger.info(
            f"AI verification complete (link {verification_link_id}): "
            f"verdict={result['verdict']}, confidence={result['confidence']}, "
            f"combined={result['combined_score']:.4f}"
        )

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
