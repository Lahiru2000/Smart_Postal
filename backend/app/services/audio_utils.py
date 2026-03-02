"""
Audio utility functions — validation, format conversion, temp file management.
"""
import os
import uuid
import logging
import subprocess
from pathlib import Path
from fastapi import HTTPException
from app.services.voice_config import (
    ALLOWED_EXTENSIONS,
    MAX_UPLOAD_SIZE_BYTES,
    MAX_UPLOAD_SIZE_MB,
    TEMP_DIR,
)

logger = logging.getLogger(__name__)


def get_file_extension(filename: str) -> str:
    """Extract and normalize the file extension."""
    return Path(filename).suffix.lower() if filename else ""


def validate_file_extension(filename: str) -> str:
    """Validate file has an allowed extension. Returns the extension."""
    ext = get_file_extension(filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '.{ext}'. Allowed formats: {', '.join(ALLOWED_EXTENSIONS)}",
        )
    return ext


def validate_file_size(file_size: int) -> None:
    """Validate file doesn't exceed the maximum upload size."""
    if file_size > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE_MB}MB.",
        )
    if file_size < 1024:
        raise HTTPException(status_code=400, detail="File too small. Minimum size is 1 KB.")


async def validate_upload(file) -> bytes:
    """Validate an uploaded audio file. Returns the file content bytes."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    validate_file_extension(file.filename)
    content = await file.read()
    validate_file_size(len(content))

    logger.info(f"Upload validated: {file.filename} ({len(content)} bytes)")
    return content


def save_temp_file(content: bytes, extension: str, prefix: str = "") -> str:
    """Save content to a temp file with a unique name. Returns the path."""
    filename = f"{prefix}{uuid.uuid4().hex}{extension}"
    path = os.path.join(TEMP_DIR, filename)
    with open(path, "wb") as f:
        f.write(content)
    logger.info(f"Saved temp file: {path} ({len(content)} bytes)")
    return path


def delete_temp_file(file_path: str) -> None:
    """Safely delete a temporary file."""
    try:
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"Deleted temp file: {file_path}")
    except Exception as e:
        logger.warning(f"Failed to delete temp file {file_path}: {e}")


def cleanup_temp_files(*paths: str) -> None:
    """Delete multiple temporary files. Used in finally blocks."""
    for p in paths:
        delete_temp_file(p)


def get_content_type_for_extension(ext: str) -> str:
    """Map file extension to the appropriate content type."""
    mapping = {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".m4a": "audio/mp4",
        ".flac": "audio/flac",
        ".ogg": "audio/ogg",
        ".webm": "audio/webm",
    }
    return mapping.get(ext, "application/octet-stream")


def convert_webm_to_wav(input_path: str, output_path: str = None) -> str:
    """
    Convert a webm audio file to wav using ffmpeg.
    Needed because browser MediaRecorder produces webm.
    """
    if output_path is None:
        output_path = input_path.rsplit(".", 1)[0] + ".wav"
    try:
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", input_path,
                "-ar", "16000", "-ac", "1",
                "-acodec", "pcm_s16le", output_path,
            ],
            capture_output=True, check=True, timeout=30,
        )
        logger.info(f"Converted {input_path} -> {output_path}")
        return output_path
    except FileNotFoundError:
        raise RuntimeError(
            "ffmpeg is not installed. Install FFmpeg to enable microphone recording support."
        )
    except subprocess.TimeoutExpired:
        raise RuntimeError("Audio conversion timed out.")
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"ffmpeg conversion failed: {e.stderr.decode()}")
