"""
Face Verification Module — DeepFace ArcFace
============================================
State-of-the-art face recognition using ArcFace (512-d embeddings).
Multi-frame aggregation with outlier removal for robust video comparison.

Model: ArcFace (Additive Angular Margin Loss)
  - 512-dimensional embeddings
  - Trained on MS1MV2 (~5.8M images, 85K identities)
  - Much higher accuracy than dlib's 128-d HOG/CNN embeddings
"""

import cv2
import numpy as np
import subprocess
import tempfile
import os
from typing import List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)

# ── Configuration ───────────────────────────────────────────────────────────
MODEL_NAME = "ArcFace"            # State-of-the-art face recognition model
DETECTOR_BACKEND = "ssd"          # SSD MobileNet — fast & accurate detection

FRAMES_TO_SAMPLE = 15             # Frames to extract per video
TOP_FRAMES = 10                   # Best-quality frames to use for embedding
MIN_FACE_SIZE = (80, 80)          # Minimum face pixel dimensions
MIN_FACE_CONFIDENCE = 0.70        # Minimum detection confidence (lower for webcam)

# Sigmoid score mapping parameters
# ArcFace cosine similarity ranges:
#   Same person:      typically 0.45–0.85
#   Different person: typically 0.00–0.25
#   Decision boundary: ~0.32 cosine similarity
SIGMOID_STEEPNESS = 15            # Higher = sharper decision boundary
SIGMOID_MIDPOINT = 0.32           # Cosine similarity at 50% score


# ── Frame extraction ─────────────────────────────────────────────────────────

def _convert_webm_to_mp4(video_path: str) -> Optional[str]:
    """
    Convert .webm to .mp4 via ffmpeg for reliable OpenCV frame extraction.
    Returns path to temp .mp4 file, or None if conversion fails.
    """
    if not video_path.lower().endswith('.webm'):
        return None

    try:
        tmp = tempfile.NamedTemporaryFile(suffix='.mp4', delete=False)
        tmp_path = tmp.name
        tmp.close()

        result = subprocess.run([
            'ffmpeg', '-y', '-i', video_path,
            '-c:v', 'libx264', '-preset', 'ultrafast',
            '-crf', '23', '-an', tmp_path
        ], capture_output=True, timeout=30)

        if result.returncode == 0:
            logger.info(f"Converted WebM to MP4: {tmp_path}")
            return tmp_path
        else:
            logger.warning(f"WebM conversion failed: {result.stderr.decode()[:200]}")
            os.unlink(tmp_path)
            return None
    except Exception as e:
        logger.warning(f"WebM conversion error: {e}")
        return None


def extract_best_frames(video_path: str, n: int = FRAMES_TO_SAMPLE) -> List[np.ndarray]:
    """
    Extract N evenly-spaced frames from a video, ranked by sharpness.
    Returns the top frames sorted by quality (sharpest first).
    Automatically converts .webm files to .mp4 for reliable extraction.
    """
    # Convert WebM to MP4 for reliable frame extraction
    converted_path = _convert_webm_to_mp4(video_path)
    actual_path = converted_path or video_path

    cap = cv2.VideoCapture(actual_path)
    if not cap.isOpened():
        if converted_path:
            os.unlink(converted_path)
        raise ValueError(f"Cannot open video: {video_path}")

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total_frames == 0:
        raise ValueError(f"Video has no frames: {video_path}")

    indices = np.linspace(0, total_frames - 1, min(n, total_frames), dtype=int)
    frames = []

    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
        ret, frame = cap.read()
        if ret and frame is not None:
            sharpness = _sharpness_score(frame)
            frames.append((sharpness, frame))

    cap.release()

    # Clean up converted temp file
    if converted_path:
        try:
            os.unlink(converted_path)
        except Exception:
            pass

    if not frames:
        raise ValueError(f"Could not read any frames from: {video_path}")

    # Sort by sharpness descending, keep best
    frames.sort(key=lambda x: x[0], reverse=True)
    return [f for _, f in frames[:TOP_FRAMES]]


