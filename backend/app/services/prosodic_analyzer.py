"""
Prosodic analysis heuristics for voice AI detection.
Analyzes rhythm, pauses, and energy patterns in speech.
"""
import os
import wave
import struct
import math
import asyncio
import logging
import subprocess

logger = logging.getLogger(__name__)


def _clamp(value: float, lower: float = 0.0, upper: float = 1.0) -> float:
    return max(lower, min(upper, value))


def _normalize_to_wav(source_path: str) -> tuple:
    if source_path.lower().endswith(".wav"):
        return source_path, False
    out_path = source_path + ".prosodic.wav"
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", source_path, "-ar", "16000", "-ac", "1",
             "-acodec", "pcm_s16le", out_path],
            capture_output=True, check=True, timeout=30,
        )
        return out_path, True
    except Exception as e:
        raise RuntimeError(f"ffmpeg normalization failed: {e}")


def _read_pcm(path: str) -> list:
    with wave.open(path, "rb") as wf:
        if wf.getsampwidth() != 2:
            raise ValueError("Only 16-bit PCM WAV is supported for local analysis.")
        frames = wf.readframes(wf.getnframes())
    samples = list(struct.unpack(f"<{len(frames)//2}h", frames))
    if not samples:
        raise ValueError("No PCM samples found for prosodic analysis.")
    return samples


def _frame_energy(samples: list, frame_size: int = 320) -> list:
    return [
        math.sqrt(sum(s * s for s in samples[i:i+frame_size]) / frame_size)
        for i in range(0, len(samples) - frame_size, frame_size)
    ]


def _prosodic_heuristics(audio_path: str) -> dict:
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

        # Pause detection (frames below 10% of mean energy)
        silence_threshold = mean_e * 0.1
        pause_frames = sum(1 for e in energies if e < silence_threshold)
        pause_ratio = pause_frames / len(energies)

        # Energy burst detection
        burst_threshold = mean_e * 2.0
        bursts = sum(1 for e in energies if e > burst_threshold)
        duration_seconds = len(samples) / 16000
        bursts_per_second = bursts / max(duration_seconds, 0.1)

        # Rhythm regularity — variance of inter-burst intervals
        burst_positions = [i for i, e in enumerate(energies) if e > burst_threshold]
        if len(burst_positions) > 2:
            intervals = [burst_positions[i+1] - burst_positions[i] for i in range(len(burst_positions)-1)]
            mean_int = sum(intervals) / len(intervals)
            int_var = sum((x - mean_int)**2 for x in intervals) / len(intervals)
            rhythm_regularity = 1.0 - _clamp(math.sqrt(int_var) / (mean_int + 0.001))
        else:
            rhythm_regularity = 0.5

        flags = []
        ai_score = 0.0

        # Low energy variance — unnaturally flat speech
        if cv < 0.05:
            flags.append("prosody_very_low_variance")
            ai_score += 0.25
        elif cv < 0.10:
            flags.append("prosody_low_variance")
            ai_score += 0.10

        # Machine-like rhythmic regularity
        if rhythm_regularity > 0.94:
            flags.append("prosody_very_monotonic")
            ai_score += 0.25
        elif rhythm_regularity > 0.87:
            flags.append("prosody_monotonic_rhythm")
            ai_score += 0.10

        # Unusual pause distribution
        if pause_ratio > 0.6:
            flags.append("excessive_pauses")
            ai_score += 0.10
        elif pause_ratio < 0.01 and duration_seconds > 3:
            flags.append("no_natural_pauses")
            ai_score += 0.15

        # Too-perfect burst cadence
        if bursts_per_second > 0 and bursts_per_second < 1.0 and rhythm_regularity > 0.85:
            flags.append("synthetic_cadence")
            ai_score += 0.05

        ai_probability = _clamp(ai_score)
        confidence = _clamp(0.40 + len(flags) * 0.12)

        return {
            "ai_probability": round(ai_probability, 4),
            "confidence": round(confidence, 4),
            "flags": flags,
            "details": {
                "frame_count": len(energies),
                "energy_cv": round(cv, 4),
                "pause_ratio": round(pause_ratio, 4),
                "bursts_per_second": round(bursts_per_second, 4),
                "rhythm_regularity": round(rhythm_regularity, 4),
            },
        }
    finally:
        if is_temp and os.path.exists(wav_path):
            try:
                os.remove(wav_path)
            except Exception:
                logger.warning("Failed to remove temp WAV used for prosodic analysis: %s", wav_path)


async def analyze_prosodic(audio_path: str) -> dict:
    """Async wrapper for prosodic heuristic analysis."""
    return await asyncio.to_thread(_prosodic_heuristics, audio_path)
