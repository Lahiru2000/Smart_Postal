"""
Speaker embedding extraction using Resemblyzer + supplementary acoustic features.

Uses a pretrained neural speaker encoder (GE2E loss) to produce 256-dimensional
speaker identity embeddings, combined with MFCC/pitch-based acoustic features
for improved discrimination between similar speakers (e.g. siblings).

Verification uses multi-probe scoring (comparing against each individual
enrollment sample) and dual-score fusion (neural embeddings + MFCC features)
with adaptive thresholds derived from enrollment consistency.
"""
import os
import asyncio
import logging
import subprocess
from typing import List, Optional, Tuple, Dict, Any

import numpy as np
import librosa
from resemblyzer import VoiceEncoder

from app.services.audio_utils import save_temp_file, get_file_extension, cleanup_temp_files

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────

SPEAKER_EMBEDDING_DIM = 256
MFCC_FEATURE_DIM = 47          # 20 MFCCs + 20 deltas + 4 pitch + 3 spectral

# Thresholds (raised from 0.75 to reject similar-sounding relatives)
BASE_EMBEDDING_THRESHOLD = 0.82
BASE_MFCC_THRESHOLD = 0.78
MIN_PROBE_THRESHOLD = 0.78      # Worst single-sample match must exceed this


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


def _load_audio(audio_path: str) -> Tuple[np.ndarray, int]:
    """Load and normalize audio to 16 kHz mono float32."""
    wav_path, is_temp = _normalize_to_wav(audio_path)
    try:
        audio, sr = librosa.load(wav_path, sr=16000, mono=True)
        duration = len(audio) / sr
        if duration < 1.0:
            raise ValueError(f"Audio too short ({duration:.1f}s). Need at least 1 second.")
        if duration > 30.0:
            audio = audio[: 30 * sr]
        return audio, sr
    finally:
        if is_temp and os.path.exists(wav_path):
            try:
                os.remove(wav_path)
            except Exception:
                pass


# ── Supplementary MFCC / Pitch Features ─────────────────────

def _extract_mfcc_features(audio: np.ndarray, sr: int = 16000) -> np.ndarray:
    """
    Extract a 47-dim supplementary acoustic feature vector:
      - 20 MFCCs (mean across time)
      - 20 MFCC deltas (mean across time)  — captures temporal dynamics
      - 4 pitch stats (F0 mean, std, min, max)
      - 1 spectral centroid mean
      - 1 spectral rolloff mean
      - 1 zero-crossing rate mean
    
    These features capture vocal tract resonances, pitch habits, and speaking
    dynamics that are highly speaker-specific and differ between relatives.
    """
    # MFCCs and deltas
    mfccs = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=20)
    mfcc_mean = np.mean(mfccs, axis=1)                        # (20,)
    mfcc_delta = librosa.feature.delta(mfccs)
    mfcc_delta_mean = np.mean(mfcc_delta, axis=1)             # (20,)

    # Pitch (F0) via pyin
    f0, voiced_flag, _ = librosa.pyin(
        audio, fmin=librosa.note_to_hz("C2"), fmax=librosa.note_to_hz("C7"), sr=sr,
    )
    f0_voiced = f0[voiced_flag] if voiced_flag is not None else f0[~np.isnan(f0)]
    if len(f0_voiced) < 2:
        f0_voiced = np.array([150.0, 150.0])
    pitch_stats = np.array([
        np.mean(f0_voiced),
        np.std(f0_voiced),
        np.min(f0_voiced),
        np.max(f0_voiced),
    ])                                                         # (4,)

    # Spectral shape features
    spec_centroid = np.mean(librosa.feature.spectral_centroid(y=audio, sr=sr))
    spec_rolloff = np.mean(librosa.feature.spectral_rolloff(y=audio, sr=sr))
    zcr = np.mean(librosa.feature.zero_crossing_rate(y=audio))
    spectral_feats = np.array([spec_centroid, spec_rolloff, zcr])  # (3,)

    features = np.concatenate([mfcc_mean, mfcc_delta_mean, pitch_stats, spectral_feats])

    # L2-normalize
    norm = np.linalg.norm(features)
    if norm > 0:
        features = features / norm

    return features  # (47,)


# ── Core Embedding Extraction ────────────────────────────────

def _extract_embedding(audio_path: str) -> np.ndarray:
    """Extract a 256-dim speaker embedding from an audio file using Resemblyzer."""
    audio, sr = _load_audio(audio_path)
    encoder = _get_encoder()
    embedding = encoder.embed_utterance(audio)

    # L2-normalize
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm

    logger.info(f"Extracted speaker embedding: shape={embedding.shape}, duration={len(audio)/sr:.1f}s")
    return embedding


