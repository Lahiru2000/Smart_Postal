"""
Ensemble score fusion.
Combines external AI detector score with local spectral & prosodic analysis
to produce a final AI-generated probability and decision.
"""
import logging

logger = logging.getLogger(__name__)


def _clamp(value: float, lower: float = 0.0, upper: float = 1.0) -> float:
    return max(lower, min(upper, value))


def fuse_detection_scores(
    external_score: float,
    external_confidence: float,
    spectral_score: float,
    spectral_confidence: float,
    prosodic_score: float,
    prosodic_confidence: float,
    external_available: bool = True,
) -> dict:
    """
    Weighted fusion with uncertainty and disagreement checks.

    When the external API is unavailable the local analyzers become the sole
    decision makers.  In that mode the system is *conservative*: it lowers the
    AI-detection threshold so suspicious audio is more likely to be rejected.

    Returns:
        ai_generated (bool), fused_score (float), confidence (float),
        message (str), risk_tier (str), decision_reason (str),
        step_up (bool), model_scores (dict).
    """

    if external_available:
        # Normal mode — external API has the most weight
        w_ext = 0.60 * external_confidence
        w_spec = 0.25 * spectral_confidence
        w_pros = 0.15 * prosodic_confidence
        total_w = w_ext + w_spec + w_pros
        if total_w < 0.01:
            total_w = 1.0
        fused = (
            external_score * w_ext +
            spectral_score * w_spec +
            prosodic_score * w_pros
        ) / total_w
    else:
        # Fallback — only local signals.  Re-weight so both local models
        # contribute fully, and add a conservative bias (+0.15) since we have
        # reduced observability.
        w_spec = 0.60 * max(spectral_confidence, 0.3)
        w_pros = 0.40 * max(prosodic_confidence, 0.3)
        total_w = w_spec + w_pros
        if total_w < 0.01:
            total_w = 1.0
        fused = (
            spectral_score * w_spec +
            prosodic_score * w_pros
        ) / total_w
        # Conservative bias when external detector is missing
        fused += 0.10
        logger.warning(
            "External AI detector unavailable — applying conservative bias. "
            "local fused=%.4f (spectral=%.4f, prosodic=%.4f)",
            fused, spectral_score, prosodic_score,
        )

    fused = _clamp(fused)

    # Disagreement detection (only meaningful when external is available)
    if external_available:
        scores = [external_score, spectral_score, prosodic_score]
    else:
        scores = [spectral_score, prosodic_score]
    max_diff = max(scores) - min(scores)
    disagreement = max_diff > 0.4

    # Uncertainty
    if external_available:
        avg_confidence = (external_confidence + spectral_confidence + prosodic_confidence) / 3
    else:
        avg_confidence = (spectral_confidence + prosodic_confidence) / 2
    high_uncertainty = avg_confidence < 0.4 or (not external_available)

    # Step-up flag: additional verification recommended
    step_up = False
    decision_reason = ""

    if not external_available:
        step_up = True
        decision_reason = "external_detector_unavailable"
    elif disagreement:
        step_up = True
        decision_reason = "model_disagreement"
    elif high_uncertainty:
        step_up = True
        decision_reason = "high_uncertainty"

    # Decision thresholds — lower the bar when external is missing
    ai_threshold_high = 0.60 if not external_available else 0.72
    ai_threshold_low = 0.30 if not external_available else 0.40

    if fused < ai_threshold_low:
        ai_generated = False
        risk_tier = "low"
        if not decision_reason:
            decision_reason = "low_fused_ai_probability"
        message = f"Voice appears human (ensemble confidence: {1-fused:.0%})"
    elif fused > ai_threshold_high:
        ai_generated = True
        risk_tier = "high"
        if not decision_reason:
            decision_reason = "high_confidence_ai_pattern"
        message = f"AI-generated voice likely (ensemble confidence: {fused:.0%})"
    else:
        ai_generated = fused >= 0.55
        risk_tier = "medium"
        step_up = True
        if not decision_reason:
            decision_reason = "borderline_or_uncertain_detection"
        message = (
            f"Voice analysis is inconclusive. Additional verification is required "
            f"(AI probability: {fused:.0%})"
        )

    confidence = _clamp(1.0 - (max_diff * 0.5) - (0.3 if high_uncertainty else 0))

    return {
        "ai_generated": ai_generated,
        "fused_score": round(fused, 4),
        "confidence": round(confidence, 4),
        "message": message,
        "risk_tier": risk_tier,
        "decision_reason": decision_reason,
        "step_up": step_up,
        "model_scores": {
            "external": {"score": external_score, "confidence": external_confidence},
            "spectral": {"score": spectral_score, "confidence": spectral_confidence},
            "prosodic": {"score": prosodic_score, "confidence": prosodic_confidence},
        },
    }
