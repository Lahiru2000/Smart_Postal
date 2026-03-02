"""
Core voice analysis pipeline.
Orchestrates: file validation → voice isolation → AI detection → local analysis → ensemble fusion.
"""
import logging
from app.services.elevenlabs import isolate_voice
from app.services.ai_detector import detect_ai_audio
from app.services.spectral_analyzer import analyze_spectral
from app.services.prosodic_analyzer import analyze_prosodic
from app.services.ensemble import fuse_detection_scores
from app.services.audio_utils import (
    save_temp_file,
    cleanup_temp_files,
    get_file_extension,
    convert_webm_to_wav,
)

logger = logging.getLogger(__name__)


async def analyze_voice_sample(audio_bytes: bytes, filename: str = "audio.mp3") -> dict:
    """
    Full voice analysis pipeline.
    
    1. Save the original audio
    2. Convert webm -> wav if needed
    3. Voice isolation with ElevenLabs
    4. AI detection with Undetectable.AI
    5. Local spectral + prosodic analysis
    6. Ensemble score fusion
    
    Returns:
        dict with keys: ai_generated, confidence, ai_probability, fused_score,
        message, risk_tier, decision_reason, step_up, model_scores, analysis_details.
    """
    ext = get_file_extension(filename) or ".mp3"
    original_path = None
    cleaned_path = None
    wav_path = None
    temp_files = []

    try:
        # Step 1: Save original
        original_path = save_temp_file(audio_bytes, ext, prefix="original_")
        temp_files.append(original_path)
        logger.info(f"Original saved: {original_path}")

        # Step 2: Convert webm -> wav if browser recording
        analysis_path = original_path
        if ext == ".webm":
            try:
                logger.info("Converting webm recording to wav...")
                wav_path = convert_webm_to_wav(original_path)
                temp_files.append(wav_path)
                analysis_path = wav_path
            except Exception as e:
                logger.warning(f"webm→wav conversion failed: {e}. Using original file.")

        # Step 3: Voice isolation via ElevenLabs
        try:
            logger.info("Starting voice isolation...")
            cleaned_bytes = await isolate_voice(audio_bytes)
            cleaned_path = save_temp_file(cleaned_bytes, ".mp3", prefix="cleaned_")
            temp_files.append(cleaned_path)
            logger.info(f"Cleaned audio saved: {cleaned_path}")
            analysis_path = cleaned_path
        except Exception as e:
            logger.warning(f"Voice isolation failed: {e}. Proceeding with original audio.")

        # Step 4: AI detection via Undetectable.AI
        external_available = False
        ai_result = {"ai_generated": False, "confidence": 0.0, "ai_probability": 0.5,
                      "message": "External AI detection unavailable", "result_details": {}}
        try:
            logger.info("Starting AI detection...")
            ai_result = await detect_ai_audio(analysis_path)
            external_available = True
        except Exception as e:
            logger.warning(f"AI detection failed: {e}. Falling back to local analysis only.")

        # Step 5: Local spectral analysis
        spectral_result = {"ai_probability": 0.5, "confidence": 0.0}
        try:
            spectral_result = await analyze_spectral(analysis_path)
        except Exception as e:
            logger.warning(f"Spectral analyzer failed: {e}")

        # Step 6: Local prosodic analysis
        prosodic_result = {"ai_probability": 0.5, "confidence": 0.0}
        try:
            prosodic_result = await analyze_prosodic(analysis_path)
        except Exception as e:
            logger.warning(f"Prosodic analyzer failed: {e}")

        # Step 7: Ensemble fusion
        fused = fuse_detection_scores(
            external_score=ai_result["ai_probability"],
            external_confidence=ai_result["confidence"],
            spectral_score=spectral_result["ai_probability"],
            spectral_confidence=spectral_result["confidence"],
            prosodic_score=prosodic_result["ai_probability"],
            prosodic_confidence=prosodic_result["confidence"],
            external_available=external_available,
        )

        result = {
            "ai_generated": fused["ai_generated"],
            "confidence": fused["confidence"],
            "ai_probability": fused["fused_score"],
            "fused_score": fused["fused_score"],
            "message": fused["message"],
            "risk_tier": fused["risk_tier"],
            "decision_reason": fused["decision_reason"],
            "step_up": fused["step_up"],
            "model_scores": fused["model_scores"],
            "analysis_details": {
                "external": ai_result,
                "spectral": spectral_result,
                "prosodic": prosodic_result,
            },
        }

        logger.info(
            f"Analysis complete: ai_generated={result['ai_generated']}, "
            f"confidence={result['confidence']}"
        )
        return result

    finally:
        cleanup_temp_files(*temp_files)
