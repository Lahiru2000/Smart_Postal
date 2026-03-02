"""
Undetectable.AI Audio Detector integration.
Uses the /detect-file endpoint for direct multipart upload + poll workflow.
"""
import httpx
import asyncio
import logging
from pathlib import Path
from app.services.voice_config import (
    AI_DETECTOR_API_KEY,
    AI_DETECTOR_BASE_URL,
    REQUEST_TIMEOUT_SECONDS,
    DETECTION_POLL_INTERVAL_SECONDS,
    DETECTION_MAX_POLL_ATTEMPTS,
)

logger = logging.getLogger(__name__)

DETECT_FILE_URL = f"{AI_DETECTOR_BASE_URL}/detect-file"
QUERY_URL = f"{AI_DETECTOR_BASE_URL}/query"


async def _submit_file(client: httpx.AsyncClient, audio_bytes: bytes, filename: str) -> str:
    """Upload audio directly and submit for detection. Returns job ID."""
    # Determine content type from extension
    ext = Path(filename).suffix.lower()
    ct_map = {".wav": "audio/wav", ".mp3": "audio/mpeg", ".m4a": "audio/mp4",
              ".flac": "audio/flac", ".ogg": "audio/ogg", ".webm": "audio/webm"}
    content_type = ct_map.get(ext, "audio/mpeg")

    logger.info(f"Uploading {filename} ({len(audio_bytes)} bytes) to /detect-file...")
    resp = await client.post(
        DETECT_FILE_URL,
        headers={"key": AI_DETECTOR_API_KEY},
        files={"file": (filename, audio_bytes, content_type)},
    )

    if resp.status_code != 200:
        raise RuntimeError(f"detect-file upload failed ({resp.status_code}): {resp.text}")

    data = resp.json()
    job_id = data.get("id")
    if not job_id:
        raise RuntimeError(f"detect-file response missing 'id': {data}")

    logger.info(f"Detection submitted. Job ID: {job_id}, Status: {data.get('status')}")
    return job_id


async def _poll_results(client: httpx.AsyncClient, job_id: str) -> dict:
    """Poll the /query endpoint until the detection result is ready."""
    for attempt in range(1, DETECTION_MAX_POLL_ATTEMPTS + 1):
        resp = await client.post(
            QUERY_URL,
            json={"id": job_id},
            headers={
                "apikey": AI_DETECTOR_API_KEY,
                "Content-Type": "application/json",
            },
        )

        if resp.status_code != 200:
            logger.warning(f"Query returned {resp.status_code}, retrying...")
            await asyncio.sleep(DETECTION_POLL_INTERVAL_SECONDS)
            continue

        data = resp.json()
        status = data.get("status", "")

        if status in ("completed", "done"):
            logger.info(f"Detection complete. Result: {data.get('result')}")
            return data

        if status == "failed":
            raise RuntimeError(
                f"Detection job failed: {data}. "
                "AI detection processing failed. The audio may be invalid or corrupted."
            )

        logger.info(
            f"Polling detection result (attempt {attempt}): status={status}. "
            f"Waiting {DETECTION_POLL_INTERVAL_SECONDS}s..."
        )
        await asyncio.sleep(DETECTION_POLL_INTERVAL_SECONDS)

    total_time = DETECTION_POLL_INTERVAL_SECONDS * DETECTION_MAX_POLL_ATTEMPTS
    raise RuntimeError(f"Detection timed out after {total_time}s. Try again later.")


async def detect_ai_audio(audio_path: str) -> dict:
    """
    Run AI audio detection via the /detect-file direct upload endpoint.

    Args:
        audio_path: Path to the audio file on disk.

    Returns:
        dict with keys:
            - ai_generated (bool): True if AI-generated voice detected.
            - confidence (float): Detection confidence 0-1.
            - ai_probability (float): Raw probability of being AI.
            - message (str): Human-readable result.
            - result_details (dict): Full API response data.
    """
    if not AI_DETECTOR_API_KEY:
        raise RuntimeError("AI_DETECTOR_API_KEY is not configured.")

    audio_bytes = Path(audio_path).read_bytes()
    filename = Path(audio_path).name

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
        # Step 1: Upload file directly for detection
        job_id = await _submit_file(client, audio_bytes, filename)

        # Step 2: Poll for result
        result_data = await _poll_results(client, job_id)

    ai_probability = result_data.get("result", 0.5)
    ai_generated = ai_probability >= 0.5
    confidence = abs(ai_probability - 0.5) * 2  # normalize to 0-1

    message = (
        f"Voice is AI-generated (confidence: {confidence:.2f})"
        if ai_generated
        else f"Voice appears human (confidence: {confidence:.2f})"
    )

    return {
        "ai_generated": ai_generated,
        "confidence": confidence,
        "ai_probability": ai_probability,
        "message": message,
        "result_details": result_data,
    }

