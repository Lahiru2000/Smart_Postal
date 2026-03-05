"""
Voice Verification Module — Microsoft WavLM
=============================================
Speaker verification using WavLM-base-plus-sv with robust embedding extraction.

Key improvements:
  - L2-normalized embeddings (per model documentation)
  - Segmented embedding extraction with outlier removal
  - Proper silence trimming and audio preprocessing
  - Calibrated sigmoid for real-world cross-device conditions
  - Batch processing support for efficiency

Model: WavLM-Base-Plus-SV (Microsoft)
  - 512-dimensional x-vector speaker embeddings
  - Pre-trained on 94K hours, fine-tuned on VoxCeleb1
"""

import numpy as np
import subprocess
import tempfile
import os
import logging
import torch
import torch.nn.functional as F
from typing import Optional, Tuple, List

logger = logging.getLogger(__name__)

# ── Configuration ───────────────────────────────────────────────────────────
MODEL_ID = "microsoft/wavlm-base-plus-sv"
SAMPLE_RATE = 16000               # Required by WavLM
MIN_AUDIO_DURATION_SEC = 1.0      # Minimum audio length after trimming

# Segment-based embedding extraction
SEGMENT_DURATION_SEC = 3.0        # Each segment duration
SEGMENT_OVERLAP_SEC = 1.0         # Overlap between consecutive segments
MAX_SEGMENTS = 8                  # Max segments to process per audio

# Sigmoid score mapping parameters
# Real-world WavLM cosine similarity (cross-device, cross-codec):
#   Same speaker:      typically 0.20–0.55
#   Different speaker: typically -0.10–0.15
#   Decision boundary: ~0.18 cosine similarity
SIGMOID_STEEPNESS = 12
SIGMOID_MIDPOINT = 0.18

# ── Model singleton ─────────────────────────────────────────────────────────
_model = None
_feature_extractor = None


def _load_model():
    """Lazy-load the WavLM speaker verification model (singleton)."""
    global _model, _feature_extractor
    if _model is None:
        from transformers import Wav2Vec2FeatureExtractor, WavLMForXVector

        logger.info("Loading WavLM speaker verification model...")
        _feature_extractor = Wav2Vec2FeatureExtractor.from_pretrained(MODEL_ID)
        _model = WavLMForXVector.from_pretrained(MODEL_ID)
        _model.eval()
        logger.info("WavLM speaker verification model loaded successfully")
    return _model, _feature_extractor


# ── Audio extraction ──────────────────────────────────────────────────────────

def extract_audio(video_path: str) -> Tuple[Optional[np.ndarray], float]:
    """
    Extract audio from video as a 16kHz mono float32 numpy array.
    Includes silence trimming and amplitude normalization.

    Returns:
        Tuple of (audio_array float32, duration_seconds)
        Returns (None, 0.0) if no audio stream or extraction fails
    """
    try:
        import librosa

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = tmp.name

        result = subprocess.run([
            "ffmpeg", "-y", "-i", video_path,
            "-ar", str(SAMPLE_RATE),
            "-ac", "1",              # mono
            "-acodec", "pcm_s16le",  # ensure clean PCM output
            "-f", "wav",
            "-vn",                   # no video
            tmp_path
        ], capture_output=True, timeout=30)

        if result.returncode != 0:
            logger.warning(f"ffmpeg audio extraction failed for {video_path}: "
                           f"{result.stderr.decode()[:200]}")
            return None, 0.0

        # Load as float32 in [-1, 1]
        audio, sr = librosa.load(tmp_path, sr=SAMPLE_RATE, mono=True)

        try:
            os.unlink(tmp_path)
        except Exception:
            pass

        raw_duration = len(audio) / sr

        if raw_duration < MIN_AUDIO_DURATION_SEC:
            logger.warning(f"Audio too short ({raw_duration:.2f}s) in: {video_path}")
            return None, raw_duration

        # Trim silence from start and end
        audio_trimmed, _ = librosa.effects.trim(audio, top_db=25)
        trimmed_duration = len(audio_trimmed) / sr
        if trimmed_duration >= MIN_AUDIO_DURATION_SEC:
            audio = audio_trimmed
            logger.info(f"Trimmed silence: {raw_duration:.2f}s → {trimmed_duration:.2f}s")

        # Normalize amplitude to [-1, 1]
        max_val = np.max(np.abs(audio))
        if max_val > 1e-5:
            audio = audio / max_val

        duration = len(audio) / sr
        logger.info(f"Audio extracted: {duration:.2f}s from {os.path.basename(video_path)}")
        return audio.astype(np.float32), duration

    except Exception as e:
        logger.error(f"Audio extraction error for {video_path}: {e}")
        return None, 0.0


