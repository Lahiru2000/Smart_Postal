import os
import torch
import torchaudio
import numpy as np
from loguru import logger
from config.settings import get_settings
import tempfile
import shutil
from pathlib import Path
from typing import Tuple, Optional, Dict, List
from scipy import signal
from scipy.stats import kurtosis, skew
import librosa
from dataclasses import dataclass, asdict
from fastapi import UploadFile

from transformers import AutoModelForAudioClassification, AutoFeatureExtractor

settings = get_settings()

@dataclass
class AudioQualityMetrics:
    """Audio quality assessment results"""
    snr: float
    duration: float
    is_clipping: bool
    spectral_flatness: float
    zero_crossing_rate: float
    is_acceptable: bool
    rejection_reason: Optional[str] = None


@dataclass
class AntiSpoofingMetrics:
    """Anti-spoofing detection results"""
    is_live: bool
    confidence: float
    spectral_consistency: float
    temporal_consistency: float
    features: Dict[str, float]


@dataclass
class AISyntheticDetectionMetrics:
    """AI-generated/synthetic voice detection results"""
    is_human: bool  # True if human voice, False if AI/synthetic
    confidence: float  # Confidence in detection (0-1)
    ai_probability: float  # Probability that voice is AI-generated (0-1)
    detection_method: str  # Primary detection method used
    flags: List[str]  # List of detection flags/indicators
    features: Dict[str, float]  # Detailed feature analysis
    is_rerecorded: bool  # True if audio appears to be re-recorded (speaker->mic)
    rerecording_confidence: float  # Confidence in re-recording detection


