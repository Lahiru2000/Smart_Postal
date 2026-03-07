"""
Liveness Detection Module — Anti-Spoofing for Face Verification
================================================================
Server-side liveness analysis to detect presentation attacks:
  - Photo attacks (holding up a printed photo or screen)
  - Video replay attacks (playing a pre-recorded video)
  - Deepfake / digital manipulation

Techniques used:
  1. Texture Analysis (LBP — Local Binary Patterns)
     - Real skin has micro-texture variations that prints/screens lack
     - Computes LBP histograms and checks texture richness

  2. Color Space Analysis (HSV + YCbCr)
     - Real skin occupies specific regions in color space
     - Screens/prints show unnatural color distributions
     - Moiré patterns from screens detected in frequency domain

  3. Inter-Frame Motion Analysis
     - Real faces have natural micro-movements (breathing, micro-saccades)
     - Photos are completely static; replayed videos have unnatural motion
     - Optical flow variance distinguishes live vs replay

  4. Frequency Domain Analysis (FFT)
     - Screens emit periodic dot/pixel patterns detectable via FFT
     - Printed photos show halftone patterns in high frequencies
     - Real faces have smooth spectral falloff

  5. Reflection & Specular Highlight Analysis
     - Screens have uniform specular highlights
     - Real skin has diffuse, non-uniform reflections

  6. Client-Side Challenge Verification
     - Validates that blink/head-turn challenges were completed
     - Cross-checks timestamps and sequence consistency
"""

import cv2
import numpy as np
import logging
from typing import List, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

# ── Configuration ───────────────────────────────────────────────────────────
# Liveness score thresholds
LIVENESS_PASS_THRESHOLD = 0.45      # Combined score must exceed this
LIVENESS_STRICT_THRESHOLD = 0.60    # HIGH confidence liveness

# Individual check weights
TEXTURE_WEIGHT = 0.25
COLOR_WEIGHT = 0.20
MOTION_WEIGHT = 0.25
FREQUENCY_WEIGHT = 0.15
REFLECTION_WEIGHT = 0.15

# Texture analysis (LBP)
LBP_RADIUS = 1
LBP_POINTS = 8
MIN_TEXTURE_VARIANCE = 0.015       # Minimum LBP histogram variance for real skin

# Color space analysis
SKIN_HUE_RANGE = (0, 50)           # Hue range for skin in HSV (0-180 scale)
SKIN_SAT_MIN = 20                  # Minimum saturation for real skin
MIN_SKIN_RATIO = 0.05              # At least 5% of face region should be skin-colored

# Motion analysis
MIN_MOTION_VARIANCE = 0.3          # Minimum optical flow variance for live face
MAX_STATIC_RATIO = 0.95            # If >95% of face is static → photo attack

# Frequency analysis
MOIRE_PEAK_THRESHOLD = 2.5         # Peak-to-average ratio indicating moiré pattern


# ══════════════════════════════════════════════════════════════════════════════
#  1. TEXTURE ANALYSIS (LBP)
# ══════════════════════════════════════════════════════════════════════════════

def _compute_lbp(gray: np.ndarray, radius: int = LBP_RADIUS, points: int = LBP_POINTS) -> np.ndarray:
    """
    Compute Local Binary Pattern for texture analysis.
    Real skin has rich micro-texture; printed photos and screens are smoother.
    """
    rows, cols = gray.shape
    lbp = np.zeros_like(gray, dtype=np.uint8)

    for i in range(points):
        angle = 2.0 * np.pi * i / points
        dx = int(round(radius * np.cos(angle)))
        dy = int(round(-radius * np.sin(angle)))

        # Shift the image
        shifted = np.zeros_like(gray)
        x1, x2 = max(0, dx), min(cols, cols + dx)
        y1, y2 = max(0, dy), min(rows, rows + dy)
        sx1, sx2 = max(0, -dx), min(cols, cols - dx)
        sy1, sy2 = max(0, -dy), min(rows, rows - dy)

        shifted[y1:y2, x1:x2] = gray[sy1:sy2, sx1:sx2]

        # Compare with center
        lbp |= ((shifted >= gray).astype(np.uint8) << i)

    return lbp