# ── Voice embedding ───────────────────────────────────────────────────────────

def _get_embedding(audio_segment: np.ndarray) -> Optional[np.ndarray]:
    """
    Get a single L2-normalized 512-d speaker embedding from an audio segment.
    Uses the exact processing pipeline from the model documentation.
    """
    try:
        model, feature_extractor = _load_model()

        inputs = feature_extractor(
            audio_segment,
            sampling_rate=SAMPLE_RATE,
            return_tensors="pt",
            padding=True
        )

        with torch.no_grad():
            outputs = model(**inputs)
            embedding = outputs.embeddings  # [1, 512]
            # L2-normalize as per model documentation
            embedding = F.normalize(embedding, dim=-1)

        return embedding.squeeze().cpu().numpy().astype(np.float32)

    except Exception as e:
        logger.error(f"WavLM embedding error: {e}")
        return None


def _get_batch_embeddings(audio_segments: List[np.ndarray]) -> List[np.ndarray]:
    """
    Batch-process multiple audio segments for efficiency.
    Returns list of L2-normalized 512-d embeddings.
    """
    try:
        model, feature_extractor = _load_model()

        inputs = feature_extractor(
            audio_segments,
            sampling_rate=SAMPLE_RATE,
            return_tensors="pt",
            padding=True
        )

        with torch.no_grad():
            outputs = model(**inputs)
            embeddings = outputs.embeddings  # [batch, 512]
            embeddings = F.normalize(embeddings, dim=-1)

        return [embeddings[i].cpu().numpy().astype(np.float32)
                for i in range(embeddings.shape[0])]

    except Exception as e:
        logger.error(f"WavLM batch embedding error: {e}")
        # Fall back to individual processing
        results = []
        for seg in audio_segments:
            emb = _get_embedding(seg)
            if emb is not None:
                results.append(emb)
        return results


def get_robust_voice_embedding(audio: np.ndarray) -> Optional[np.ndarray]:
    """
    Extract robust speaker embedding using segmented processing.

    1. Splits audio into overlapping segments
    2. Extracts embedding for each segment (batch processing)
    3. Removes outlier embeddings (median-based)
    4. Averages remaining embeddings and L2-normalizes

    This is more robust than single-pass because it:
    - Reduces impact of noise bursts or non-speech segments
    - Provides multiple independent speaker estimates
    - Uses outlier removal to discard bad segments
    """
    segment_samples = int(SEGMENT_DURATION_SEC * SAMPLE_RATE)
    overlap_samples = int(SEGMENT_OVERLAP_SEC * SAMPLE_RATE)
    step_samples = max(segment_samples - overlap_samples, SAMPLE_RATE)
    total_samples = len(audio)

    # Build segments
    segments = []
    if total_samples <= segment_samples:
        # Audio shorter than segment duration: use whole audio
        segments.append(audio)
    else:
        start = 0
        while start + segment_samples <= total_samples and len(segments) < MAX_SEGMENTS:
            segment = audio[start:start + segment_samples]
            # Only use segments with enough energy (skip silence)
            rms = float(np.sqrt(np.mean(segment ** 2)))
            if rms > 0.01:
                segments.append(segment)
            start += step_samples

        # If no good segments found, use whole audio as fallback
        if not segments:
            segments.append(audio)

    # Batch-extract embeddings
    if len(segments) == 1:
        emb = _get_embedding(segments[0])
        if emb is None:
            return None
        embeddings = [emb]
    else:
        embeddings = _get_batch_embeddings(segments)

    if not embeddings:
        return None

    logger.info(f"Extracted {len(embeddings)} voice segment embeddings "
                f"from {len(segments)} segments")

    # Outlier removal using median distance (when enough segments)
    if len(embeddings) >= 3:
        stacked = np.stack(embeddings)
        median = np.median(stacked, axis=0)
        distances = [float(np.linalg.norm(e - median)) for e in embeddings]
        dist_mean = np.mean(distances)
        dist_std = np.std(distances)
        threshold = dist_mean + 1.5 * dist_std
        filtered = [e for e, d in zip(embeddings, distances) if d <= threshold]
        if filtered:
            removed = len(embeddings) - len(filtered)
            if removed > 0:
                logger.info(f"Voice outlier removal: kept {len(filtered)}/{len(embeddings)}")
            embeddings = filtered

    # Average and L2-normalize final embedding
    avg_embedding = np.mean(embeddings, axis=0).astype(np.float32)
    norm = float(np.linalg.norm(avg_embedding))
    if norm > 1e-10:
        avg_embedding = avg_embedding / norm

    return avg_embedding