def _extract_full_voiceprint(audio_path: str) -> Dict[str, Any]:
    """
    Extract both the neural speaker embedding and supplementary MFCC features
    from a single audio file.

    Returns dict with 'embedding' (256-dim) and 'mfcc' (47-dim).
    """
    audio, sr = _load_audio(audio_path)

    # Neural embedding
    encoder = _get_encoder()
    embedding = encoder.embed_utterance(audio)
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm

    # Supplementary features
    mfcc_feats = _extract_mfcc_features(audio, sr)

    logger.info(
        f"Extracted full voiceprint: embedding={embedding.shape}, "
        f"mfcc={mfcc_feats.shape}, duration={len(audio)/sr:.1f}s"
    )
    return {
        "embedding": embedding,
        "mfcc": mfcc_feats,
    }


async def extract_speaker_embedding(
    audio_bytes: bytes, filename: str = "audio.mp3",
) -> List[float]:
    """
    Async entry point: extract 256-dim speaker embedding.
    Returns a plain list of floats (backward-compatible).
    """
    ext = get_file_extension(filename) or ".mp3"
    temp_path = save_temp_file(audio_bytes, ext, prefix="speaker_")
    try:
        embedding = await asyncio.to_thread(_extract_embedding, temp_path)
        return embedding.tolist()
    finally:
        cleanup_temp_files(temp_path)


async def extract_full_voiceprint(
    audio_bytes: bytes, filename: str = "audio.mp3",
) -> Dict[str, List[float]]:
    """
    Async entry point: extract both neural embedding and MFCC features.
    Returns dict with 'embedding' (list[float]) and 'mfcc' (list[float]).
    """
    ext = get_file_extension(filename) or ".mp3"
    temp_path = save_temp_file(audio_bytes, ext, prefix="speaker_")
    try:
        result = await asyncio.to_thread(_extract_full_voiceprint, temp_path)
        return {
            "embedding": result["embedding"].tolist(),
            "mfcc": result["mfcc"].tolist(),
        }
    finally:
        cleanup_temp_files(temp_path)


# ── Similarity Helpers ───────────────────────────────────────

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
    """Compute the L2-normalized centroid of multiple embedding vectors."""
    if not vectors:
        return []
    arr = np.array(vectors, dtype=np.float64)
    avg = np.mean(arr, axis=0)
    norm = np.linalg.norm(avg)
    if norm > 0:
        avg = avg / norm
    return avg.tolist()


def _compute_enrollment_tightness(vectors: List[List[float]]) -> float:
    """
    Measure how consistent the enrollment samples are with each other.
    Returns the minimum pairwise cosine similarity among all samples.
    
    A high value (e.g. 0.95) means the user's voice is very consistent,
    allowing a tighter adaptive threshold for better security.
    """
    if len(vectors) < 2:
        return 1.0
    min_sim = 1.0
    for i in range(len(vectors)):
        for j in range(i + 1, len(vectors)):
            sim = cosine_similarity(vectors[i], vectors[j])
            min_sim = min(min_sim, sim)
    return min_sim


# ── Enrollment Helpers ───────────────────────────────────────

