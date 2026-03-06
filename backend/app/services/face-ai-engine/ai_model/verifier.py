"""
Main Verification Engine
Combines face (ArcFace) and voice (WavLM) scores with configurable
weights to produce a final SAME / DIFFERENT verdict with confidence level.
"""

import logging
from typing import TypedDict
from .face_verifier import compare_faces, compare_faces_mixed
from .voice_verifier import compare_voices, compare_voice_with_reference_audio, extract_audio, extract_audio_from_file

logger = logging.getLogger(__name__)

# ── Tunable constants ───────────────────────────────────────────────────────
FACE_WEIGHT = 0.55             # Weight for face score in combined decision
VOICE_WEIGHT = 0.45            # Weight for voice score — critical for security

COMBINED_MATCH_THRESHOLD = 0.62  # Combined score to call SAME PERSON
HIGH_CONFIDENCE_THRESHOLD = 0.80  # Above this = HIGH confidence
LOW_CONFIDENCE_THRESHOLD = 0.50   # Below this = LOW confidence

# If voice is unavailable, fall back to face-only with STRICTER threshold
FACE_ONLY_THRESHOLD = 0.68

# ── Individual score gates (both must pass for SAME PERSON) ─────────────────
# Even if the combined score is above threshold, if either individual
# score is below its gate, the verdict is DIFFERENT PERSON.
# This prevents one strong modality from compensating a weak one.
# Stricter gates for critical security applications.
FACE_MIN_GATE = 0.50            # Face score must be at least this to match
VOICE_MIN_GATE = 0.40           # Voice score must be at least this (when available)


# ── Result type ───────────────────────────────────────────────────────────────

class VerificationResult(TypedDict):
    match: bool
    face_score: float
    voice_score: float
    combined_score: float
    confidence: str          # "HIGH" | "MEDIUM" | "LOW"
    face_available: bool
    voice_available: bool
    verdict: str             # "SAME PERSON" | "DIFFERENT PERSON"


# ── Main verify function ──────────────────────────────────────────────────────