# ── Comparison ────────────────────────────────────────────────────────────────

def compare_voices(video1_path: str, video2_path: str) -> float:
    """
    Compare speaker voices from two videos using WavLM speaker embeddings.

    Returns:
        Similarity score 0.0 (definitely different) to 1.0 (definitely same).
        Score mapped through sigmoid centered at WavLM decision boundary.
    """
    audio1, dur1 = extract_audio(video1_path)
    audio2, dur2 = extract_audio(video2_path)

    if audio1 is None or audio2 is None:
        logger.warning(f"Voice comparison skipped — "
                       f"audio1: {dur1:.2f}s, audio2: {dur2:.2f}s")
        return 0.0

    emb1 = get_robust_voice_embedding(audio1)
    emb2 = get_robust_voice_embedding(audio2)

    if emb1 is None or emb2 is None:
        logger.warning("Voice embedding extraction failed")
        return 0.0

    # Cosine similarity (embeddings are L2-normalized, so dot product = cosine sim)
    cos_sim = float(np.dot(emb1, emb2))

    # Also try batch-mode comparison for verification
    # (process both full audios together, matching model documentation pattern)
    try:
        model, feature_extractor = _load_model()
        inputs = feature_extractor(
            [audio1, audio2],
            sampling_rate=SAMPLE_RATE,
            return_tensors="pt",
            padding=True
        )
        with torch.no_grad():
            outputs = model(**inputs)
            batch_embs = F.normalize(outputs.embeddings, dim=-1)
            batch_cos_sim = float(
                torch.nn.CosineSimilarity(dim=-1)(
                    batch_embs[0:1], batch_embs[1:2]
                ).item()
            )
        # Use the higher of segmented vs batch similarity
        # (batch can be better when segments are suboptimal)
        logger.info(f"Voice cos_sim: segmented={cos_sim:.4f}, batch={batch_cos_sim:.4f}")
        cos_sim = max(cos_sim, batch_cos_sim)
    except Exception as e:
        logger.warning(f"Batch voice comparison fallback: {e}")

    # Map to 0–1 score via sigmoid centered at WavLM decision boundary
    #   cos_sim > 0.35 → score > 0.87  (confident same person)
    #   cos_sim ~ 0.18 → score ~ 0.50  (borderline)
    #   cos_sim < 0.05 → score < 0.16  (confident different person)
    score = 1.0 / (1.0 + np.exp(-SIGMOID_STEEPNESS * (cos_sim - SIGMOID_MIDPOINT)))
    score = float(np.clip(score, 0.0, 1.0))

    logger.info(f"Voice [WavLM]: final_cos_sim={cos_sim:.4f}, score={score:.4f} "
                f"(durations: {dur1:.2f}s vs {dur2:.2f}s)")
    return round(score, 4)
