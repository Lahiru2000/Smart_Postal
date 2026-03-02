"""
Speaker verification — lightweight vector-based speaker matching.
Compares voice samples across enrollment and verification using spectral/prosodic features.
"""
import math
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)


def _clamp(value: float, lower: float = 0.0, upper: float = 1.0) -> float:
    return max(lower, min(upper, value))


def build_voice_vector(spectral_result: dict, prosodic_result: dict) -> List[float]:
    """
    Build a compact voice feature vector from analysis results.
    Used for speaker comparison across samples.
    """
    s_details = spectral_result.get("details", {})
    p_details = prosodic_result.get("details", {})

    return [
        s_details.get("dynamic_ratio", 0.0),
        s_details.get("smoothness_ratio", 0.0),
        s_details.get("clip_ratio", 0.0),
        s_details.get("energy_cv", 0.0),
        p_details.get("pause_ratio", 0.0),
        p_details.get("bursts_per_second", 0.0),
        p_details.get("rhythm_regularity", 0.5),
        p_details.get("energy_cv", 0.0),
    ]


def cosine_similarity(vector_a: List[float], vector_b: List[float]) -> float:
    """Compute cosine similarity between two vectors."""
    if len(vector_a) != len(vector_b) or not vector_a:
        return 0.0

    dot = sum(a * b for a, b in zip(vector_a, vector_b))
    mag_a = math.sqrt(sum(a * a for a in vector_a))
    mag_b = math.sqrt(sum(b * b for b in vector_b))

    if mag_a < 1e-8 or mag_b < 1e-8:
        return 0.0

    return _clamp(dot / (mag_a * mag_b), -1.0, 1.0)


def centroid(vectors: List[List[float]]) -> List[float]:
    """Compute the centroid (average) of multiple voice vectors."""
    if not vectors:
        return []
    dims = len(vectors[0])
    return [sum(v[d] for v in vectors) / len(vectors) for d in range(dims)]


def compare_samples(
    new_vector: List[float],
    existing_vectors: List[List[float]],
    threshold: float = 0.7,
) -> dict:
    """
    Compare a new voice sample against existing enrollment samples.
    
    Returns:
        match (bool): Whether the speaker matches.
        similarity (float): Average cosine similarity.
    """
    if not existing_vectors:
        return {"match": True, "similarity": 1.0}

    center = centroid(existing_vectors)
    sim = cosine_similarity(new_vector, center)

    return {
        "match": sim >= threshold,
        "similarity": round(sim, 4),
    }


def verify_speaker(
    verification_vector: List[float],
    profile_vector: List[float],
    threshold: float = 0.65,
) -> dict:
    """
    Verify a voice sample against a stored voice profile.
    
    Returns:
        match (bool): Whether the speaker matches.
        similarity (float): Cosine similarity score.
    """
    sim = cosine_similarity(verification_vector, profile_vector)
    return {
        "match": sim >= threshold,
        "similarity": round(sim, 4),
    }