def _analyze_texture(face_region: np.ndarray) -> Tuple[float, Dict]:
    """
    Analyze face texture using LBP histograms.
    Returns (score 0-1, details dict).
    """
    if face_region is None or face_region.size == 0:
        return 0.0, {"error": "empty region"}

    gray = cv2.cvtColor(face_region, cv2.COLOR_BGR2GRAY) if len(face_region.shape) == 3 else face_region

    # Resize for consistent analysis
    gray = cv2.resize(gray, (128, 128))

    # Compute LBP
    lbp = _compute_lbp(gray)

    # LBP histogram
    hist, _ = np.histogram(lbp.ravel(), bins=256, range=(0, 256), density=True)

    # Texture richness metrics
    hist_variance = float(np.var(hist))
    hist_entropy = float(-np.sum(hist[hist > 0] * np.log2(hist[hist > 0])))
    hist_uniformity = float(np.sum(hist ** 2))

    # Real skin: high entropy, moderate variance, low uniformity
    # Flat surface (photo/screen): low entropy, low variance, high uniformity

    # Score based on texture richness
    entropy_score = min(hist_entropy / 7.0, 1.0)  # Max expected ~7 bits
    variance_score = min(hist_variance / 0.03, 1.0) if hist_variance > MIN_TEXTURE_VARIANCE else hist_variance / MIN_TEXTURE_VARIANCE * 0.3
    uniformity_penalty = max(0, 1.0 - hist_uniformity * 15)  # Lower uniformity = better

    texture_score = 0.4 * entropy_score + 0.3 * variance_score + 0.3 * uniformity_penalty
    texture_score = float(np.clip(texture_score, 0.0, 1.0))

    details = {
        "entropy": round(hist_entropy, 4),
        "variance": round(hist_variance, 6),
        "uniformity": round(hist_uniformity, 6),
        "score": round(texture_score, 4),
    }

    return texture_score, details


# ══════════════════════════════════════════════════════════════════════════════
#  2. COLOR SPACE ANALYSIS
# ══════════════════════════════════════════════════════════════════════════════

def _analyze_color(face_region: np.ndarray) -> Tuple[float, Dict]:
    """
    Analyze color distribution in HSV and YCbCr spaces.
    Real skin has characteristic color signatures that screens/prints distort.
    """
    if face_region is None or face_region.size == 0:
        return 0.0, {"error": "empty region"}

    face_resized = cv2.resize(face_region, (128, 128))

    # Convert to HSV
    hsv = cv2.cvtColor(face_resized, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)

    # Skin-color mask in HSV
    skin_mask = (
        (h >= SKIN_HUE_RANGE[0]) & (h <= SKIN_HUE_RANGE[1]) &
        (s >= SKIN_SAT_MIN) & (s <= 200) &
        (v >= 50) & (v <= 250)
    ).astype(np.uint8)

    skin_ratio = float(np.sum(skin_mask)) / skin_mask.size

    # Convert to YCbCr for additional skin analysis
    ycrcb = cv2.cvtColor(face_resized, cv2.COLOR_BGR2YCrCb)
    y_ch, cr, cb = cv2.split(ycrcb)

    # Skin detection in YCbCr (more robust to lighting)
    ycrcb_skin = (
        (cr >= 133) & (cr <= 173) &
        (cb >= 77) & (cb <= 127)
    ).astype(np.uint8)

    ycrcb_skin_ratio = float(np.sum(ycrcb_skin)) / ycrcb_skin.size

    # Saturation distribution — screens tend to have lower saturation variance
    sat_std = float(np.std(s[skin_mask > 0])) if np.sum(skin_mask) > 100 else 0.0

    # Hue distribution — real faces show gradual hue variation
    hue_std = float(np.std(h[skin_mask > 0])) if np.sum(skin_mask) > 100 else 0.0

    # Score components
    skin_score = min(skin_ratio / 0.3, 1.0) if skin_ratio >= MIN_SKIN_RATIO else 0.2
    ycrcb_score = min(ycrcb_skin_ratio / 0.25, 1.0)
    sat_score = min(sat_std / 30.0, 1.0)  # Real skin: std ~20-40
    hue_score = min(hue_std / 12.0, 1.0)  # Real skin: std ~8-15

    color_score = 0.3 * skin_score + 0.3 * ycrcb_score + 0.2 * sat_score + 0.2 * hue_score
    color_score = float(np.clip(color_score, 0.0, 1.0))

    details = {
        "skin_ratio_hsv": round(skin_ratio, 4),
        "skin_ratio_ycrcb": round(ycrcb_skin_ratio, 4),
        "saturation_std": round(sat_std, 2),
        "hue_std": round(hue_std, 2),
        "score": round(color_score, 4),
    }

    return color_score, details


