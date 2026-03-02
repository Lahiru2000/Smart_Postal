"""
ElevenLabs Voice Isolator integration.
Sends audio to ElevenLabs to strip background noise and isolate the human voice.
"""
import httpx
import logging
import asyncio
from app.services.voice_config import (
    ELEVENLABS_API_KEY,
    ELEVENLABS_ISOLATOR_URL,
    REQUEST_TIMEOUT_SECONDS,
    RETRY_ATTEMPTS,
    RETRY_BACKOFF_FACTOR,
)

logger = logging.getLogger(__name__)


async def isolate_voice(audio_bytes: bytes, content_type: str = "audio/mpeg") -> bytes:
    """
    Send audio to ElevenLabs Voice Isolator and return cleaned audio bytes.
    
    Args:
        audio_bytes: Raw audio file bytes.
        content_type: MIME type of the audio.
    
    Returns:
        Cleaned audio bytes with background noise removed.
    
    Raises:
        RuntimeError: If the API call fails after all retries.
    """
    if not ELEVENLABS_API_KEY:
        raise RuntimeError("ELEVENLABS_API_KEY is not configured.")

    logger.info(f"Sending audio to ElevenLabs Voice Isolator: {len(audio_bytes)} bytes")

    last_error = None
    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
                response = await client.post(
                    ELEVENLABS_ISOLATOR_URL,
                    headers={"xi-api-key": ELEVENLABS_API_KEY},
                    files={"audio": ("audio.mp3", audio_bytes, content_type)},
                )

                if response.status_code == 200:
                    cleaned = response.content
                    logger.info(
                        f"Voice isolation successful. Input: {len(audio_bytes)} bytes -> Output: {len(cleaned)} bytes"
                    )
                    return cleaned

                if 400 <= response.status_code < 500:
                    raise RuntimeError(
                        f"ElevenLabs API client error {response.status_code}: {response.text}"
                    )

                logger.warning(
                    f"ElevenLabs API server error {response.status_code} on attempt {attempt}"
                )
                last_error = RuntimeError(f"ElevenLabs API error ({response.status_code})")

        except httpx.TimeoutException:
            logger.warning(f"ElevenLabs API timeout on attempt {attempt}")
            last_error = RuntimeError("ElevenLabs API timeout")
        except httpx.RequestError as e:
            logger.warning(f"ElevenLabs API request error on attempt {attempt}: {e}")
            last_error = RuntimeError(f"ElevenLabs request error: {e}")

        if attempt < RETRY_ATTEMPTS:
            wait = RETRY_BACKOFF_FACTOR * attempt
            await asyncio.sleep(wait)

    raise RuntimeError(
        f"ElevenLabs Voice Isolator API failed after {RETRY_ATTEMPTS} attempts."
    ) from last_error
