from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class VideoCallCreate(BaseModel):
    callee_id: int
    shipment_id: Optional[int] = None


class VideoCallResponse(BaseModel):
    id: int
    room_id: str
    shipment_id: Optional[int] = None
    caller_id: int
    callee_id: int
    status: str
    started_at: datetime
    answered_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    caller_name: Optional[str] = None
    callee_name: Optional[str] = None

    class Config:
        from_attributes = True


class IncomingCallResponse(BaseModel):
    room_id: str
    caller_id: int
    caller_name: str
    shipment_id: Optional[int] = None
    shipment_tracking: Optional[str] = None
    started_at: datetime
