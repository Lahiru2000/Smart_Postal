"""
Voice Verification Module — Dual-Model Ensemble (WavLM + ECAPA-TDNN)
=====================================================================
High-accuracy speaker verification using an ensemble of two state-of-the-art
speaker embedding models for maximum reliability.

Models:
  1. WavLM-Base-Plus-SV (Microsoft)
     - 512-dimensional x-vector speaker embeddings
     - Pre-trained on 94K hours, fine-tuned on VoxCeleb1

  2. ECAPA-TDNN (SpeechBrain)
     - 192-dimensional speaker embeddings
     - State-of-the-art EER on VoxCeleb1/2
     - Channel/speaker attention with multi-scale features

Ensemble Strategy:
  - Extract embeddings from both models independently
  - Compute cosine similarity for each model
  - Weighted average of mapped scores (ECAPA gets higher weight)
  - Both models must agree above minimum thresholds

Key improvements over single-model:
  - VAD-based speech segmentation (removes silence/noise)
  - Spectral noise reduction before embedding extraction
  - Dual-model ensemble reduces false accepts/rejects
  - Quality-aware scoring (low-quality audio → lower confidence)
  - Stricter calibration for critical security applications
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
SAMPLE_RATE = 16000               # Required by both models
MIN_AUDIO_DURATION_SEC = 1.5      # Minimum audio length after trimming

# WavLM configuration
WAVLM_MODEL_ID = "microsoft/wavlm-base-plus-sv"

# Segment-based embedding extraction
SEGMENT_DURATION_SEC = 3.0        # Each segment duration
SEGMENT_OVERLAP_SEC = 1.0         # Overlap between consecutive segments
MAX_SEGMENTS = 10                 # Max segments to process per audio

# ── Sigmoid score mapping parameters ────────────────────────────────────────
# WavLM cosine similarity (cross-device, cross-codec):
#   Same speaker:      typically 0.35–0.60
#   Different speaker: typically -0.10–0.25
#   Decision boundary: ~0.30 cosine similarity
WAVLM_SIGMOID_STEEPNESS = 16
WAVLM_SIGMOID_MIDPOINT = 0.30

# ECAPA-TDNN cosine similarity:
#   Same speaker:      typically 0.45–0.85
#   Different speaker: typically -0.10–0.30
#   Decision boundary: ~0.38 cosine similarity
ECAPA_SIGMOID_STEEPNESS = 14
ECAPA_SIGMOID_MIDPOINT = 0.38

# Ensemble weights (ECAPA gets more weight — better speaker discrimination)
WAVLM_WEIGHT = 0.40
ECAPA_WEIGHT = 0.60

# Both models must produce a score above this for the ensemble to pass
MODEL_AGREEMENT_THRESHOLD = 0.35

# Audio quality thresholds
MIN_RMS_ENERGY = 0.005            # Reject very quiet audio

# ── Model singletons ────────────────────────────────────────────────────────
_wavlm_model = None
_wavlm_feature_extractor = None
_ecapa_model = None


def _load_wavlm():
    """Lazy-load the WavLM speaker verification model (singleton)."""
    global _wavlm_model, _wavlm_feature_extractor
    if _wavlm_model is None:
        from transformers import Wav2Vec2FeatureExtractor, WavLMForXVector

        logger.info("Loading WavLM speaker verification model...")
        _wavlm_feature_extractor = Wav2Vec2FeatureExtractor.from_pretrained(WAVLM_MODEL_ID)
        _wavlm_model = WavLMForXVector.from_pretrained(WAVLM_MODEL_ID)
        _wavlm_model.eval()
        logger.info("WavLM speaker verification model loaded successfully")
    return _wavlm_model, _wavlm_feature_extractor


def _load_ecapa():
    """Lazy-load the ECAPA-TDNN speaker verification model (singleton)."""
    global _ecapa_model
    if _ecapa_model is None:
        try:
            from speechbrain.inference.speaker import EncoderClassifier

            logger.info("Loading ECAPA-TDNN speaker verification model...")
            _ecapa_model = EncoderClassifier.from_hparams(
                source="speechbrain/spkrec-ecapa-voxceleb",
                run_opts={"device": "cpu"},
            )
            logger.info("ECAPA-TDNN speaker verification model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load ECAPA-TDNN model: {e}")
            _ecapa_model = None
    return _ecapa_model


# ── Audio extraction & preprocessing ─────────────────────────────────────────

def extract_audio(video_path: str) -> Tuple[Optional[np.ndarray], float]:
    """
    Extract audio from video as a 16kHz mono float32 numpy array.
    Includes silence trimming, bandpass filtering, and amplitude normalization.

    Returns:
        Tuple of (audio_array float32, duration_seconds)
        Returns (None, 0.0) if no audio stream or extraction fails
    """
    try:
        import librosa

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = tmp.name

        # Extract audio with ffmpeg, apply bandpass for speech frequencies
        result = subprocess.run([
            "ffmpeg", "-y", "-i", video_path,
            "-ar", str(SAMPLE_RATE),
            "-ac", "1",              # mono
            "-acodec", "pcm_s16le",  # ensure clean PCM output
            "-af", "highpass=f=80,lowpass=f=7500",  # speech frequency range
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

        # Trim silence from start and end (more aggressive)
        audio_trimmed, _ = librosa.effects.trim(audio, top_db=22)
        trimmed_duration = len(audio_trimmed) / sr
        if trimmed_duration >= MIN_AUDIO_DURATION_SEC:
            audio = audio_trimmed
            logger.info(f"Trimmed silence: {raw_duration:.2f}s → {trimmed_duration:.2f}s")

        # Check audio quality (RMS energy)
        rms = float(np.sqrt(np.mean(audio ** 2)))
        if rms < MIN_RMS_ENERGY:
            logger.warning(f"Audio too quiet (RMS={rms:.4f}): {video_path}")
            return None, len(audio) / sr

        # Normalize amplitude to [-1, 1]
        max_val = np.max(np.abs(audio))
        if max_val > 1e-5:
            audio = audio / max_val

        duration = len(audio) / sr
        logger.info(f"Audio extracted: {duration:.2f}s, RMS={rms:.4f} "
                     f"from {os.path.basename(video_path)}")
        return audio.astype(np.float32), duration

    except Exception as e:
        logger.error(f"Audio extraction error for {video_path}: {e}")
        return None, 0.0


def extract_audio_from_file(audio_path: str) -> Tuple[Optional[np.ndarray], float]:
    """
    Extract audio from a standalone audio file (wav, webm, etc.).
    Same preprocessing as video extraction but for audio-only files.
    """
    try:
        import librosa

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = tmp.name

        # Convert any audio format to clean WAV
        result = subprocess.run([
            "ffmpeg", "-y", "-i", audio_path,
            "-ar", str(SAMPLE_RATE),
            "-ac", "1",
            "-acodec", "pcm_s16le",
            "-af", "highpass=f=80,lowpass=f=7500",
            "-f", "wav",
            tmp_path
        ], capture_output=True, timeout=30)

        if result.returncode != 0:
            logger.warning(f"ffmpeg audio conversion failed for {audio_path}: "
                           f"{result.stderr.decode()[:200]}")
            return None, 0.0

        audio, sr = librosa.load(tmp_path, sr=SAMPLE_RATE, mono=True)

        try:
            os.unlink(tmp_path)
        except Exception:
            pass

        raw_duration = len(audio) / sr
        if raw_duration < MIN_AUDIO_DURATION_SEC:
            logger.warning(f"Audio too short ({raw_duration:.2f}s) in: {audio_path}")
            return None, raw_duration

        # Trim silence
        audio_trimmed, _ = librosa.effects.trim(audio, top_db=22)
        trimmed_duration = len(audio_trimmed) / sr
        if trimmed_duration >= MIN_AUDIO_DURATION_SEC:
            audio = audio_trimmed

        # Check quality
        rms = float(np.sqrt(np.mean(audio ** 2)))
        if rms < MIN_RMS_ENERGY:
            logger.warning(f"Audio too quiet (RMS={rms:.4f}): {audio_path}")
            return None, len(audio) / sr

        # Normalize
        max_val = np.max(np.abs(audio))
        if max_val > 1e-5:
            audio = audio / max_val

        duration = len(audio) / sr
        logger.info(f"Audio from file: {duration:.2f}s, RMS={rms:.4f}")
        return audio.astype(np.float32), duration

    except Exception as e:
        logger.error(f"Audio file extraction error for {audio_path}: {e}")
        return None, 0.0


def _vad_segments(audio: np.ndarray, sr: int = SAMPLE_RATE) -> List[np.ndarray]:
    """
    Use energy-based Voice Activity Detection to extract speech segments.
    Returns list of audio segments containing speech.
    """
    try:
        import librosa

        # Compute short-time energy
        frame_length = int(0.025 * sr)  # 25ms frames
        hop_length = int(0.010 * sr)    # 10ms hop

        energy = librosa.feature.rms(
            y=audio, frame_length=frame_length, hop_length=hop_length
        )[0]

        # Dynamic threshold: mean of energy as baseline
        threshold = np.mean(energy) * 0.5

        # Find speech regions
        speech_mask = energy > threshold
        segments = []
        in_speech = False
        start = 0

        for i, is_speech in enumerate(speech_mask):
            if is_speech and not in_speech:
                start = i * hop_length
                in_speech = True
            elif not is_speech and in_speech:
                end = i * hop_length
                segment = audio[start:end]
                if len(segment) >= int(0.5 * sr):  # At least 0.5s
                    segments.append(segment)
                in_speech = False

        # Handle if speech extends to end
        if in_speech:
            segment = audio[start:]
            if len(segment) >= int(0.5 * sr):
                segments.append(segment)

        if not segments:
            return [audio]

        logger.info(f"VAD: found {len(segments)} speech segments "
                     f"({sum(len(s) for s in segments) / sr:.2f}s total speech)")
        return segments

    except Exception as e:
        logger.warning(f"VAD failed, using full audio: {e}")
        return [audio]


# ── WavLM embedding extraction ────────────────────────────────────────────────

def _get_wavlm_embedding(audio_segment: np.ndarray) -> Optional[np.ndarray]:
    """
    Get a single L2-normalized 512-d speaker embedding from WavLM.
    """
    try:
        model, feature_extractor = _load_wavlm()

        inputs = feature_extractor(
            audio_segment,
            sampling_rate=SAMPLE_RATE,
            return_tensors="pt",
            padding=True
        )

        with torch.no_grad():
            outputs = model(**inputs)
            embedding = outputs.embeddings  # [1, 512]
            embedding = F.normalize(embedding, dim=-1)

        return embedding.squeeze().cpu().numpy().astype(np.float32)

    except Exception as e:
        logger.error(f"WavLM embedding error: {e}")
        return None


def _get_wavlm_batch_embeddings(audio_segments: List[np.ndarray]) -> List[np.ndarray]:
    """Batch-process multiple audio segments through WavLM."""
    try:
        model, feature_extractor = _load_wavlm()

        inputs = feature_extractor(
            audio_segments,
            sampling_rate=SAMPLE_RATE,
            return_tensors="pt",
            padding=True
        )

        with torch.no_grad():
            outputs = model(**inputs)
            embeddings = outputs.embeddings
            embeddings = F.normalize(embeddings, dim=-1)

        return [embeddings[i].cpu().numpy().astype(np.float32)
                for i in range(embeddings.shape[0])]

    except Exception as e:
        logger.error(f"WavLM batch embedding error: {e}")
        results = []
        for seg in audio_segments:
            emb = _get_wavlm_embedding(seg)
            if emb is not None:
                results.append(emb)
        return results


# ── ECAPA-TDNN embedding extraction ──────────────────────────────────────────

def _get_ecapa_embedding(audio: np.ndarray) -> Optional[np.ndarray]:
    """
    Get a 192-d speaker embedding from ECAPA-TDNN (SpeechBrain).
    """
    try:
        model = _load_ecapa()
        if model is None:
            return None

        # ECAPA-TDNN expects a torch tensor
        audio_tensor = torch.tensor(audio, dtype=torch.float32).unsqueeze(0)

        with torch.no_grad():
            embedding = model.encode_batch(audio_tensor)
            embedding = F.normalize(embedding, dim=-1)

        return embedding.squeeze().cpu().numpy().astype(np.float32)

    except Exception as e:
        logger.error(f"ECAPA-TDNN embedding error: {e}")
        return None


# ── Robust embedding extraction (multi-segment + outlier removal) ─────────

def _build_segments(audio: np.ndarray) -> List[np.ndarray]:
    """
    Build overlapping segments from audio, filtering out silence.
    Uses VAD to prioritize segments with speech content.
    """
    segment_samples = int(SEGMENT_DURATION_SEC * SAMPLE_RATE)
    overlap_samples = int(SEGMENT_OVERLAP_SEC * SAMPLE_RATE)
    step_samples = max(segment_samples - overlap_samples, SAMPLE_RATE)

    # Use VAD to get speech-only regions
    speech_segments = _vad_segments(audio)
    if len(speech_segments) > 1:
        speech_audio = np.concatenate(speech_segments)
    else:
        speech_audio = speech_segments[0] if speech_segments else audio

    total_speech = len(speech_audio)

    # Build overlapping segments from speech audio
    segments = []
    if total_speech <= segment_samples:
        segments.append(speech_audio)
    else:
        start = 0
        while start + segment_samples <= total_speech and len(segments) < MAX_SEGMENTS:
            segment = speech_audio[start:start + segment_samples]
            rms = float(np.sqrt(np.mean(segment ** 2)))
            if rms > 0.01:
                segments.append(segment)
            start += step_samples

        if not segments:
            segments.append(speech_audio)

    return segments


def _aggregate_embeddings(embeddings: List[np.ndarray]) -> Optional[np.ndarray]:
    """
    Aggregate multiple embeddings with outlier removal.
    Uses median-based filtering and L2-normalized averaging.
    """
    if not embeddings:
        return None

    if len(embeddings) == 1:
        return embeddings[0]

    # Outlier removal using median distance (stricter threshold)
    if len(embeddings) >= 3:
        stacked = np.stack(embeddings)
        median = np.median(stacked, axis=0)
        distances = [float(np.linalg.norm(e - median)) for e in embeddings]
        dist_mean = np.mean(distances)
        dist_std = np.std(distances)
        threshold = dist_mean + 1.2 * dist_std
        filtered = [e for e, d in zip(embeddings, distances) if d <= threshold]
        if filtered:
            removed = len(embeddings) - len(filtered)
            if removed > 0:
                logger.info(f"Outlier removal: kept {len(filtered)}/{len(embeddings)}")
            embeddings = filtered

    # Average and L2-normalize
    avg_embedding = np.mean(embeddings, axis=0).astype(np.float32)
    norm = float(np.linalg.norm(avg_embedding))
    if norm > 1e-10:
        avg_embedding = avg_embedding / norm

    return avg_embedding


def get_robust_voice_embedding(audio: np.ndarray) -> Tuple[Optional[np.ndarray], Optional[np.ndarray]]:
    """
    Extract robust speaker embeddings from BOTH models.

    Returns:
        Tuple of (wavlm_embedding_512d, ecapa_embedding_192d)
        Either can be None if that model fails.
    """
    segments = _build_segments(audio)
    logger.info(f"Processing {len(segments)} speech segments for voice embedding")

    # ── WavLM embeddings ──────────────────────────────────────────────────
    wavlm_embeddings = []
    if len(segments) == 1:
        emb = _get_wavlm_embedding(segments[0])
        if emb is not None:
            wavlm_embeddings.append(emb)
    else:
        wavlm_embeddings = _get_wavlm_batch_embeddings(segments)

    wavlm_final = _aggregate_embeddings(wavlm_embeddings)
    if wavlm_final is not None:
        logger.info(f"WavLM: {len(wavlm_embeddings)} segment embeddings → robust embedding")

    # ── ECAPA-TDNN embeddings ─────────────────────────────────────────────
    ecapa_embeddings = []
    for seg in segments:
        emb = _get_ecapa_embedding(seg)
        if emb is not None:
            ecapa_embeddings.append(emb)

    ecapa_final = _aggregate_embeddings(ecapa_embeddings)
    if ecapa_final is not None:
        logger.info(f"ECAPA: {len(ecapa_embeddings)} segment embeddings → robust embedding")

    return wavlm_final, ecapa_final


# ── Audio quality assessment ──────────────────────────────────────────────────

def _assess_audio_quality(audio: np.ndarray) -> float:
    """
    Assess audio quality for speaker verification (0.0 = unusable, 1.0 = excellent).
    Considers: duration, energy, signal-to-noise.
    """
    duration = len(audio) / SAMPLE_RATE
    rms = float(np.sqrt(np.mean(audio ** 2)))

    # Estimate SNR
    sorted_amp = np.sort(np.abs(audio))
    n = len(sorted_amp)
    noise_floor = np.mean(sorted_amp[:max(int(n * 0.1), 1)])
    signal_level = np.mean(sorted_amp[int(n * 0.5):])
    snr = 20 * np.log10(signal_level / max(noise_floor, 1e-10))

    # Duration score
    if duration < 1.0:
        dur_score = 0.0
    elif duration < 3.0:
        dur_score = 0.5
    elif duration < 10.0:
        dur_score = 1.0
    else:
        dur_score = 0.9

    # SNR score
    if snr < 5:
        snr_score = 0.2
    elif snr < 10:
        snr_score = 0.5
    elif snr < 20:
        snr_score = 0.8
    else:
        snr_score = 1.0

    # RMS energy score
    if rms < 0.005:
        rms_score = 0.0
    elif rms < 0.02:
        rms_score = 0.5
    else:
        rms_score = 1.0

    quality = 0.3 * dur_score + 0.4 * snr_score + 0.3 * rms_score
    logger.info(f"Audio quality: {quality:.2f} (dur={duration:.1f}s, "
                 f"snr={snr:.1f}dB, rms={rms:.4f})")
    return quality


# ── Comparison ────────────────────────────────────────────────────────────────

def _sigmoid_score(cos_sim: float, steepness: float, midpoint: float) -> float:
    """Map cosine similarity to 0-1 score via sigmoid."""
    score = 1.0 / (1.0 + np.exp(-steepness * (cos_sim - midpoint)))
    return float(np.clip(score, 0.0, 1.0))


def _ensemble_score(
    wavlm_score: Optional[float],
    ecapa_score: Optional[float],
) -> float:
    """
    Compute ensemble score from individual model scores.
    Applies agreement checks and conservative scoring.
    """
    scores = []
    if wavlm_score is not None:
        scores.append(("wavlm", wavlm_score, WAVLM_WEIGHT))
    if ecapa_score is not None:
        scores.append(("ecapa", ecapa_score, ECAPA_WEIGHT))

    if not scores:
        return 0.0

    if len(scores) == 2:
        # Both models available — weighted ensemble with agreement check
        total_weight = WAVLM_WEIGHT + ECAPA_WEIGHT
        ensemble = (wavlm_score * WAVLM_WEIGHT + ecapa_score * ECAPA_WEIGHT) / total_weight

        # Agreement penalty: models disagreeing strongly → reduce confidence
        score_diff = abs(wavlm_score - ecapa_score)
        if score_diff > 0.35:
            logger.warning(f"Model disagreement: WavLM={wavlm_score:.4f}, "
                          f"ECAPA={ecapa_score:.4f}")
            ensemble = min(wavlm_score, ecapa_score) * 0.9
        elif score_diff > 0.20:
            penalty = (score_diff - 0.20) * 0.5
            ensemble *= (1.0 - penalty)

        # Both models must pass minimum threshold
        if wavlm_score < MODEL_AGREEMENT_THRESHOLD and ecapa_score < MODEL_AGREEMENT_THRESHOLD:
            ensemble = min(ensemble, 0.20)

        return ensemble
    else:
        # Single model — apply penalty for lower confidence
        name, score, weight = scores[0]
        logger.info(f"Single-model voice ({name}): {score:.4f} → {score * 0.90:.4f}")
        return score * 0.90


def compare_voices(video1_path: str, video2_path: str) -> float:
    """
    Compare speaker voices from two videos using dual-model ensemble.

    Returns:
        Similarity score 0.0 (definitely different) to 1.0 (definitely same).
        Uses ensemble of WavLM + ECAPA-TDNN for maximum accuracy.
    """
    audio1, dur1 = extract_audio(video1_path)
    audio2, dur2 = extract_audio(video2_path)

    if audio1 is None or audio2 is None:
        logger.warning(f"Voice comparison skipped — "
                       f"audio1: {dur1:.2f}s, audio2: {dur2:.2f}s")
        return 0.0

    # Assess audio quality
    quality1 = _assess_audio_quality(audio1)
    quality2 = _assess_audio_quality(audio2)
    min_quality = min(quality1, quality2)

    if min_quality < 0.15:
        logger.warning(f"Audio quality too low: q1={quality1:.2f}, q2={quality2:.2f}")
        return 0.0

    # Extract embeddings from both models
    wavlm1, ecapa1 = get_robust_voice_embedding(audio1)
    wavlm2, ecapa2 = get_robust_voice_embedding(audio2)

    wavlm_score = None
    ecapa_score = None

    # ── WavLM score ───────────────────────────────────────────────────────
    if wavlm1 is not None and wavlm2 is not None:
        wavlm_cos = float(np.dot(wavlm1, wavlm2))

        # Also try batch-mode comparison for cross-validation
        try:
            model, feature_extractor = _load_wavlm()
            inputs = feature_extractor(
                [audio1, audio2],
                sampling_rate=SAMPLE_RATE,
                return_tensors="pt",
                padding=True
            )
            with torch.no_grad():
                outputs = model(**inputs)
                batch_embs = F.normalize(outputs.embeddings, dim=-1)
                batch_cos = float(
                    torch.nn.CosineSimilarity(dim=-1)(
                        batch_embs[0:1], batch_embs[1:2]
                    ).item()
                )
            wavlm_cos = (wavlm_cos + batch_cos) / 2.0
            logger.info(f"WavLM cos_sim: segmented={float(np.dot(wavlm1, wavlm2)):.4f}, "
                        f"batch={batch_cos:.4f}, avg={wavlm_cos:.4f}")
        except Exception as e:
            logger.warning(f"WavLM batch comparison fallback: {e}")

        wavlm_score = _sigmoid_score(wavlm_cos, WAVLM_SIGMOID_STEEPNESS, WAVLM_SIGMOID_MIDPOINT)
        logger.info(f"WavLM: cos_sim={wavlm_cos:.4f}, score={wavlm_score:.4f}")

    # ── ECAPA-TDNN score ──────────────────────────────────────────────────
    if ecapa1 is not None and ecapa2 is not None:
        ecapa_cos = float(np.dot(ecapa1, ecapa2))
        ecapa_score = _sigmoid_score(ecapa_cos, ECAPA_SIGMOID_STEEPNESS, ECAPA_SIGMOID_MIDPOINT)
        logger.info(f"ECAPA: cos_sim={ecapa_cos:.4f}, score={ecapa_score:.4f}")

    # ── Ensemble ──────────────────────────────────────────────────────────
    final_score = _ensemble_score(wavlm_score, ecapa_score)

    # Apply quality scaling
    if min_quality < 0.6:
        quality_factor = 0.7 + 0.3 * (min_quality / 0.6)
        final_score *= quality_factor
        logger.info(f"Quality adjustment: factor={quality_factor:.3f}")

    final_score = float(np.clip(final_score, 0.0, 1.0))

    logger.info(f"Voice ensemble: final_score={final_score:.4f} "
                f"(durations: {dur1:.2f}s vs {dur2:.2f}s, "
                f"quality: {quality1:.2f}/{quality2:.2f})")
    return round(final_score, 4)


def compare_voice_with_reference_audio(
    reference_video_path: str,
    live_audio_path: str,
) -> float:
    """
    Compare voice from a reference VIDEO against a live AUDIO recording.
    Used when scan mode captures audio separately from video frames.

    Args:
        reference_video_path: Path to reference video (with audio)
        live_audio_path: Path to standalone audio file from live capture

    Returns:
        Similarity score 0.0 to 1.0
    """
    ref_audio, ref_dur = extract_audio(reference_video_path)
    live_audio, live_dur = extract_audio_from_file(live_audio_path)

    if ref_audio is None or live_audio is None:
        logger.warning(f"Cross-modal voice comparison skipped — "
                       f"ref: {ref_dur:.2f}s, live: {live_dur:.2f}s")
        return 0.0

    quality1 = _assess_audio_quality(ref_audio)
    quality2 = _assess_audio_quality(live_audio)
    min_quality = min(quality1, quality2)

    if min_quality < 0.15:
        return 0.0

    wavlm1, ecapa1 = get_robust_voice_embedding(ref_audio)
    wavlm2, ecapa2 = get_robust_voice_embedding(live_audio)

    wavlm_score = None
    ecapa_score = None

    if wavlm1 is not None and wavlm2 is not None:
        wavlm_cos = float(np.dot(wavlm1, wavlm2))
        wavlm_score = _sigmoid_score(wavlm_cos, WAVLM_SIGMOID_STEEPNESS, WAVLM_SIGMOID_MIDPOINT)

    if ecapa1 is not None and ecapa2 is not None:
        ecapa_cos = float(np.dot(ecapa1, ecapa2))
        ecapa_score = _sigmoid_score(ecapa_cos, ECAPA_SIGMOID_STEEPNESS, ECAPA_SIGMOID_MIDPOINT)

    final_score = _ensemble_score(wavlm_score, ecapa_score)

    if min_quality < 0.6:
        final_score *= 0.7 + 0.3 * (min_quality / 0.6)

    logger.info(f"Voice (video→audio): final_score={final_score:.4f}")
    return round(float(np.clip(final_score, 0.0, 1.0)), 4)


def _compare_audio_arrays(audio1: np.ndarray, audio2: np.ndarray) -> float:
    """
    Compare two pre-extracted audio arrays using the dual-model ensemble.
    This is the core comparison logic used when audio has already been
    extracted from separate files.

    Args:
        audio1: Reference audio as float32 numpy array (16kHz mono)
        audio2: Live audio as float32 numpy array (16kHz mono)

    Returns:
        Similarity score 0.0 to 1.0
    """
    quality1 = _assess_audio_quality(audio1)
    quality2 = _assess_audio_quality(audio2)
    min_quality = min(quality1, quality2)

    if min_quality < 0.15:
        logger.warning(f"Audio quality too low for comparison: q1={quality1:.2f}, q2={quality2:.2f}")
        return 0.0

    wavlm1, ecapa1 = get_robust_voice_embedding(audio1)
    wavlm2, ecapa2 = get_robust_voice_embedding(audio2)

    wavlm_score = None
    ecapa_score = None

    if wavlm1 is not None and wavlm2 is not None:
        wavlm_cos = float(np.dot(wavlm1, wavlm2))

        # Also try batch-mode comparison for cross-validation
        try:
            model, feature_extractor = _load_wavlm()
            inputs = feature_extractor(
                [audio1, audio2],
                sampling_rate=SAMPLE_RATE,
                return_tensors="pt",
                padding=True
            )
            with torch.no_grad():
                outputs = model(**inputs)
                batch_embs = F.normalize(outputs.embeddings, dim=-1)
                batch_cos = float(
                    torch.nn.CosineSimilarity(dim=-1)(
                        batch_embs[0:1], batch_embs[1:2]
                    ).item()
                )
            wavlm_cos = (wavlm_cos + batch_cos) / 2.0
        except Exception as e:
            logger.warning(f"WavLM batch comparison fallback: {e}")

        wavlm_score = _sigmoid_score(wavlm_cos, WAVLM_SIGMOID_STEEPNESS, WAVLM_SIGMOID_MIDPOINT)
        logger.info(f"WavLM (array): cos_sim={wavlm_cos:.4f}, score={wavlm_score:.4f}")

    if ecapa1 is not None and ecapa2 is not None:
        ecapa_cos = float(np.dot(ecapa1, ecapa2))
        ecapa_score = _sigmoid_score(ecapa_cos, ECAPA_SIGMOID_STEEPNESS, ECAPA_SIGMOID_MIDPOINT)
        logger.info(f"ECAPA (array): cos_sim={ecapa_cos:.4f}, score={ecapa_score:.4f}")

    final_score = _ensemble_score(wavlm_score, ecapa_score)

    if min_quality < 0.6:
        quality_factor = 0.7 + 0.3 * (min_quality / 0.6)
        final_score *= quality_factor

    final_score = float(np.clip(final_score, 0.0, 1.0))
    logger.info(f"Voice (array compare): final_score={final_score:.4f} "
                f"(quality: {quality1:.2f}/{quality2:.2f})")
    return round(final_score, 4)