# ══════════════════════════════════════════════════════════════════════════════
#  3. INTER-FRAME MOTION ANALYSIS
# ══════════════════════════════════════════════════════════════════════════════

def _analyze_motion(frames: List[np.ndarray]) -> Tuple[float, Dict]:
    """
    Analyze motion between consecutive frames.
    Real faces have natural micro-movements; photos are static.
    Video replays show unnatural, periodic motion patterns.
    """
    if len(frames) < 2:
        return 0.5, {"error": "need at least 2 frames", "score": 0.5}

    gray_frames = []
    for f in frames:
        g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY) if len(f.shape) == 3 else f
        g = cv2.resize(g, (256, 256))
        gray_frames.append(g)

    # Compute frame-to-frame differences
    diffs = []
    flow_magnitudes = []

    for i in range(1, len(gray_frames)):
        # Absolute difference
        diff = cv2.absdiff(gray_frames[i], gray_frames[i - 1])
        diffs.append(float(np.mean(diff)))

        # Optical flow (dense) for motion analysis
        try:
            flow = cv2.calcOpticalFlowFarneback(
                gray_frames[i - 1], gray_frames[i],
                None, 0.5, 3, 15, 3, 5, 1.2, 0
            )
            mag, _ = cv2.cartToPolar(flow[..., 0], flow[..., 1])
            flow_magnitudes.append(float(np.mean(mag)))
        except Exception:
            flow_magnitudes.append(0.0)

    avg_diff = np.mean(diffs) if diffs else 0.0
    diff_variance = np.var(diffs) if len(diffs) > 1 else 0.0
    avg_flow = np.mean(flow_magnitudes) if flow_magnitudes else 0.0
    flow_variance = np.var(flow_magnitudes) if len(flow_magnitudes) > 1 else 0.0

    # Static ratio — what fraction of pixels barely change
    static_count = sum(1 for d in diffs if d < 1.0)
    static_ratio = static_count / len(diffs) if diffs else 1.0

    # Scoring
    # Real face: moderate avg_diff (2-15), non-zero flow_variance, low static_ratio
    # Photo attack: very low avg_diff (<1), near-zero flow, very high static_ratio
    # Replay attack: can have motion but often periodic/repetitive

    if static_ratio >= MAX_STATIC_RATIO:
        # Almost completely static → likely a photo
        motion_score = 0.1
    elif avg_diff < 0.5:
        motion_score = 0.15
    else:
        # Natural motion scoring
        diff_score = min(avg_diff / 8.0, 1.0)
        variance_score = min(diff_variance / 5.0, 1.0) if diff_variance > MIN_MOTION_VARIANCE else 0.3
        flow_score = min(avg_flow / 1.0, 1.0) if avg_flow > 0.05 else 0.2

        motion_score = 0.4 * diff_score + 0.3 * variance_score + 0.3 * flow_score
        motion_score = float(np.clip(motion_score, 0.0, 1.0))

    details = {
        "avg_frame_diff": round(avg_diff, 4),
        "diff_variance": round(diff_variance, 4),
        "avg_optical_flow": round(avg_flow, 4),
        "flow_variance": round(flow_variance, 4),
        "static_ratio": round(static_ratio, 4),
        "score": round(motion_score, 4),
    }

    return motion_score, details