def _sharpness_score(frame: np.ndarray) -> float:
    """Laplacian variance — higher = sharper frame."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


# ── Face embedding with DeepFace ArcFace ──────────────────────────────────

def get_face_embedding(frame: np.ndarray) -> Optional[np.ndarray]:
    """
    Extract ArcFace 512-d face embedding from a single frame.

    Uses DeepFace with SSD face detector.
    Returns embedding or None if no valid face is found.
    """
    from deepface import DeepFace

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    results = None
    # Try multiple detector backends in order of preference
    for backend in [DETECTOR_BACKEND, "opencv", "ssd"]:
        try:
            results = DeepFace.represent(
                img_path=rgb,
                model_name=MODEL_NAME,
                enforce_detection=True,
                detector_backend=backend,
                align=True
            )
            if results:
                break
        except Exception:
            continue

    # Last resort: skip detection entirely (use full frame)
    if not results:
        try:
            results = DeepFace.represent(
                img_path=rgb,
                model_name=MODEL_NAME,
                enforce_detection=False,
                detector_backend="skip",
                align=False
            )
        except Exception:
            return None

    if not results:
        return None

    # Pick the face with highest detection confidence
    best = max(results, key=lambda r: r.get("face_confidence", 0))

    # Filter by confidence
    if best.get("face_confidence", 0) < MIN_FACE_CONFIDENCE:
        return None

    # Filter by face size (reject tiny/distant faces)
    area = best.get("facial_area", {})
    w, h = area.get("w", 0), area.get("h", 0)
    if w < MIN_FACE_SIZE[0] or h < MIN_FACE_SIZE[1]:
        return None

    return np.array(best["embedding"], dtype=np.float32)


# ── Multi-frame robust embedding ─────────────────────────────────────────

def get_robust_embedding(video_path: str) -> Tuple[Optional[np.ndarray], int]:
    """
    Extract and aggregate ArcFace embeddings across best frames.
    Uses median-based outlier removal for robustness against
    bad detections or wrong-face matches.
    """
    frames = extract_best_frames(video_path)
    embeddings = []

    for frame in frames:
        emb = get_face_embedding(frame)
        if emb is not None:
            embeddings.append(emb)

    if not embeddings:
        logger.warning(f"No faces detected in: {video_path}")
        return None, 0

    logger.info(f"Extracted {len(embeddings)} face embeddings from {video_path}")

    # Outlier removal: discard embeddings far from the median
    # This guards against frames where the wrong face was detected
    if len(embeddings) >= 3:
        stacked = np.stack(embeddings)
        median = np.median(stacked, axis=0)
        distances = [np.linalg.norm(e - median) for e in embeddings]
        dist_mean = np.mean(distances)
        dist_std = np.std(distances)
        threshold = dist_mean + 1.5 * dist_std
        filtered = [e for e, d in zip(embeddings, distances) if d <= threshold]
        if filtered:
            embeddings = filtered
            logger.info(f"After outlier removal: {len(embeddings)} embeddings kept")

    # Average and L2-normalize
    avg_embedding = np.mean(embeddings, axis=0)
    norm = np.linalg.norm(avg_embedding)
    if norm > 0:
        avg_embedding = avg_embedding / norm

    return avg_embedding, len(embeddings)


# ── Comparison ────────────────────────────────────────────────────────────

def compare_faces(video1_path: str, video2_path: str) -> float:
    """
    Compare faces from two videos using ArcFace 512-d embeddings.

    Returns:
        Similarity score 0.0 (definitely different) to 1.0 (definitely same).
        Score mapped through sigmoid centered at ArcFace decision boundary.
    """
    emb1, count1 = get_robust_embedding(video1_path)
    emb2, count2 = get_robust_embedding(video2_path)

    if emb1 is None or emb2 is None:
        logger.warning(f"Face embedding failed — v1: {count1} faces, v2: {count2} faces")
        return 0.0

    # Cosine similarity between ArcFace embeddings
    cos_sim = float(np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2)))

    # Map to 0–1 score via sigmoid centered at ArcFace decision boundary
    #   cos_sim > 0.50 → score > 0.94  (confident same person)
    #   cos_sim ~ 0.32 → score ~ 0.50  (borderline)
    #   cos_sim < 0.15 → score < 0.07  (confident different person)
    score = 1.0 / (1.0 + np.exp(-SIGMOID_STEEPNESS * (cos_sim - SIGMOID_MIDPOINT)))
    score = float(np.clip(score, 0.0, 1.0))

    logger.info(f"Face [ArcFace]: cos_sim={cos_sim:.4f}, score={score:.4f} "
                f"(frames: {count1} vs {count2})")
    return round(score, 4)


# ── Image-based reference support ─────────────────────────────────────────

def get_image_embedding(image_path: str) -> Optional[np.ndarray]:
    """
    Extract ArcFace 512-d face embedding from a single image file.
    Used when the shipment reference is a photo instead of a video.
    """
    frame = cv2.imread(image_path)
    if frame is None:
        logger.warning(f"Cannot read image: {image_path}")
        return None

    emb = get_face_embedding(frame)
    if emb is not None:
        # L2-normalize for consistency with get_robust_embedding output
        norm = np.linalg.norm(emb)
        if norm > 0:
            emb = emb / norm
        logger.info(f"Extracted face embedding from image: {image_path}")
    else:
        logger.warning(f"No face detected in image: {image_path}")
    return emb


def compare_faces_mixed(image_path: str, video_path: str) -> float:
    """
    Compare a reference IMAGE against a live VIDEO.
    Extracts single embedding from the image, robust multi-frame
    embedding from the video, then computes similarity.

    Returns:
        Similarity score 0.0 (definitely different) to 1.0 (definitely same).
    """
    ref_emb = get_image_embedding(image_path)
    live_emb, live_count = get_robust_embedding(video_path)

    if ref_emb is None or live_emb is None:
        logger.warning(f"Face embedding failed — ref_image: {ref_emb is not None}, "
                       f"live_video: {live_count} faces")
        return 0.0

    cos_sim = float(np.dot(ref_emb, live_emb) / (
        np.linalg.norm(ref_emb) * np.linalg.norm(live_emb)
    ))

    score = 1.0 / (1.0 + np.exp(-SIGMOID_STEEPNESS * (cos_sim - SIGMOID_MIDPOINT)))
    score = float(np.clip(score, 0.0, 1.0))

    logger.info(f"Face [ArcFace image→video]: cos_sim={cos_sim:.4f}, score={score:.4f} "
                f"(ref=image, live={live_count} frames)")
    return round(score, 4)