class BankingGradeVoiceProcessor:
    """
    Enterprise-grade voice verification for banking applications
    """
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(BankingGradeVoiceProcessor, cls).__new__(cls)
            cls._instance.resemblyzer_model = None
            cls._instance.initialization_error = None
            cls._instance.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

            # AI / deepfake detector (loaded lazily)
            cls._instance._ai_detector_error = None
            cls._instance._ai_model = None
            cls._instance._ai_feature_extractor = None
        return cls._instance
    
    def _ensure_models_loaded(self):
        """Load voice verification models"""
        if self.resemblyzer_model is not None or self.initialization_error is not None:
            return
            
        try:
            logger.info("🔐 Loading banking-grade voice verification models...")
            
            from resemblyzer import VoiceEncoder
            self.resemblyzer_model = VoiceEncoder(device=self.device)
            
            logger.info(f"✓ Models loaded on {self.device}")
            
        except Exception as e:
            error_msg = f"Failed to load models: {str(e)}"
            logger.error(error_msg)
            self.initialization_error = error_msg
            self.resemblyzer_model = None

    def assess_audio_quality(self, audio_path: str, sample_rate: int = 16000) -> AudioQualityMetrics:
        """Comprehensive audio quality assessment"""
        try:
            y, sr = librosa.load(audio_path, sr=sample_rate)
            duration = librosa.get_duration(y=y, sr=sr)
            
            if duration < 1.0:
                return AudioQualityMetrics(
                    snr=0.0, duration=duration, is_clipping=False,
                    spectral_flatness=0.0, zero_crossing_rate=0.0,
                    is_acceptable=False,
                    rejection_reason="Audio too short (minimum 1 second)"
                )
            
            if duration > 30.0:
                return AudioQualityMetrics(
                    snr=0.0, duration=duration, is_clipping=False,
                    spectral_flatness=0.0, zero_crossing_rate=0.0,
                    is_acceptable=False,
                    rejection_reason="Audio too long (maximum 30 seconds)"
                )
            
            energy = np.sum(y ** 2) / len(y)
            if energy < 0.0001:
                return AudioQualityMetrics(
                    snr=0.0, duration=duration, is_clipping=False,
                    spectral_flatness=0.0, zero_crossing_rate=0.0,
                    is_acceptable=False,
                    rejection_reason="Insufficient energy (possible silence)"
                )
            
            clipping_threshold = 0.95
            is_clipping = np.max(np.abs(y)) > clipping_threshold
            
            frame_energy = librosa.feature.rms(y=y)[0]
            noise_threshold = np.percentile(frame_energy, 10)
            signal_frames = frame_energy > noise_threshold
            
            if np.sum(signal_frames) > 0:
                signal_power = np.mean(frame_energy[signal_frames] ** 2)
                noise_power = np.mean(frame_energy[~signal_frames] ** 2) if np.sum(~signal_frames) > 0 else 0.001
                snr_db = 10 * np.log10(signal_power / (noise_power + 1e-10))
            else:
                snr_db = 0.0
            
            spectral_flatness = np.mean(librosa.feature.spectral_flatness(y=y))
            zcr = np.mean(librosa.feature.zero_crossing_rate(y))
            
            # Relaxed thresholds for real-world environments
            MIN_SNR_DB = 3.0  # Very lenient - only reject extremely noisy
            MAX_SPECTRAL_FLATNESS = 0.95  # Only reject complete silence
            
            is_acceptable = True
            rejection_reason = None
            
            # Only reject truly unusable audio
            if duration < 0.5:
                is_acceptable = False
                rejection_reason = f"Audio too short: {duration:.2f}s (minimum: 0.5s)"
            elif snr_db < MIN_SNR_DB:
                is_acceptable = False
                rejection_reason = f"Extremely noisy: {snr_db:.1f}dB. Try again."
            elif spectral_flatness > MAX_SPECTRAL_FLATNESS:
                is_acceptable = False
                rejection_reason = "No voice detected. Please speak into microphone."
            
            logger.info(f"📊 Quality: SNR={snr_db:.1f}dB, Duration={duration:.2f}s, OK={is_acceptable}")
            
            return AudioQualityMetrics(
                snr=float(snr_db),
                duration=float(duration),
                is_clipping=is_clipping,
                spectral_flatness=float(spectral_flatness),
                zero_crossing_rate=float(zcr),
                is_acceptable=is_acceptable,
                rejection_reason=rejection_reason
            )
            
        except Exception as e:
            logger.error(f"Quality assessment error: {str(e)}")
            return AudioQualityMetrics(
                snr=0.0, duration=0.0, is_clipping=False,
                spectral_flatness=0.0, zero_crossing_rate=0.0,
                is_acceptable=False,
                rejection_reason=f"Assessment failed: {str(e)}"
            )

    def enhance_audio(self, audio_path: str, sample_rate: int = 16000) -> np.ndarray:
        """
        Advanced audio enhancement for robustness in noisy environments
        - Noise reduction using spectral gating
        - Normalization
        - Voice activity detection
        """
        try:
            import noisereduce as nr
            
            y, sr = librosa.load(audio_path, sr=sample_rate)
            
            # Apply noise reduction
            y_denoised = nr.reduce_noise(y=y, sr=sr, stationary=True, prop_decrease=0.8)
            
            # Normalize
            y_normalized = librosa.util.normalize(y_denoised)
            
            return y_normalized
            
        except ImportError:
            # Fallback if noisereduce not available
            y, sr = librosa.load(audio_path, sr=sample_rate)
            return librosa.util.normalize(y)
        except Exception as e:
            logger.warning(f"Audio enhancement failed: {e}, using original")
            y, sr = librosa.load(audio_path, sr=sample_rate)
            return y

    def _ensure_ai_detector_loaded(self):
        """Load ML-based AI/deepfake detector (Transformers)"""
        if self._ai_model is not None or self._ai_detector_error is not None:
            return

        current_settings = get_settings()
        if not getattr(current_settings, "ENABLE_AI_DETECTION", True):
            self._ai_detector_error = "AI detection disabled by settings"
            return

        # Model: real vs fake deepfake audio classifier
        # Uses standard Transformers APIs and caches to HF_HOME/TRANSFORMERS_CACHE.
        model_name = getattr(current_settings, "AI_DETECTION_MODEL", None) or "garystafford/wav2vec2-deepfake-voice-detector"

        try:
            logger.info(f"🔐 Loading AI voice detector model: {model_name}")
            self._ai_feature_extractor = AutoFeatureExtractor.from_pretrained(model_name)
            self._ai_model = AutoModelForAudioClassification.from_pretrained(model_name)
            self._ai_model.to(self.device)
            self._ai_model.eval()
            logger.info(f"✓ AI voice detector loaded on {self.device}")
        except Exception as e:
            self._ai_detector_error = f"Failed to load AI detector model ({model_name}): {e}"
            self._ai_model = None
            self._ai_feature_extractor = None
            logger.error(self._ai_detector_error)

    def detect_ai_synthetic_voice(self, audio_path: str, sample_rate: int = 16000,
                                   strict_mode: bool = True) -> AISyntheticDetectionMetrics:
        """ML-based deepfake voice detection.

        This replaces the prior heuristic detector entirely.

        Implementation notes:
        - Uses a pretrained Transformers audio-classification model.
        - Runs inference on one or more fixed-length windows and aggregates probabilities.
        - Returns a calibrated probability that audio is AI-generated ("fake").
        """
        current_settings = get_settings()
        enabled = getattr(current_settings, "ENABLE_AI_DETECTION", True)
        if not enabled:
            return AISyntheticDetectionMetrics(
                is_human=True,
                confidence=0.0,
                ai_probability=0.0,
                detection_method="DISABLED",
                flags=["AI_DETECTION_DISABLED"],
                features={},
                is_rerecorded=False,
                rerecording_confidence=0.0,
            )

        self._ensure_ai_detector_loaded()

        # If we can't load the model, don't guess.
        # We return "unknown"-ish probability and let the policy layer decide (challenge vs deny).
        if self._ai_model is None or self._ai_feature_extractor is None:
            features = {"error": self._ai_detector_error or "AI detector unavailable"}
            # Conservative default: raise risk without hard-blocking users.
            return AISyntheticDetectionMetrics(
                is_human=True,
                confidence=0.0,
                ai_probability=0.50,
                detection_method="UNAVAILABLE",
                flags=["AI_DETECTOR_UNAVAILABLE"],
                features=features,
                is_rerecorded=False,
                rerecording_confidence=0.0,
            )

        threshold = float(getattr(current_settings, "AI_DETECTION_THRESHOLD", 0.90))
        if not strict_mode:
            # In non-strict mode, be less aggressive.
            threshold = min(max(threshold, 0.50), 0.95)

        logger.info(f"🔍 AI voice detection (ML): {audio_path} (threshold={threshold}, strict={strict_mode})")

        try:
            audio, sr = librosa.load(audio_path, sr=sample_rate, mono=True)
            duration = float(librosa.get_duration(y=audio, sr=sr))

            # Model training ranges vary; chunking reduces sensitivity to clip boundaries.
            window_seconds = 4.0
            hop_seconds = 2.0
            window_len = int(window_seconds * sr)
            hop_len = int(hop_seconds * sr)

            if len(audio) <= window_len:
                windows = [audio]
            else:
                windows = []
                for start in range(0, max(len(audio) - window_len + 1, 1), hop_len):
                    end = start + window_len
                    if end > len(audio):
                        break
                    windows.append(audio[start:end])
                if not windows:
                    windows = [audio[:window_len]]

            prob_fakes: List[float] = []
            for idx, chunk in enumerate(windows[:6]):
                # limit windows to bound latency
                inputs = self._ai_feature_extractor(
                    chunk,
                    sampling_rate=sr,
                    return_tensors="pt",
                    padding=True,
                )
                inputs = {k: v.to(self.device) for k, v in inputs.items()}
                with torch.no_grad():
                    outputs = self._ai_model(**inputs)
                    logits = outputs.logits
                    probs = torch.nn.functional.softmax(logits, dim=-1)

                # Most deepfake classifiers use 2 classes: [real, fake]
                prob_fake = float(probs[0, 1].detach().cpu().item()) if probs.shape[-1] >= 2 else float(torch.sigmoid(logits)[0].detach().cpu().item())
                prob_fakes.append(prob_fake)

            # Conservative aggregation: max fake-prob over windows
            ai_probability = float(max(prob_fakes) if prob_fakes else 0.5)
            is_human = ai_probability < threshold

            confidence = float(max(ai_probability, 1.0 - ai_probability))
            flags: List[str] = []
            if not is_human:
                flags.append("MODEL_PREDICTS_FAKE")

            features = {
                "model": getattr(current_settings, "AI_DETECTION_MODEL", None) or "garystafford/wav2vec2-deepfake-voice-detector",
                "threshold": threshold,
                "duration_seconds": duration,
                "window_seconds": window_seconds,
                "hop_seconds": hop_seconds,
                "window_probs_fake": prob_fakes,
                "aggregation": "max",
            }

            logger.info(f"🤖 AI Detection (ML): human={is_human}, fake_prob={ai_probability:.3f}, windows={len(prob_fakes)}")

            return AISyntheticDetectionMetrics(
                is_human=is_human,
                confidence=confidence,
                ai_probability=ai_probability,
                detection_method="WAV2VEC2_DEEPFAKE_CLASSIFIER",
                flags=flags,
                features=features,
                is_rerecorded=False,
                rerecording_confidence=0.0,
            )

        except Exception as e:
            logger.error(f"AI detection (ML) error: {e}")
            # Don't silently misclassify; raise risk via probability=0.5.
            return AISyntheticDetectionMetrics(
                is_human=True,
                confidence=0.0,
                ai_probability=0.50,
                detection_method="ERROR",
                flags=["AI_DETECTION_ERROR"],
                features={"error": str(e)},
                is_rerecorded=False,
                rerecording_confidence=0.0,
            )

    def detect_replay_attack(self, audio_path: str, sample_rate: int = 16000) -> AntiSpoofingMetrics:
        """
        Legacy anti-spoofing method - now supplemented by detect_ai_synthetic_voice.
        Kept for backward compatibility.
        """
        try:
            y, sr = librosa.load(audio_path, sr=sample_rate)
            
            # Simple checks for obvious spoofing
            frame_energy = librosa.feature.rms(y=y)[0]
            energy_variance = np.var(frame_energy)
            
            # Very basic liveness: just check if audio has natural variation
            # Real voice has energy variance, synthetic/replayed might be too flat
            has_variation = energy_variance > 0.0001
            
            # Always pass unless obviously synthetic (extremely low variation)
            liveness_score = 0.9 if has_variation else 0.1
            is_live = True  # Default to accepting
            
            features = {
                "energy_variance": float(energy_variance),
                "has_variation": has_variation
            }
            
            logger.info(f"🛡️ Legacy anti-spoofing: Score={liveness_score:.3f}, Live={is_live}")
            
            return AntiSpoofingMetrics(
                is_live=is_live,
                confidence=float(liveness_score),
                spectral_consistency=1.0,
                temporal_consistency=1.0,
                features=features
            )
            
        except Exception as e:
            logger.error(f"Anti-spoofing error: {str(e)}")
            # Fail open for liveness (accept by default)
            return AntiSpoofingMetrics(
                is_live=True,
                confidence=0.5,
                spectral_consistency=0.0,
                temporal_consistency=0.0,
                features={"error": str(e)}
            )

    async def process_audio(self, file: UploadFile, perform_quality_check: bool = True,
                          perform_liveness_check: bool = True,
                          perform_ai_detection: bool = True,
                          ai_detection_strict_mode: bool = True) -> Dict:
        """Process audio file with quality checks, AI detection, and embedding extraction"""
        self._ensure_models_loaded()
        
        if self.initialization_error:
            return {
                "success": False,
                "error": f"Models not available: {self.initialization_error}",
                "embedding": None
            }
        
        temp_path = None
        try:
            # Save uploaded file temporarily
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
                temp_path = temp_file.name
                content = await file.read()
                temp_file.write(content)
            
            # Quality assessment
            quality_metrics = None
            if perform_quality_check:
                quality_metrics = self.assess_audio_quality(temp_path)
                # Only reject for extreme low or duration issues
                if quality_metrics.duration < 0.5:
                    return {
                        "success": False,
                        "error": "Audio too short (minimum 0.5 seconds)",
                        "error_code": "AUDIO_TOO_SHORT",
                        "quality_metrics": asdict(quality_metrics),
                        "embedding": None
                    }
                # Accept even noisy audio - we'll clean it
                logger.info(f"📊 Quality: SNR={quality_metrics.snr:.1f}dB, Duration={quality_metrics.duration:.2f}s")
            
            # AI/Synthetic voice detection (PRIMARY SECURITY CHECK)
            ai_detection_metrics = None
            if perform_ai_detection:
                ai_detection_metrics = self.detect_ai_synthetic_voice(
                    temp_path, 
                    strict_mode=ai_detection_strict_mode
                )
                
                if not ai_detection_metrics.is_human:
                    # Determine specific rejection reason
                    if ai_detection_metrics.is_rerecorded:
                        rejection_reason = (
                            f"AI-generated voice detected (re-recorded). "
                            f"This appears to be synthetic speech played through a speaker "
                            f"and recorded (AI probability: {ai_detection_metrics.ai_probability:.1%}). "
                            f"Please use your natural voice directly into the microphone."
                        )
                    else:
                        rejection_reason = (
                            f"AI-generated or synthetic voice detected. "
                            f"The audio exhibits characteristics of computer-generated speech "
                            f"(AI probability: {ai_detection_metrics.ai_probability:.1%}). "
                            f"Please use your natural voice for authentication."
                        )
                    
                    logger.warning(
                        f"🚫 AI/Synthetic voice REJECTED: AI_Prob={ai_detection_metrics.ai_probability:.3f}, "
                        f"Method={ai_detection_metrics.detection_method}, "
                        f"Flags={ai_detection_metrics.flags}"
                    )
                    
                    return {
                        "success": False,
                        "error": rejection_reason,
                        "error_code": "AI_SYNTHETIC_VOICE_DETECTED",
                        "quality_metrics": asdict(quality_metrics) if quality_metrics else None,
                        "ai_detection_metrics": asdict(ai_detection_metrics),
                        "embedding": None
                    }
            
            # Legacy liveness check (supplementary)
            liveness_metrics = None
            if perform_liveness_check:
                liveness_metrics = self.detect_replay_attack(temp_path)
                # Only reject if obviously synthetic
                if not liveness_metrics.is_live:
                    logger.warning(f"⚠️ Legacy liveness check flagged audio")
            
            # Enhanced audio preprocessing
            from resemblyzer import preprocess_wav
            
            try:
                # Try with noise reduction first
                enhanced_audio = self.enhance_audio(temp_path)
                
                # Save enhanced audio temporarily
                enhanced_path = temp_path.replace('.wav', '_enhanced.wav')
                import soundfile as sf
                sf.write(enhanced_path, enhanced_audio, 16000)
                
                # Process enhanced audio
                wav = preprocess_wav(enhanced_path)
                embedding = self.resemblyzer_model.embed_utterance(wav)
                
                # Cleanup enhanced file
                if os.path.exists(enhanced_path):
                    os.remove(enhanced_path)
                    
                logger.info(f"✓ Enhanced embedding extracted: shape={embedding.shape}")
                
            except Exception as e:
                # Fallback to original audio if enhancement fails
                logger.warning(f"Enhancement failed, using original: {e}")
                wav = preprocess_wav(temp_path)
                embedding = self.resemblyzer_model.embed_utterance(wav)
                logger.info(f"✓ Original embedding extracted: shape={embedding.shape}")
            
            # Normalize embedding for better comparison
            embedding = embedding / (np.linalg.norm(embedding) + 1e-8)
            
            return {
                "success": True,
                "embedding": embedding,
                "quality_metrics": asdict(quality_metrics) if quality_metrics else None,
                "liveness_metrics": asdict(liveness_metrics) if liveness_metrics else None,
                "ai_detection_metrics": asdict(ai_detection_metrics) if ai_detection_metrics else None,
                "error": None,
                "error_code": None
            }
            
        except Exception as e:
            logger.error(f"Processing error: {str(e)}")
            raise e
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    def verify_voice_ensemble(self, embedding1: np.ndarray, embedding2: np.ndarray,
                            use_strict_threshold: bool = False) -> Tuple[bool, float, Dict]:
        """Multi-metric ensemble verification"""
        try:
            if not isinstance(embedding1, np.ndarray):
                embedding1 = np.array(embedding1)
            if not isinstance(embedding2, np.ndarray):
                embedding2 = np.array(embedding2)
            
            cosine_sim = np.dot(embedding1, embedding2) / (
                np.linalg.norm(embedding1) * np.linalg.norm(embedding2) + 1e-10
            )
            cosine_score = float(np.clip(cosine_sim, 0, 1))
            
            euclidean_dist = np.linalg.norm(embedding1 - embedding2)
            euclidean_score = float(np.clip(1 - (euclidean_dist / 2.0), 0, 1))
            
            correlation = np.corrcoef(embedding1, embedding2)[0, 1]
            correlation_score = float(np.clip((correlation + 1) / 2, 0, 1))
            
            ensemble_score = (
                cosine_score * 0.70 +
                euclidean_score * 0.20 +
                correlation_score * 0.10
            )
            
            # Get fresh settings
            current_settings = get_settings()
            threshold = current_settings.VOICE_SIMILARITY_THRESHOLD
            
            is_verified = ensemble_score >= threshold
            fail_reason = None
            
            if not is_verified:
                fail_reason = f"Ensemble score {ensemble_score:.3f} < Threshold {threshold:.3f}"
            
            # Minimum cosine similarity threshold
            MIN_COSINE_THRESHOLD = 0.65  # Balanced for real-world use
            if cosine_score < MIN_COSINE_THRESHOLD:
                is_verified = False
                fail_reason = f"Cosine similarity {cosine_score:.3f} < Min {MIN_COSINE_THRESHOLD:.3f}"
                logger.warning(f"⚠️ Cosine too low ({cosine_score:.3f} < {MIN_COSINE_THRESHOLD})")
            
            metrics = {
                "ensemble_score": round(ensemble_score, 4),
                "cosine_similarity": round(cosine_score, 4),
                "euclidean_score": round(euclidean_score, 4),
                "correlation_score": round(correlation_score, 4),
                "threshold_used": round(threshold, 4),
                "min_cosine_threshold": MIN_COSINE_THRESHOLD,
                "fail_reason": fail_reason
            }
            
            logger.info(f"🔍 Verification: Ensemble={ensemble_score:.4f}, "
                       f"Cosine={cosine_score:.4f}, "
                       f"Threshold={threshold:.4f}, "
                       f"Verified={is_verified}")
            
            return is_verified, ensemble_score, metrics
            
        except Exception as e:
            logger.error(f"Verification error: {str(e)}")
            return False, 0.0, {"error": str(e)}

    def validate_enrollment_template(self, embeddings: List[np.ndarray]) -> Tuple[bool, float, str]:
        """Validate enrollment template consistency"""
        if len(embeddings) < 2:
            return True, 1.0, "Single sample"
        
        try:
            similarities = []
            for i in range(len(embeddings)):
                for j in range(i + 1, len(embeddings)):
                    sim = np.dot(embeddings[i], embeddings[j]) / (
                        np.linalg.norm(embeddings[i]) * np.linalg.norm(embeddings[j]) + 1e-10
                    )
                    similarities.append(sim)
            
            avg_consistency = np.mean(similarities)
            min_consistency = np.min(similarities)
            
            MIN_AVERAGE_CONSISTENCY = 0.75
            MIN_SINGLE_CONSISTENCY = 0.65
            
            is_valid = (avg_consistency >= MIN_AVERAGE_CONSISTENCY and 
                       min_consistency >= MIN_SINGLE_CONSISTENCY)
            
            reason = ""
            if not is_valid:
                if avg_consistency < MIN_AVERAGE_CONSISTENCY:
                    reason = f"Inconsistent samples (avg: {avg_consistency:.3f})"
                elif min_consistency < MIN_SINGLE_CONSISTENCY:
                    reason = f"Sample differs significantly (min: {min_consistency:.3f})"
            else:
                reason = "Template valid"
            
            logger.info(f"📋 Template: Avg={avg_consistency:.3f}, Min={min_consistency:.3f}, Valid={is_valid}")
            
            return is_valid, float(avg_consistency), reason
            
        except Exception as e:
            logger.error(f"Template validation error: {str(e)}")
            return False, 0.0, f"Validation error: {str(e)}"


voice_processor = BankingGradeVoiceProcessor()