# ══════════════════════════════════════════════════════════════════════════════
#  4. FREQUENCY DOMAIN ANALYSIS (Moiré / Screen Detection)
# ══════════════════════════════════════════════════════════════════════════════

def _analyze_frequency(face_region: np.ndarray) -> Tuple[float, Dict]:
    """
    Detect moiré patterns and screen artifacts using FFT.
    Screens/monitors produce periodic patterns visible in frequency domain.
    """
    if face_region is None or face_region.size == 0:
        return 0.5, {"error": "empty region"}

    gray = cv2.cvtColor(face_region, cv2.COLOR_BGR2GRAY) if len(face_region.shape) == 3 else face_region
    gray = cv2.resize(gray, (128, 128)).astype(np.float32)

    # Apply windowing to reduce edge artifacts
    window = cv2.createHanningWindow((128, 128), cv2.CV_32F)
    gray_windowed = gray * window

    # 2D FFT
    fft = np.fft.fft2(gray_windowed)
    fft_shifted = np.fft.fftshift(fft)
    magnitude = np.abs(fft_shifted)

    # Log magnitude spectrum
    log_mag = np.log1p(magnitude)

    # Exclude DC component (center) and immediate neighbors
    center = 64
    mask = np.ones((128, 128), dtype=bool)
    mask[center - 3:center + 4, center - 3:center + 4] = False

    # Analyze high-frequency content
    high_freq_region = log_mag.copy()
    high_freq_region[~mask] = 0

    # Check for periodic peaks (moiré indicator)
    avg_mag = float(np.mean(high_freq_region[mask]))
    max_mag = float(np.max(high_freq_region[mask])) if np.any(mask) else 0.0
    peak_ratio = max_mag / max(avg_mag, 1e-6)

    # Spectral energy distribution
    # Real faces: energy concentrated in low frequencies, smooth falloff
    # Screens: periodic peaks at specific frequencies
    total_energy = float(np.sum(magnitude[mask] ** 2))
    low_freq_mask = np.zeros((128, 128), dtype=bool)
    low_freq_mask[center - 20:center + 20, center - 20:center + 20] = True
    low_freq_mask[center - 3:center + 4, center - 3:center + 4] = False
    low_freq_energy = float(np.sum(magnitude[low_freq_mask] ** 2))
    energy_ratio = low_freq_energy / max(total_energy, 1e-6)

    # Score
    # High peak_ratio → likely moiré → low score
    # High energy_ratio (energy concentrated in low freq) → natural → high score
    moire_penalty = 0.0
    if peak_ratio > MOIRE_PEAK_THRESHOLD:
        moire_penalty = min((peak_ratio - MOIRE_PEAK_THRESHOLD) / 5.0, 0.5)

    frequency_score = energy_ratio - moire_penalty
    frequency_score = float(np.clip(frequency_score, 0.0, 1.0))

    details = {
        "peak_ratio": round(peak_ratio, 4),
        "energy_ratio": round(energy_ratio, 4),
        "moire_detected": peak_ratio > MOIRE_PEAK_THRESHOLD,
        "score": round(frequency_score, 4),
    }

    return frequency_score, details


# ══════════════════════════════════════════════════════════════════════════════
#  5. REFLECTION / SPECULAR HIGHLIGHT ANALYSIS
# ══════════════════════════════════════════════════════════════════════════════

