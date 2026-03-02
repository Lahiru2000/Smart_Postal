import uuid
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


def generate_room_id():
    return str(uuid.uuid4())


class VideoCallSession(Base):
    __tablename__ = "video_call_sessions"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(String(36), unique=True, index=True, default=generate_room_id)

    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=True)
    caller_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    callee_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    status = Column(String(20), default="ringing")
    # Statuses: ringing, active, ended, missed, declined

    started_at = Column(DateTime, default=datetime.utcnow)
    answered_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)

    # Relationships
    caller = relationship("User", foreign_keys=[caller_id])
    callee = relationship("User", foreign_keys=[callee_id])
    shipment = relationship("Shipment", foreign_keys=[shipment_id])
