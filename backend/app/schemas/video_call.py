from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# --- Video Call Schemas ---

class InitiateCallRequest(BaseModel):
    shipment_id: int


class CallSessionResponse(BaseModel):
    id: int
    session_token: str
    shipment_id: int
    courier_id: int
    customer_id: int
    status: str
    created_at: datetime
    expires_at: datetime
    ended_at: Optional[datetime] = None
    initiated_by: Optional[int] = None

    class Config:
        from_attributes = True


# --- Delivery Decision Schemas ---

class DeliveryDecisionRequest(BaseModel):
    call_session_id: int
    decision: str  # "return", "neighbor", "locker"
    notes: Optional[str] = None


class DeliveryDecisionResponse(BaseModel):
    id: int
    shipment_id: int
    call_session_id: int
    customer_id: int
    decision: str
    notes: Optional[str] = None
    created_at: datetime
    blockchain_hash: Optional[str] = None

    class Config:
        from_attributes = True


# --- Media Capture Schemas ---

class CaptureFrameRequest(BaseModel):
    image_data: str  # Base64 encoded


class MediaCaptureResponse(BaseModel):
    id: int
    call_session_id: int
    capture_type: str
    created_at: datetime
    encrypted_data: Optional[str] = None

    class Config:
        from_attributes = True


# --- Customer Verification Schemas ---

class VerifyCustomerRequest(BaseModel):
    call_session_id: int
    is_verified: bool
    notes: Optional[str] = None


class CustomerVerificationResponse(BaseModel):
    id: int
    shipment_id: int
    call_session_id: int
    courier_id: int
    customer_id: int
    is_verified: bool
    method: str
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# --- Async Verification Schemas ---

class SendAsyncVerificationRequest(BaseModel):
    shipment_id: int
    call_session_id: Optional[int] = None


class AsyncVerificationResponse(BaseModel):
    id: int
    shipment_id: int
    call_session_id: Optional[int] = None
    courier_id: int
    customer_id: int
    token: str
    status: str
    ai_confidence: Optional[int] = None
    ai_result: Optional[str] = None
    created_at: datetime
    expires_at: datetime
    submitted_at: Optional[datetime] = None
    # Populated by the /async/{token}/frames endpoint (not stored in DB)
    video_frames: Optional[List[str]] = None

    class Config:
        from_attributes = True


class AsyncVerificationSubmitRequest(BaseModel):
    video_data: str  # Base64 encoded frames joined by "||"
    audio_data: Optional[str] = None  # Base64 encoded audio


class AsyncVerificationDecideRequest(BaseModel):
    is_verified: bool
    notes: Optional[str] = None


class AsyncVerificationAnalyzeResponse(BaseModel):
    """Returned by POST /async/{token}/analyze"""
    is_match: bool
    confidence: float           # 0-1
    avg_similarity: float       # 0-1
    avg_liveness: float         # 0-1
    frame_count: int
    frames_analysed: int
    ai_confidence: int          # 0-100 integer stored back on the token
    ai_result: str              # match | no_match | inconclusive
    error: Optional[str] = None
    courier_decision: Optional[dict] = None

    class Config:
        from_attributes = True


class VerificationDashboardResponse(BaseModel):
    session: CallSessionResponse
    captures: List[MediaCaptureResponse]
    verification: Optional[CustomerVerificationResponse] = None
    shipment_id: int
    customer_id: int
    courier_id: int
    reference_image_url: Optional[str] = None  # Shipment registration photo for AI comparison