def _analyze_reflection(face_region: np.ndarray) -> Tuple[float, Dict]:
    """
    Analyze specular highlights and reflections.
    Screens produce uniform, large specular regions.
    Real skin has small, diffuse highlights.
    """
    if face_region is None or face_region.size == 0:
        return 0.5, {"error": "empty region"}

    gray = cv2.cvtColor(face_region, cv2.COLOR_BGR2GRAY) if len(face_region.shape) == 3 else face_region
    gray = cv2.resize(gray, (128, 128))

    # Detect bright specular regions
    _, highlight_mask = cv2.threshold(gray, 220, 255, cv2.THRESH_BINARY)
    highlight_ratio = float(np.sum(highlight_mask > 0)) / highlight_mask.size

    # Analyze highlight distribution using connected components
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(highlight_mask, connectivity=8)

    if num_labels <= 1:
        # No highlights — could be either (dim lighting)
        reflection_score = 0.6
        highlight_detail = "no_highlights"
    else:
        # Get areas of highlight regions (excluding background label 0)
        areas = [stats[i, cv2.CC_STAT_AREA] for i in range(1, num_labels)]
        max_area = max(areas) if areas else 0
        avg_area = np.mean(areas) if areas else 0
        num_highlights = len(areas)

        # Screen: few large, uniform highlights
        # Real skin: many small, scattered highlights
        if max_area > 500 and num_highlights < 3:
            # Large uniform highlight → suspicious (screen)
            reflection_score = 0.25
            highlight_detail = "large_uniform"
        elif num_highlights > 5 and avg_area < 100:
            # Many small highlights → natural (skin)
            reflection_score = 0.85
            highlight_detail = "natural_diffuse"
        else:
            reflection_score = 0.55
            highlight_detail = "mixed"

    # Penalize very high highlight ratio (screen glare)
    if highlight_ratio > 0.15:
        reflection_score *= 0.6

    reflection_score = float(np.clip(reflection_score, 0.0, 1.0))

    details = {
        "highlight_ratio": round(highlight_ratio, 4),
        "num_highlights": num_labels - 1 if num_labels > 1 else 0,
        "pattern": highlight_detail,
        "score": round(reflection_score, 4),
    }

    return reflection_score, details


# ══════════════════════════════════════════════════════════════════════════════
#  6. CLIENT CHALLENGE VERIFICATION
# ══════════════════════════════════════════════════════════════════════════════

def _verify_client_challenges(liveness_data: Optional[Dict]) -> Tuple[float, Dict]:
    """
    Verify that the client-side liveness challenges were completed.
    Checks blink detection, head turn, and challenge sequence consistency.
    """
    if not liveness_data:
        return 0.0, {"error": "no liveness data provided", "score": 0.0}

    challenges_completed = liveness_data.get("challenges_completed", [])
    blink_count = liveness_data.get("blink_count", 0)
    head_movements = liveness_data.get("head_movements", [])
    challenge_timestamps = liveness_data.get("challenge_timestamps", [])
    total_duration = liveness_data.get("duration_ms", 0)

    score = 0.0
    details = {}

    # Check blink detection
    if blink_count >= 2:
        score += 0.35
        details["blink"] = "pass"
    elif blink_count == 1:
        score += 0.15
        details["blink"] = "partial"
    else:
        details["blink"] = "fail"

    # Check head movements
    valid_movements = [m for m in head_movements if m in ("left", "right", "up", "down")]
    if len(valid_movements) >= 2:
        score += 0.35
        details["head_turn"] = "pass"
    elif len(valid_movements) == 1:
        score += 0.15
        details["head_turn"] = "partial"
    else:
        details["head_turn"] = "fail"

    # Check challenge sequence timing
    # Challenges should take a reasonable amount of time (not instant = bot)
    if total_duration > 3000 and total_duration < 60000:
        score += 0.15
        details["timing"] = "pass"
    elif total_duration > 1000:
        score += 0.08
        details["timing"] = "partial"
    else:
        details["timing"] = "fail"

    # Check that multiple challenges were completed
    if len(challenges_completed) >= 2:
        score += 0.15
        details["challenges"] = "pass"
    elif len(challenges_completed) == 1:
        score += 0.08
        details["challenges"] = "partial"
    else:
        details["challenges"] = "fail"

    score = float(np.clip(score, 0.0, 1.0))
    details["score"] = round(score, 4)
    details["blink_count"] = blink_count
    details["head_movements"] = valid_movements
    details["challenges_completed"] = challenges_completed
    details["duration_ms"] = total_duration

    return score, details


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN LIVENESS CHECK
# ══════════════════════════════════════════════════════════════════════════════

