"""
Speaker embedding extraction using Resemblyzer.

Uses a pretrained neural speaker encoder (GE2E loss) to produce 256-dimensional
speaker identity embeddings. These embeddings capture the unique vocal characteristics
of a speaker — vocal tract shape, pitch habits, speaking style — making them
highly discriminative for speaker verification.

This follows the same approach as the reference banking-grade voice processor.
"""
import os
import asyncio
import logging
import subprocess
from typing import List, Optional, Tuple, Dict

import numpy as np
import librosa
from resemblyzer import VoiceEncoder

from app.services.audio_utils import save_temp_file, get_file_extension, cleanup_temp_files

logger = logging.getLogger(__name__)

# ── Singleton Voice Encoder ──────────────────────────────────

_encoder: Optional[VoiceEncoder] = None
_encoder_error: Optional[str] = None


def _get_encoder() -> VoiceEncoder:
    """Lazy-load the VoiceEncoder singleton."""
    global _encoder, _encoder_error
    if _encoder is not None:
        return _encoder
    if _encoder_error is not None:
        raise RuntimeError(_encoder_error)
    try:
        logger.info("Loading Resemblyzer voice encoder model...")
        _encoder = VoiceEncoder("cpu")
        logger.info("Voice encoder model loaded successfully.")
        return _encoder
    except Exception as e:
        _encoder_error = f"Failed to load voice encoder: {e}"
        logger.error(_encoder_error)
        raise RuntimeError(_encoder_error)


# ── Audio Normalization ──────────────────────────────────────

def _normalize_to_wav(source_path: str) -> tuple:
    """Convert to mono 16 kHz WAV if needed. Returns (wav_path, is_temp)."""
    if source_path.lower().endswith(".wav"):
        return source_path, False
    out_path = source_path + ".speaker.wav"
    try:
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", source_path,
                "-ar", "16000", "-ac", "1", "-acodec", "pcm_s16le", out_path,
            ],
            capture_output=True, check=True, timeout=30,
        )
        return out_path, True
    except Exception as e:
        raise RuntimeError(f"ffmpeg conversion failed: {e}")


# ── Core Embedding Extraction ────────────────────────────────

def _extract_embedding(audio_path: str) -> np.ndarray:
    """
    Extract a 256-dim speaker embedding from an audio file using Resemblyzer.

    Steps:
        1. Load and normalize audio to 16 kHz mono float32
        2. Check minimum duration
        3. Run through the pretrained speaker encoder
        4. Return L2-normalized 256-dim embedding
    """
    wav_path, is_temp = _normalize_to_wav(audio_path)
    try:
        # Load audio as float32, mono, 16 kHz
        audio, sr = librosa.load(wav_path, sr=16000, mono=True)

        duration = len(audio) / sr
        if duration < 1.0:
            raise ValueError(f"Audio too short ({duration:.1f}s). Need at least 1 second.")
        if duration > 30.0:
            # Trim to first 30 seconds
            audio = audio[: 30 * sr]

        encoder = _get_encoder()
        embedding = encoder.embed_utterance(audio)

        # L2-normalize (resemblyzer already does this, but be safe)
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm

        logger.info(f"Extracted speaker embedding: shape={embedding.shape}, duration={duration:.1f}s")
        return embedding
    finally:
        if is_temp and os.path.exists(wav_path):
            try:
                os.remove(wav_path)
            except Exception:
                pass


async def extract_speaker_embedding(
    audio_bytes: bytes, filename: str = "audio.mp3",
) -> List[float]:
    """
    Async entry point: save audio to temp file, extract 256-dim speaker embedding.

    Returns a plain Python list of floats (JSON-serializable for DB storage).
    """
    ext = get_file_extension(filename) or ".mp3"
    temp_path = save_temp_file(audio_bytes, ext, prefix="speaker_")
    try:
        embedding = await asyncio.to_thread(_extract_embedding, temp_path)
        return embedding.tolist()
    finally:
        cleanup_temp_files(temp_path)


# ── Speaker Verification ─────────────────────────────────────

def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Compute cosine similarity between two embedding vectors."""
    a = np.array(vec_a, dtype=np.float64)
    b = np.array(vec_b, dtype=np.float64)

    if a.shape != b.shape or a.size == 0:
        return 0.0

    dot = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)

    if norm_a < 1e-8 or norm_b < 1e-8:
        return 0.0

    return float(np.clip(dot / (norm_a * norm_b), -1.0, 1.0))


def centroid(vectors: List[List[float]]) -> List[float]:
    """Compute the centroid (average) of multiple speaker embeddings."""
    if not vectors:
        return []
    arr = np.array(vectors, dtype=np.float64)
    avg = np.mean(arr, axis=0)
    # L2-normalize the centroid
    norm = np.linalg.norm(avg)
    if norm > 0:
        avg = avg / norm
    return avg.tolist()


def compare_enrollment_samples(
    new_vector: List[float],
    existing_vectors: List[List[float]],
    threshold: float = 0.75,
) -> dict:
    """
    Compare a new enrollment sample against previously submitted samples.
    Ensures all samples come from the same speaker.

    Returns:
        match (bool): Whether the speaker matches across samples.
        similarity (float): Cosine similarity to the centroid.
    """
    if not existing_vectors:
        return {"match": True, "similarity": 1.0}

    center = centroid(existing_vectors)
    sim = cosine_similarity(new_vector, center)

    logger.info(f"Cross-enrollment similarity: {sim:.4f} (threshold={threshold})")

    return {
        "match": sim >= threshold,
        "similarity": round(sim, 4),
    }


def verify_speaker(
    verification_vector: List[float],
    profile_vector: List[float],
    threshold: float = 0.75,
) -> dict:
    """
    Verify a voice sample against a stored voice profile using Resemblyzer embeddings.

    This follows the same approach as the reference banking-grade system:
    cosine similarity between the incoming embedding and the enrolled profile centroid.

    Returns:
        match (bool): Whether the speaker matches.
        similarity (float): Cosine similarity score.
    """
    if not verification_vector or not profile_vector:
        logger.warning("Empty speaker vector — cannot verify")
        return {"match": False, "similarity": 0.0}

    if len(verification_vector) != len(profile_vector):
        logger.warning(
            f"Vector dimension mismatch: verification={len(verification_vector)}, "
            f"profile={len(profile_vector)}. Customer may need to re-enroll."
        )
        return {"match": False, "similarity": 0.0}

    sim = cosine_similarity(verification_vector, profile_vector)

    logger.info(f"Speaker verification similarity: {sim:.4f} (threshold={threshold})")

    return {
        "match": sim >= threshold,
        "similarity": round(sim, 4),
    }


# Embedding dimension constant for validation
SPEAKER_EMBEDDING_DIM = 256
