"""
Sinhala Voice Assistant API Routes
Conversational AI for package tracking queries in Sinhala.

Adapted for Smart_Postal group project:
- Uses app.services.sinhala_assistant (courier_bot + sinhala_voice)
- Uses app.services.auth.get_current_user for JWT authentication
- Route prefix: /assistant (no /api prefix — group project doesn't use one)
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from typing import Optional
from pydantic import BaseModel
import base64
import io
import os
import logging

from app.services.sinhala_assistant.sinhala_voice import sinhala_voice_processor
from app.services.sinhala_assistant.courier_bot import (
    initialize_model,
    create_chat_session,
    handle_model_turn,
    get_tracking_status,
    calculate_shipping_rate,
    reschedule_delivery,
)
from app.services.auth import get_current_user
from app.models.user import User

logger = logging.getLogger("assistant_routes")

# Try loading gTTS for text-to-speech
try:
    from gtts import gTTS
    TTS_AVAILABLE = True
except ImportError:
    TTS_AVAILABLE = False
    logger.warning("gTTS not installed — voice responses will be text-only")

# Try loading the Gemini model at module level
_init_data = None
_chat_sessions: dict = {}  # Per-user chat sessions
ASSISTANT_AVAILABLE = True

try:
    _init_data = initialize_model()
    logger.info("Gemini model initialized for Sinhala assistant")
except Exception as e:
    ASSISTANT_AVAILABLE = False
    logger.warning(f"Sinhala assistant model init failed: {e}")


router = APIRouter(prefix="/assistant", tags=["Sinhala Voice Assistant"])


# ---------------------------------------------------------------------------
# Helper: get or create per-user chat session
# ---------------------------------------------------------------------------

def _get_bot_session(user_id: int):
    global _init_data, _chat_sessions

    if not ASSISTANT_AVAILABLE or _init_data is None:
        return None, None

    if user_id not in _chat_sessions:
        _chat_sessions[user_id] = create_chat_session(_init_data)
        logger.info(f"New chat session for user {user_id}")

    return _init_data, _chat_sessions[user_id]


# ---------------------------------------------------------------------------
# Helper: generate TTS audio as base64 MP3
# ---------------------------------------------------------------------------

def _generate_tts_audio(text: str) -> Optional[str]:
    """Return base64-encoded MP3 audio of the Sinhala text, or None."""
    if not TTS_AVAILABLE:
        return None
    try:
        tts_obj = gTTS(text=text, lang="si", slow=False)
        audio_buffer = io.BytesIO()
        tts_obj.write_to_fp(audio_buffer)
        audio_buffer.seek(0)
        audio_bytes = audio_buffer.read()
        if audio_bytes:
            return base64.b64encode(audio_bytes).decode("utf-8")
    except Exception as exc:
        logger.warning(f"TTS generation failed: {exc}")
    return None


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class TextQueryRequest(BaseModel):
    text: str
    tracking_id: Optional[str] = None


class ShippingRateRequest(BaseModel):
    origin_city: str
    destination_city: str
    weight_kg: float


class RescheduleRequest(BaseModel):
    tracking_id: str
    new_date: str


class QueryResponse(BaseModel):
    success: bool
    response_text: str
    response_audio: Optional[str] = None  # Base64 encoded MP3
    transcript: Optional[str] = None
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/tracking/{tracking_id}")
async def get_tracking_api(tracking_id: str):
    """Raw JSON tracking lookup — used by the Live API frontend for tool calling."""
    if not ASSISTANT_AVAILABLE:
        raise HTTPException(status_code=503, detail="Assistant not available")
    return get_tracking_status(tracking_id)


@router.post("/shipping-rate")
async def shipping_rate_api(request: ShippingRateRequest):
    """Calculate shipping cost — called by Live API tool."""
    if not ASSISTANT_AVAILABLE:
        raise HTTPException(status_code=503, detail="Assistant not available")
    try:
        return calculate_shipping_rate(request.origin_city, request.destination_city, request.weight_kg)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reschedule")
async def reschedule_api(request: RescheduleRequest):
    """Reschedule a delivery — called by Live API tool."""
    if not ASSISTANT_AVAILABLE:
        raise HTTPException(status_code=503, detail="Assistant not available")
    return reschedule_delivery(request.tracking_id, request.new_date)


@router.post("/query/voice", response_model=QueryResponse)
async def voice_query(
    file: UploadFile = File(...),
    tracking_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
):
    """Process a Sinhala voice query (audio upload → STT → Gemini → TTS)."""
    if not ASSISTANT_AVAILABLE:
        raise HTTPException(status_code=503, detail="Sinhala Assistant not available")

    try:
        # 1. Transcribe
        transcription = await sinhala_voice_processor.transcribe_audio(file)
        if not transcription["success"]:
            raise HTTPException(status_code=400, detail=f"Transcription failed: {transcription['error']}")

        user_text = transcription["text"]
        logger.info(f"[user {current_user.id}] Transcribed: {user_text}")

        # 2. Chat
        init_data, chat = _get_bot_session(current_user.id)
        if not init_data or not chat:
            raise HTTPException(status_code=503, detail="Assistant not initialized")

        response_text, updated_chat = handle_model_turn(init_data, chat, user_text)
        _chat_sessions[current_user.id] = updated_chat

        # 3. TTS
        response_audio = _generate_tts_audio(response_text)

        return QueryResponse(
            success=True,
            response_text=response_text,
            transcript=user_text,
            response_audio=response_audio,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Voice query error: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing voice query: {e}")


@router.post("/query/text", response_model=QueryResponse)
async def text_query(
    request: TextQueryRequest,
    current_user: User = Depends(get_current_user),
):
    """Process a Sinhala text query (text → Gemini → TTS)."""
    if not ASSISTANT_AVAILABLE:
        raise HTTPException(status_code=503, detail="Sinhala Assistant not available")

    try:
        init_data, chat = _get_bot_session(current_user.id)
        if not init_data or not chat:
            raise HTTPException(status_code=503, detail="Assistant not initialized")

        response_text, updated_chat = handle_model_turn(init_data, chat, request.text)
        _chat_sessions[current_user.id] = updated_chat

        response_audio = _generate_tts_audio(response_text)

        return QueryResponse(
            success=True,
            response_text=response_text,
            transcript=request.text,
            response_audio=response_audio,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Text query error: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing text query: {e}")


@router.post("/reset-conversation")
async def reset_conversation(current_user: User = Depends(get_current_user)):
    """Reset the bot conversation history for the current user."""
    if not ASSISTANT_AVAILABLE:
        raise HTTPException(status_code=503, detail="Sinhala Assistant not available")

    try:
        global _chat_sessions
        user_id = current_user.id

        if user_id in _chat_sessions:
            del _chat_sessions[user_id]

        if _init_data:
            _chat_sessions[user_id] = create_chat_session(_init_data)

        return {"success": True, "message": "Conversation reset"}
    except Exception as e:
        logger.error(f"Reset error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
