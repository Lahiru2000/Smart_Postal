"""
Spectral analysis heuristics for voice AI detection.
Provides local-only analysis as a secondary signal alongside the external API.
Uses raw WAV PCM data — no ML libraries required.
"""
import os
import wave
import struct
import math
import asyncio
import logging
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)


def _clamp(value: float, lower: float = 0.0, upper: float = 1.0) -> float:
    return max(lower, min(upper, value))


def _normalize_to_wav(source_path: str) -> tuple:
    """Convert to mono 16kHz PCM WAV if needed. Returns (wav_path, is_temp)."""
    if source_path.lower().endswith(".wav"):
        return source_path, False

    out_path = source_path + ".analysis.wav"
    try:
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", source_path,
                "-ar", "16000", "-ac", "1",
                "-acodec", "pcm_s16le", out_path,
            ],
            capture_output=True, check=True, timeout=30,
        )
        return out_path, True
    except Exception as e:
        raise RuntimeError(f"ffmpeg normalization failed: {e}")


def _read_pcm(path: str) -> list:
    """Read 16-bit PCM samples from a WAV file."""
    with wave.open(path, "rb") as wf:
        if wf.getsampwidth() != 2:
            raise ValueError("Only 16-bit PCM WAV is supported for local analysis.")
        frames = wf.readframes(wf.getnframes())
    samples = list(struct.unpack(f"<{len(frames)//2}h", frames))
    if not samples:
        raise ValueError("No PCM samples found for spectral analysis.")
    return samples


def _frame_energy(samples: list, frame_size: int = 320) -> list:
    """Compute per-frame RMS energy."""
    energies = []
    for i in range(0, len(samples) - frame_size, frame_size):
        frame = samples[i : i + frame_size]
        rms = math.sqrt(sum(s * s for s in frame) / frame_size)
        energies.append(rms)
    return energies


def _spectral_heuristics(audio_path: str) -> dict:
    """Run heuristic spectral analysis on a WAV file."""
    wav_path, is_temp = _normalize_to_wav(audio_path)
    try:
        samples = _read_pcm(wav_path)
        energies = _frame_energy(samples)

        if len(energies) < 10:
            return {
                "ai_probability": 0.5,
                "confidence": 0.3,
                "flags": ["short_audio_window"],
                "details": {"frame_count": len(energies)},
            }

        mean_e = sum(energies) / len(energies)
        variance = sum((e - mean_e) ** 2 for e in energies) / len(energies)
        std_e = math.sqrt(variance) if variance > 0 else 0.0001
        cv = std_e / mean_e if mean_e > 0 else 0

        # Frame-to-frame smoothness
        diffs = [abs(energies[i+1] - energies[i]) for i in range(len(energies)-1)]
        mean_diff = sum(diffs) / len(diffs) if diffs else 0
        smoothness = 1.0 - _clamp(mean_diff / (mean_e + 0.001))

        # Dynamic range
        sorted_e = sorted(energies)
        p5, p95 = sorted_e[len(sorted_e)//20], sorted_e[-max(1, len(sorted_e)//20)]
        dynamic_ratio = (p95 - p5) / (mean_e + 0.001)

        # Clipping detection
        max_abs = max(abs(s) for s in samples)
        clip_ratio = sum(1 for s in samples if abs(s) > 32000) / len(samples)

        flags = []
        ai_score = 0.0

        # Over-smooth energy envelope (AI voices often lack micro-variation)
        if smoothness > 0.92:
            flags.append("spectral_over_smooth")
            ai_score += 0.25
        elif smoothness > 0.87:
            flags.append("spectral_somewhat_smooth")
            ai_score += 0.10

        # Low coefficient of variation (unnaturally consistent amplitude)
        if cv < 0.06:
            flags.append("spectral_very_low_variability")
            ai_score += 0.25
        elif cv < 0.12:
            flags.append("spectral_low_variability")
            ai_score += 0.10

        # Compressed dynamic range
        if dynamic_ratio < 0.2:
            flags.append("spectral_very_low_dynamics")
            ai_score += 0.20
        elif dynamic_ratio < 0.4:
            flags.append("possible_replay_or_distortion")
            ai_score += 0.10

        # Near-zero clipping is suspicious for digital speech
        if clip_ratio == 0.0 and mean_e > 500:
            flags.append("perfect_clipping_avoidance")
            ai_score += 0.05

        ai_probability = _clamp(ai_score)
        confidence = _clamp(0.45 + len(flags) * 0.12)

        return {
            "ai_probability": round(ai_probability, 4),
            "confidence": round(confidence, 4),
            "flags": flags,
            "details": {
                "frame_count": len(energies),
                "mean_energy": round(mean_e, 2),
                "energy_cv": round(cv, 4),
                "smoothness_ratio": round(smoothness, 4),
                "dynamic_ratio": round(dynamic_ratio, 4),
                "clip_ratio": round(clip_ratio, 6),
            },
        }
    finally:
        if is_temp and os.path.exists(wav_path):
            try:
                os.remove(wav_path)
            except Exception:
                logger.warning("Failed to remove temp WAV used for spectral analysis: %s", wav_path)


async def analyze_spectral(audio_path: str) -> dict:
    """Async wrapper for spectral heuristic analysis."""
    return await asyncio.to_thread(_spectral_heuristics, audio_path)
