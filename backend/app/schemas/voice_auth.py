from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime


# ── Enrollment Schemas ──────────────────────────────────────────

class EnrollmentStartRequest(BaseModel):
    """Customer starts voice enrollment."""
    pass  # user_id comes from auth token


class EnrollmentStartResponse(BaseModel):
    status: str
    enrollment_id: str
    customer_id: int
    required_samples: int
    verified_samples: int
    expires_in_seconds: int
    message: str


class EnrollmentSampleResponse(BaseModel):
    status: str
    enrollment_id: str
    customer_id: int
    verified_samples: int
    required_samples: int
    enrollment_complete: bool
    message: str
    analysis: Optional[Dict[str, Any]] = None


class EnrollmentStatusResponse(BaseModel):
    enrolled: bool
    status: Optional[str] = None
    verified_samples: Optional[int] = None
    required_samples: Optional[int] = None
    enrollment_id: Optional[str] = None


# ── Verification Schemas ────────────────────────────────────────

class VerificationStartRequest(BaseModel):
    """Courier initiates voice verification for a shipment."""
    shipment_id: int


class VerificationStartResponse(BaseModel):
    status: str
    verification_id: str
    customer_id: int
    shipment_id: int
    challenge_phrase: Optional[str] = None
    verification_link: str
    expires_in_seconds: int
    message: str


class VerificationSubmitResponse(BaseModel):
    status: str
    verification_id: str
    customer_id: int
    shipment_id: int
    delivery_approved: bool
    is_human: bool
    confidence: Optional[float] = None
    speaker_similarity: Optional[float] = None
    message: str
    analysis: Optional[Dict[str, Any]] = None


class VerificationStatusResponse(BaseModel):
    verification_id: str
    shipment_id: int
    status: str
    delivery_approved: bool
    challenge_phrase: Optional[str] = None
    expires_at: Optional[str] = None
    message: str


# ── Voice Analysis Schemas ──────────────────────────────────────

class VoiceAnalysisResult(BaseModel):
    model_config = {"protected_namespaces": ()}

    is_human: bool
    ai_generated: bool
    confidence: float
    ai_probability: float
    fused_score: Optional[float] = None
    message: str
    risk_tier: Optional[str] = None
    decision_reason: Optional[str] = None
    model_scores: Optional[Dict[str, Any]] = None
    analysis_details: Optional[Dict[str, Any]] = None


# ── Updated Shipment Schemas (additions) ────────────────────────

class ShipmentVoiceStatus(BaseModel):
    shipment_id: int
    voice_verification_required: bool
    voice_verification_status: Optional[str] = None
    customer_enrolled: bool