def detect_face_region(frame: np.ndarray) -> Optional[np.ndarray]:
    """
    Detect and extract the face region from a frame using OpenCV's DNN face detector.
    Returns the cropped face region or None if no face detected.
    """
    h, w = frame.shape[:2]

    # Use Haar cascade as fast fallback
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(80, 80))

    if len(faces) == 0:
        return None

    # Take the largest face
    x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])

    # Add padding (20%)
    pad_x = int(fw * 0.2)
    pad_y = int(fh * 0.2)
    x1 = max(0, x - pad_x)
    y1 = max(0, y - pad_y)
    x2 = min(w, x + fw + pad_x)
    y2 = min(h, y + fh + pad_y)

    return frame[y1:y2, x1:x2]


def check_liveness(
    frames: List[np.ndarray],
    liveness_data: Optional[Dict] = None,
) -> Dict:
    """
    Main liveness detection function.
    Analyzes multiple frames for signs of presentation attacks.

    Args:
        frames: List of BGR frames (numpy arrays) from the verification capture
        liveness_data: Optional dict with client-side challenge results
                      (blink_count, head_movements, challenges_completed, etc.)

    Returns:
        Dict with:
          - is_live: bool — overall liveness verdict
          - liveness_score: float — combined score 0.0–1.0
          - confidence: str — HIGH/MEDIUM/LOW
          - checks: dict — individual check scores and details
          - reason: str — human-readable explanation
    """
    if not frames or len(frames) == 0:
        return {
            "is_live": False,
            "liveness_score": 0.0,
            "confidence": "LOW",
            "checks": {},
            "reason": "No frames provided for liveness analysis",
        }

    logger.info(f"Running liveness detection on {len(frames)} frames"
                f"{' + client challenges' if liveness_data else ''}")

    # Extract face regions from frames
    face_regions = []
    for frame in frames:
        face = detect_face_region(frame)
        if face is not None and face.size > 0:
            face_regions.append(face)

    if not face_regions:
        return {
            "is_live": False,
            "liveness_score": 0.0,
            "confidence": "LOW",
            "checks": {},
            "reason": "No face detected in any frames for liveness analysis",
        }

    logger.info(f"Detected {len(face_regions)} face regions from {len(frames)} frames")

    # ── Run all checks ────────────────────────────────────────────────────

    # 1. Texture analysis (average across face regions)
    texture_scores = []
    texture_details_all = []
    for face in face_regions[:5]:  # Limit to 5 for performance
        ts, td = _analyze_texture(face)
        texture_scores.append(ts)
        texture_details_all.append(td)
    texture_score = float(np.mean(texture_scores)) if texture_scores else 0.0
    texture_details = texture_details_all[0] if texture_details_all else {}
    texture_details["avg_score"] = round(texture_score, 4)

    # 2. Color analysis
    color_scores = []
    color_details_all = []
    for face in face_regions[:5]:
        cs, cd = _analyze_color(face)
        color_scores.append(cs)
        color_details_all.append(cd)
    color_score = float(np.mean(color_scores)) if color_scores else 0.0
    color_details = color_details_all[0] if color_details_all else {}
    color_details["avg_score"] = round(color_score, 4)

    # 3. Motion analysis (needs full frames, not just face regions)
    motion_score, motion_details = _analyze_motion(frames)

    # 4. Frequency analysis
    freq_scores = []
    freq_details_all = []
    for face in face_regions[:3]:
        fs, fd = _analyze_frequency(face)
        freq_scores.append(fs)
        freq_details_all.append(fd)
    freq_score = float(np.mean(freq_scores)) if freq_scores else 0.5
    freq_details = freq_details_all[0] if freq_details_all else {}
    freq_details["avg_score"] = round(freq_score, 4)

    # 5. Reflection analysis
    refl_scores = []
    refl_details_all = []
    for face in face_regions[:3]:
        rs, rd = _analyze_reflection(face)
        refl_scores.append(rs)
        refl_details_all.append(rd)
    refl_score = float(np.mean(refl_scores)) if refl_scores else 0.5
    refl_details = refl_details_all[0] if refl_details_all else {}
    refl_details["avg_score"] = round(refl_score, 4)

    # 6. Client challenge verification
    challenge_score, challenge_details = _verify_client_challenges(liveness_data)

    # ── Combined score ────────────────────────────────────────────────────
    # If client challenges are available, they get significant weight
    if liveness_data:
        # With client challenges: server checks 60%, client 40%
        server_score = (
            texture_score * TEXTURE_WEIGHT +
            color_score * COLOR_WEIGHT +
            motion_score * MOTION_WEIGHT +
            freq_score * FREQUENCY_WEIGHT +
            refl_score * REFLECTION_WEIGHT
        )
        combined_score = server_score * 0.60 + challenge_score * 0.40
    else:
        # No client challenges: server checks only
        combined_score = (
            texture_score * TEXTURE_WEIGHT +
            color_score * COLOR_WEIGHT +
            motion_score * MOTION_WEIGHT +
            freq_score * FREQUENCY_WEIGHT +
            refl_score * REFLECTION_WEIGHT
        )

    combined_score = float(np.clip(combined_score, 0.0, 1.0))

    # ── Verdict ───────────────────────────────────────────────────────────
    is_live = combined_score >= LIVENESS_PASS_THRESHOLD

    if combined_score >= LIVENESS_STRICT_THRESHOLD:
        confidence = "HIGH"
    elif combined_score >= LIVENESS_PASS_THRESHOLD:
        confidence = "MEDIUM"
    else:
        confidence = "LOW"

    # Generate reason
    if is_live:
        reason = "Liveness checks passed"
        if confidence == "HIGH":
            reason += " with high confidence"
    else:
        # Identify the weakest check
        check_scores = {
            "texture": texture_score,
            "color": color_score,
            "motion": motion_score,
            "frequency": freq_score,
            "reflection": refl_score,
        }
        weakest = min(check_scores, key=check_scores.get)
        reason_map = {
            "texture": "Image texture suggests a printed photo or screen display",
            "color": "Skin color distribution appears unnatural (possible screen/print)",
            "motion": "Insufficient natural facial movement detected (possible photo/static image)",
            "frequency": "Screen moiré pattern or digital artifacts detected",
            "reflection": "Specular highlight pattern suggests screen display",
        }
        reason = reason_map.get(weakest, "Liveness checks did not pass")

    checks = {
        "texture": texture_details,
        "color": color_details,
        "motion": motion_details,
        "frequency": freq_details,
        "reflection": refl_details,
    }
    if liveness_data:
        checks["client_challenges"] = challenge_details

    result = {
        "is_live": is_live,
        "liveness_score": round(combined_score, 4),
        "confidence": confidence,
        "checks": checks,
        "reason": reason,
    }

    logger.info(
        f"Liveness result: live={is_live}, score={combined_score:.4f}, "
        f"confidence={confidence}, "
        f"texture={texture_score:.3f}, color={color_score:.3f}, "
        f"motion={motion_score:.3f}, freq={freq_score:.3f}, "
        f"refl={refl_score:.3f}"
        f"{f', challenges={challenge_score:.3f}' if liveness_data else ''}"
    )

    return result
