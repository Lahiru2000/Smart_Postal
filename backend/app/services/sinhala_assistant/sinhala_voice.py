"""
Sinhala Voice Processing Utilities
STT processor using Whisper / SpeechRecognition for the voice assistant.
Adapted for the group project structure (app.services.sinhala_assistant).
"""
import os
import io
import tempfile
import subprocess
from pathlib import Path
from typing import Dict, Optional
import logging

logger = logging.getLogger("sinhala_voice")

# Get ffmpeg path from imageio_ffmpeg (bundled, no system install needed)
try:
    import imageio_ffmpeg
    FFMPEG_EXE = imageio_ffmpeg.get_ffmpeg_exe()
    logger.info(f"Using ffmpeg: {FFMPEG_EXE}")
except ImportError:
    FFMPEG_EXE = "ffmpeg"  # Fall back to system ffmpeg
    logger.warning("imageio_ffmpeg not installed; falling back to system ffmpeg")

from fastapi import UploadFile

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

try:
    import whisper
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False

try:
    import speech_recognition as sr
    SR_AVAILABLE = True
except ImportError:
    SR_AVAILABLE = False


class SinhalaVoiceProcessor:
    """
    Processes Sinhala voice queries using Whisper STT.
    Separate from the biometric voice verification pipeline.
    """

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.openai_client = None
            cls._instance.whisper_model = None
            cls._instance.recognizer = None
            cls._instance.initialization_error = None
        return cls._instance

    def _ensure_models_loaded(self):
        """Load STT models (Whisper or SpeechRecognition)."""
        if self.initialization_error:
            return

        if self.openai_client or self.whisper_model or self.recognizer:
            return

        try:
            # Try OpenAI Whisper API first
            if OPENAI_AVAILABLE and os.getenv("OPENAI_API_KEY"):
                self.openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
                logger.info("OpenAI Whisper API loaded for Sinhala STT")
                return

            # Fallback to local Whisper
            if WHISPER_AVAILABLE:
                logger.info("Loading local Whisper model...")
                self.whisper_model = whisper.load_model("base")
                logger.info("Local Whisper loaded for Sinhala STT")
                return

            # Fallback to SpeechRecognition
            if SR_AVAILABLE:
                self.recognizer = sr.Recognizer()
                logger.info("SpeechRecognition loaded for Sinhala STT")
                return

            raise ImportError(
                "No STT library available. Install openai, openai-whisper, or SpeechRecognition."
            )

        except Exception as e:
            error_msg = f"Failed to load Sinhala STT models: {e}"
            logger.error(error_msg)
            self.initialization_error = error_msg

    async def transcribe_audio(self, audio_file: UploadFile) -> Dict:
        """
        Transcribe audio file to Sinhala text.

        Returns dict with keys: success, text, language, error.
        """
        self._ensure_models_loaded()

        if self.initialization_error:
            return {
                "success": False,
                "text": "",
                "language": "",
                "error": self.initialization_error,
            }

        try:
            audio_bytes = await audio_file.read()

            # --- OpenAI Whisper API ---
            if self.openai_client:
                with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                    tmp.write(audio_bytes)
                    temp_path = tmp.name
                try:
                    with open(temp_path, "rb") as audio:
                        transcript = self.openai_client.audio.transcriptions.create(
                            model="whisper-1", file=audio, language="si"
                        )
                    return {"success": True, "text": transcript.text, "language": "si", "error": None}
                finally:
                    os.unlink(temp_path)

            # --- Local Whisper ---
            if self.whisper_model:
                with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                    tmp.write(audio_bytes)
                    temp_path = tmp.name
                try:
                    result = self.whisper_model.transcribe(temp_path, language="si")
                    return {"success": True, "text": result["text"], "language": "si", "error": None}
                finally:
                    os.unlink(temp_path)

            # --- SpeechRecognition (Google Web Speech fallback) ---
            if self.recognizer:
                temp_input_path = None
                temp_output_path = None
                try:
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
                        tmp.write(audio_bytes)
                        temp_input_path = tmp.name

                    temp_output_path = temp_input_path.replace(".webm", ".wav")

                    cmd = [
                        FFMPEG_EXE,
                        "-i", temp_input_path,
                        "-acodec", "pcm_s16le",
                        "-ar", "16000",
                        "-ac", "1",
                        "-y",
                        temp_output_path,
                    ]
                    result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
                    if result.returncode != 0:
                        raise Exception(f"Audio conversion failed: {result.stderr}")
                    if not os.path.exists(temp_output_path):
                        raise Exception("WAV file was not created")

                    with sr.AudioFile(temp_output_path) as source:
                        audio_data = self.recognizer.record(source)

                    try:
                        text = self.recognizer.recognize_google(audio_data, language="si-LK")
                        return {"success": True, "text": text, "language": "si", "error": None}
                    except sr.UnknownValueError:
                        return {
                            "success": False, "text": "", "language": "",
                            "error": "හඬ හඳුනාගැනීමට නොහැකි විය - කරුණාකර පැහැදිලිව කතා කරන්න",
                        }
                    except sr.RequestError as e:
                        return {
                            "success": False, "text": "", "language": "",
                            "error": f"Speech recognition service error: {e}",
                        }
                finally:
                    if temp_input_path and os.path.exists(temp_input_path):
                        os.unlink(temp_input_path)
                    if temp_output_path and os.path.exists(temp_output_path) and temp_output_path != temp_input_path:
                        os.unlink(temp_output_path)

            return {"success": False, "text": "", "language": "", "error": "No STT method available"}

        except Exception as e:
            logger.error(f"Transcription error: {e}")
            return {"success": False, "text": "", "language": "", "error": str(e)}


# Global singleton
sinhala_voice_processor = SinhalaVoiceProcessor()
