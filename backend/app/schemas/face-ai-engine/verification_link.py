"""
Pydantic schemas for the verification link feature.
"""

from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class VerificationLinkCreate(BaseModel):
    """Courier creates a link — only needs the shipment id."""
    shipment_id: int


class VerificationLinkResponse(BaseModel):
    id: int
    token: str
    shipment_id: int
    courier_id: int
    customer_id: int
    status: str
    video_path: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    link: Optional[str] = None  # actual URL built in route

    # AI verification result fields
    ai_match: Optional[bool] = None
    face_score: Optional[float] = None
    voice_score: Optional[float] = None
    combined_score: Optional[float] = None
    confidence: Optional[str] = None
    verdict: Optional[str] = None
    face_available: Optional[bool] = None
    voice_available: Optional[bool] = None
    ai_error: Optional[str] = None

    class Config:
        from_attributes = True


class VerificationLinkPublic(BaseModel):
    """What the customer sees when opening the link (no auth required)."""
    token: str
    shipment_tracking: Optional[str] = None
    courier_name: Optional[str] = None
    status: str
    expires_at: Optional[datetime] = None


class VerificationResultResponse(BaseModel):
    """AI verification result returned to both courier and customer."""
    token: str
    status: str
    ai_match: Optional[bool] = None
    face_score: Optional[float] = None
    voice_score: Optional[float] = None
    combined_score: Optional[float] = None
    confidence: Optional[str] = None        # HIGH | MEDIUM | LOW
    verdict: Optional[str] = None           # SAME PERSON | DIFFERENT PERSON
    face_available: Optional[bool] = None
    voice_available: Optional[bool] = None
    ai_error: Optional[str] = None
    completed_at: Optional[datetime] = None