def compare_enrollment_samples(
    new_vector: List[float],
    existing_vectors: List[List[float]],
    threshold: float = BASE_EMBEDDING_THRESHOLD,
) -> dict:
    """
    Compare a new enrollment sample against previously submitted samples.
    Ensures all samples come from the same speaker.
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


def build_enriched_profile(
    sample_embeddings: List[List[float]],
    sample_mfccs: List[List[float]],
) -> Dict[str, Any]:
    """
    Build an enriched voice profile from enrollment samples.
    
    Stores individual sample vectors (for multi-probe verification),
    centroids, and enrollment tightness (for adaptive thresholds).
    """
    emb_centroid = centroid(sample_embeddings)
    mfcc_centroid = centroid(sample_mfccs) if sample_mfccs else []

    tightness = _compute_enrollment_tightness(sample_embeddings)
    mfcc_tightness = _compute_enrollment_tightness(sample_mfccs) if len(sample_mfccs) >= 2 else 1.0

    # Adaptive threshold: tighter enrollment → higher threshold  
    # Base 0.82, boosted up to 0.87 for very consistent voices
    adaptive_threshold = BASE_EMBEDDING_THRESHOLD + max(0.0, (tightness - 0.85)) * 0.5
    adaptive_threshold = min(adaptive_threshold, 0.90)

    profile = {
        "version": 2,
        "centroid": emb_centroid,
        "samples": sample_embeddings,
        "mfcc_centroid": mfcc_centroid,
        "mfcc_samples": sample_mfccs,
        "enrollment_tightness": round(tightness, 4),
        "mfcc_tightness": round(mfcc_tightness, 4),
        "adaptive_threshold": round(adaptive_threshold, 4),
    }

    logger.info(
        f"Built enriched profile: {len(sample_embeddings)} samples, "
        f"tightness={tightness:.4f}, adaptive_threshold={adaptive_threshold:.4f}"
    )
    return profile


# ── Speaker Verification ─────────────────────────────────────

def verify_speaker(
    verification_vector: List[float],
    profile_data: Any,
    verification_mfcc: Optional[List[float]] = None,
) -> dict:
    """
    Verify a voice sample against a stored voice profile.

    Supports two profile formats:
      - Legacy (v1): plain list of 256 floats (centroid only, single cosine check)
      - Enriched (v2): dict with centroid, individual samples, MFCC features,
        and adaptive thresholds

    For v2 profiles, verification uses:
      1. Centroid similarity — must exceed adaptive threshold
      2. Multi-probe — similarity to each enrollment sample; worst must exceed MIN_PROBE_THRESHOLD
      3. MFCC cross-check — supplementary feature similarity must exceed MFCC threshold
      4. Final decision requires ALL checks to pass
    """
    if not verification_vector or not profile_data:
        logger.warning("Empty speaker vector — cannot verify")
        return {"match": False, "similarity": 0.0, "details": "empty_vector"}

    # ── Legacy v1 profile (plain list of floats) ──
    if isinstance(profile_data, list):
        if len(verification_vector) != len(profile_data):
            logger.warning(
                f"Vector dimension mismatch: verification={len(verification_vector)}, "
                f"profile={len(profile_data)}. Customer may need to re-enroll."
            )
            return {"match": False, "similarity": 0.0, "details": "dimension_mismatch"}

        sim = cosine_similarity(verification_vector, profile_data)
        logger.info(f"Speaker verification (legacy v1): similarity={sim:.4f} (threshold={BASE_EMBEDDING_THRESHOLD})")
        return {
            "match": sim >= BASE_EMBEDDING_THRESHOLD,
            "similarity": round(sim, 4),
            "details": "legacy_v1_centroid_only",
        }

    # ── Enriched v2 profile (dict with samples, MFCC, adaptive thresholds) ──
    if not isinstance(profile_data, dict) or profile_data.get("version") != 2:
        logger.warning("Unknown profile format — treating as legacy")
        return {"match": False, "similarity": 0.0, "details": "unknown_format"}

    profile_centroid = profile_data.get("centroid", [])
    profile_samples = profile_data.get("samples", [])
    mfcc_centroid = profile_data.get("mfcc_centroid", [])
    adaptive_threshold = profile_data.get("adaptive_threshold", BASE_EMBEDDING_THRESHOLD)

    # 1. Centroid similarity
    centroid_sim = cosine_similarity(verification_vector, profile_centroid)
    centroid_pass = centroid_sim >= adaptive_threshold

    # 2. Multi-probe: check against each individual enrollment sample
    probe_sims = [cosine_similarity(verification_vector, s) for s in profile_samples]
    min_probe_sim = min(probe_sims) if probe_sims else 0.0
    avg_probe_sim = float(np.mean(probe_sims)) if probe_sims else 0.0
    probe_pass = min_probe_sim >= MIN_PROBE_THRESHOLD

    # 3. MFCC cross-check (supplementary signal)
    mfcc_sim = 0.0
    mfcc_pass = True  # Default to pass if no MFCC data available
    if verification_mfcc and mfcc_centroid and len(verification_mfcc) == len(mfcc_centroid):
        mfcc_sim = cosine_similarity(verification_mfcc, mfcc_centroid)
        mfcc_pass = mfcc_sim >= BASE_MFCC_THRESHOLD

        # Also check against individual MFCC samples
        mfcc_samples = profile_data.get("mfcc_samples", [])
        if mfcc_samples:
            mfcc_probe_sims = [cosine_similarity(verification_mfcc, ms) for ms in mfcc_samples]
            min_mfcc_probe = min(mfcc_probe_sims)
            mfcc_pass = mfcc_pass and min_mfcc_probe >= (BASE_MFCC_THRESHOLD - 0.05)

    # Final decision: ALL checks must pass
    match = centroid_pass and probe_pass and mfcc_pass

    # Use centroid_sim as the primary reported similarity
    primary_sim = centroid_sim

    details = {
        "centroid_similarity": round(centroid_sim, 4),
        "centroid_threshold": round(adaptive_threshold, 4),
        "centroid_pass": centroid_pass,
        "min_probe_similarity": round(min_probe_sim, 4),
        "avg_probe_similarity": round(avg_probe_sim, 4),
        "probe_threshold": MIN_PROBE_THRESHOLD,
        "probe_pass": probe_pass,
        "mfcc_similarity": round(mfcc_sim, 4),
        "mfcc_threshold": BASE_MFCC_THRESHOLD,
        "mfcc_pass": mfcc_pass,
        "profile_version": 2,
    }

    logger.info(
        f"Speaker verification (v2): match={match}, "
        f"centroid={centroid_sim:.4f}>={adaptive_threshold:.4f}? {centroid_pass}, "
        f"min_probe={min_probe_sim:.4f}>={MIN_PROBE_THRESHOLD}? {probe_pass}, "
        f"mfcc={mfcc_sim:.4f}>={BASE_MFCC_THRESHOLD}? {mfcc_pass}"
    )

    return {
        "match": match,
        "similarity": round(primary_sim, 4),
        "details": details,
    }
