"""
Configuration for the AI Voice Detection integration.
Reads API keys from environment and defines detection parameters.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ── API Keys ────────────────────────────────────────────────────
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
AI_DETECTOR_API_KEY = os.getenv("AI_DETECTOR_API_KEY", "")

# ── ElevenLabs Voice Isolator ───────────────────────────────────
ELEVENLABS_ISOLATOR_URL = "https://api.elevenlabs.io/v1/audio-isolation"

# ── Undetectable.AI Audio Detector ──────────────────────────────
AI_DETECTOR_BASE_URL = "https://ai-audio-detect.undetectable.ai"

# ── Detection Settings ──────────────────────────────────────────
DETECTION_POLL_INTERVAL_SECONDS = 3
DETECTION_MAX_POLL_ATTEMPTS = 40
REQUEST_TIMEOUT_SECONDS = 60
RETRY_ATTEMPTS = 3
RETRY_BACKOFF_FACTOR = 1.5

# ── Upload Validation ──────────────────────────────────────────
ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".webm"}
MAX_UPLOAD_SIZE_MB = 25
MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024

# ── Voice Auth Settings ──────────────────────────────────────────
ENROLLMENT_REQUIRED_SAMPLES = 3
ENROLLMENT_TTL_SECONDS = 1800       # 30 minutes
VERIFICATION_TTL_SECONDS = 600      # 10 minutes

# ── Temp Directory ──────────────────────────────────────────────
TEMP_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "temp_uploads")
os.makedirs(TEMP_DIR, exist_ok=True)

# ── Challenge Phrases ───────────────────────────────────────────
CHALLENGE_PHRASES = [
    "The quick brown fox jumps over the lazy dog",
    "My voice is my password, verify me",
    "SmartPostal delivers safely and securely",
    "I confirm this delivery with my voice",
    "One two three four five six seven eight",
    "Blue sky yellow sun green grass red flower",
    "Please verify my identity for this package",
    "The rain in Spain stays mainly in the plain",
]