def verify(
    video1_path: str,
    video2_path: str,
    live_audio_path: str = None,
    reference_audio_path: str = None,
) -> VerificationResult:
    """
    Full pipeline: extract face + voice from both videos, compare, decide.

    When separate audio files are provided (live_audio_path, reference_audio_path),
    they are used for voice comparison instead of extracting audio from the videos.
    This ensures voice is always captured even when the browser's MediaRecorder
    fails to include audio in the video file.

    Algorithm:
      combined_score = (face_score × FACE_WEIGHT) + (voice_score × VOICE_WEIGHT)
      If voice unavailable → use face_score alone with FACE_ONLY_THRESHOLD
      match = combined_score >= COMBINED_MATCH_THRESHOLD

    Args:
        video1_path: Reference footage path
        video2_path: New/live footage path
        live_audio_path: Optional separate audio file for live submission
        reference_audio_path: Optional separate audio file for reference

    Returns:
        VerificationResult dict with all scores and final verdict
    """
    logger.info(f"Starting verification: {video1_path} vs {video2_path}"
                f"{' (live_audio=' + live_audio_path + ')' if live_audio_path else ''}"
                f"{' (ref_audio=' + reference_audio_path + ')' if reference_audio_path else ''}")

    # ── Face comparison ──────────────────────────────────────────────────────
    try:
        face_score = compare_faces(video1_path, video2_path)
        face_available = face_score > 0.0
    except Exception as e:
        logger.error(f"Face comparison failed: {e}")
        face_score = 0.0
        face_available = False

    # ── Voice comparison ─────────────────────────────────────────────────────
    # Strategy: Use separate audio files when available, fall back to
    # extracting from video. This handles the browser audio recording issue.
    try:
        voice_score = 0.0
        voice_available = False

        # Determine audio sources — prefer separate audio files
        ref_has_separate_audio = reference_audio_path and __import__('os').path.isfile(reference_audio_path)
        live_has_separate_audio = live_audio_path and __import__('os').path.isfile(live_audio_path)

        if ref_has_separate_audio or live_has_separate_audio:
            # At least one separate audio file — use dedicated extraction
            import os

            # Extract reference audio
            if ref_has_separate_audio:
                ref_audio, ref_dur = extract_audio_from_file(reference_audio_path)
                logger.info(f"Reference audio from separate file: {ref_dur:.2f}s")
            else:
                ref_audio, ref_dur = extract_audio(video1_path)
                logger.info(f"Reference audio from video: {ref_dur:.2f}s")

            # Extract live audio
            if live_has_separate_audio:
                live_audio, live_dur = extract_audio_from_file(live_audio_path)
                logger.info(f"Live audio from separate file: {live_dur:.2f}s")
            else:
                live_audio, live_dur = extract_audio(video2_path)
                logger.info(f"Live audio from video: {live_dur:.2f}s")

            if ref_audio is not None and live_audio is not None:
                from .voice_verifier import _compare_audio_arrays
                voice_score = _compare_audio_arrays(ref_audio, live_audio)
                voice_available = voice_score > 0.0
            else:
                logger.warning(f"Audio extraction failed: ref={ref_dur:.2f}s, live={live_dur:.2f}s")
        else:
            # No separate audio — fall back to extracting from videos
            voice_score = compare_voices(video1_path, video2_path)
            voice_available = voice_score > 0.0

    except Exception as e:
        logger.error(f"Voice comparison failed: {e}")
        voice_score = 0.0
        voice_available = False

    # ── Combined decision ─────────────────────────────────────────────────────
    if face_available and voice_available:
        combined_score = (face_score * FACE_WEIGHT) + (voice_score * VOICE_WEIGHT)
        threshold = COMBINED_MATCH_THRESHOLD
    elif face_available:
        # No audio — rely on face alone with tighter threshold
        combined_score = face_score
        threshold = FACE_ONLY_THRESHOLD
        logger.info("Voice unavailable — using face-only decision")
    else:
        # Cannot verify at all
        combined_score = 0.0
        threshold = COMBINED_MATCH_THRESHOLD
        logger.warning("Both face and voice unavailable — cannot verify")

    combined_score = round(combined_score, 4)

    # ── Individual score gates ────────────────────────────────────────────────
    # Even if combined is high, reject if an individual modality is too weak.
    # This prevents a strong voice from compensating for a weak face (or vice versa).
    gated_out = False
    if face_available and face_score < FACE_MIN_GATE:
        logger.info(f"Face score {face_score:.4f} below gate {FACE_MIN_GATE} — rejecting match")
        gated_out = True
    if voice_available and voice_score < VOICE_MIN_GATE:
        logger.info(f"Voice score {voice_score:.4f} below gate {VOICE_MIN_GATE} — rejecting match")
        gated_out = True

    match = (combined_score >= threshold) and not gated_out

    # ── Confidence level ──────────────────────────────────────────────────────
    if combined_score >= HIGH_CONFIDENCE_THRESHOLD:
        confidence = "HIGH"
    elif combined_score >= LOW_CONFIDENCE_THRESHOLD:
        confidence = "MEDIUM"
    else:
        confidence = "LOW"

    result: VerificationResult = {
        "match": match,
        "face_score": round(face_score, 4),
        "voice_score": round(voice_score, 4),
        "combined_score": combined_score,
        "confidence": confidence,
        "face_available": face_available,
        "voice_available": voice_available,
        "verdict": "SAME PERSON" if match else "DIFFERENT PERSON",
    }

    logger.info(f"Verification result: {result}")
    return result


def verify_mixed(image_path: str, live_video_path: str) -> VerificationResult:
    """
    Verify when the reference is an IMAGE and the live submission is a VIDEO.
    Only face comparison is possible (images have no audio).
    Voice from the live video is compared against nothing → voice_available=False.

    Uses face-only threshold with the same decision logic.
    """
    logger.info(f"Starting mixed verification (image ref): {image_path} vs {live_video_path}")

    # ── Face comparison (image vs video) ─────────────────────────────────────
    try:
        face_score = compare_faces_mixed(image_path, live_video_path)
        face_available = face_score > 0.0
    except Exception as e:
        logger.error(f"Face comparison (mixed) failed: {e}")
        face_score = 0.0
        face_available = False

    # Voice is unavailable — reference image has no audio
    voice_score = 0.0
    voice_available = False
    logger.info("Reference is image — voice comparison skipped (no audio in reference)")

    # ── Decision (face-only) ─────────────────────────────────────────────────
    combined_score = round(face_score, 4)
    threshold = FACE_ONLY_THRESHOLD

    gated_out = False
    if face_available and face_score < FACE_MIN_GATE:
        logger.info(f"Face score {face_score:.4f} below gate {FACE_MIN_GATE} — rejecting match")
        gated_out = True

    match = (combined_score >= threshold) and not gated_out

    if combined_score >= HIGH_CONFIDENCE_THRESHOLD:
        confidence = "HIGH"
    elif combined_score >= LOW_CONFIDENCE_THRESHOLD:
        confidence = "MEDIUM"
    else:
        confidence = "LOW"

    result: VerificationResult = {
        "match": match,
        "face_score": round(face_score, 4),
        "voice_score": 0.0,
        "combined_score": combined_score,
        "confidence": confidence,
        "face_available": face_available,
        "voice_available": False,
        "verdict": "SAME PERSON" if match else "DIFFERENT PERSON",
    }

    logger.info(f"Mixed verification result: {result}")
    return result
