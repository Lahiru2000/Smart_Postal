"""
Main Verification Engine
Combines face (ArcFace) and voice (WavLM) scores with configurable
weights to produce a final SAME / DIFFERENT verdict with confidence level.
"""

import logging
from typing import TypedDict
from .face_verifier import compare_faces
from .voice_verifier import compare_voices

logger = logging.getLogger(__name__)

# ── Tunable constants ───────────────────────────────────────────────────────
FACE_WEIGHT = 0.70             # Weight for face score in combined decision
VOICE_WEIGHT = 0.30            # Weight for voice score in combined decision

COMBINED_MATCH_THRESHOLD = 0.62  # Combined score to call SAME PERSON
HIGH_CONFIDENCE_THRESHOLD = 0.82  # Above this = HIGH confidence
LOW_CONFIDENCE_THRESHOLD = 0.50   # Below this = LOW confidence

# If voice is unavailable, fall back to face-only with this threshold
FACE_ONLY_THRESHOLD = 0.62

# ── Individual score gates (both must pass for SAME PERSON) ─────────────────
# Even if the combined score is above threshold, if either individual
# score is below its gate, the verdict is DIFFERENT PERSON.
# This prevents one strong modality from compensating a weak one.
FACE_MIN_GATE = 0.55            # Face score must be at least this to match
VOICE_MIN_GATE = 0.25           # Voice score must be at least this (when available)


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

def verify(video1_path: str, video2_path: str) -> VerificationResult:
    """
    Full pipeline: extract face + voice from both videos, compare, decide.

    Algorithm:
      combined_score = (face_score × FACE_WEIGHT) + (voice_score × VOICE_WEIGHT)
      If voice unavailable → use face_score alone with FACE_ONLY_THRESHOLD
      match = combined_score >= COMBINED_MATCH_THRESHOLD

    Args:
        video1_path: Reference footage path
        video2_path: New/live footage path

    Returns:
        VerificationResult dict with all scores and final verdict
    """
    logger.info(f"Starting verification: {video1_path} vs {video2_path}")

    # ── Face comparison ──────────────────────────────────────────────────────
    try:
        face_score = compare_faces(video1_path, video2_path)
        face_available = face_score > 0.0
    except Exception as e:
        logger.error(f"Face comparison failed: {e}")
        face_score = 0.0
        face_available = False

    # ── Voice comparison ─────────────────────────────────────────────────────
    try:
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
