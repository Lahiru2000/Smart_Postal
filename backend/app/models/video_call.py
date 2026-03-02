from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class VideoCallSession(Base):
    __tablename__ = "video_call_sessions"

    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=False)
    courier_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    initiated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    session_token = Column(String(100), unique=True, index=True, nullable=False)
    status = Column(String(20), default="ringing")  # ringing, active, completed, expired, cancelled
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    ended_at = Column(DateTime, nullable=True)

    # Relationships
    shipment = relationship("Shipment", backref="call_sessions")
    courier = relationship("User", foreign_keys=[courier_id])
    customer = relationship("User", foreign_keys=[customer_id])
    initiator = relationship("User", foreign_keys=[initiated_by])
    decision = relationship("DeliveryDecision", back_populates="call_session", uselist=False)
    media_captures = relationship("CallMediaCapture", back_populates="call_session")
    verification = relationship("CustomerVerification", back_populates="call_session", uselist=False)


class DeliveryDecision(Base):
    __tablename__ = "delivery_decisions"

    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=False)
    call_session_id = Column(Integer, ForeignKey("video_call_sessions.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    decision = Column(String(20), nullable=False)  # return, neighbor, locker
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    blockchain_hash = Column(String(64), nullable=True)  # SHA-256 tamper-proof hash

    # Relationships
    call_session = relationship("VideoCallSession", back_populates="decision")
    shipment = relationship("Shipment", backref="delivery_decisions")
    customer = relationship("User", foreign_keys=[customer_id])


class CallMediaCapture(Base):
    __tablename__ = "call_media_captures"

    id = Column(Integer, primary_key=True, index=True)
    call_session_id = Column(Integer, ForeignKey("video_call_sessions.id"), nullable=False)
    capture_type = Column(String(20), default="frame")  # frame, snapshot
    encrypted_data = Column(Text, nullable=True)  # Base64 encrypted image data
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    call_session = relationship("VideoCallSession", back_populates="media_captures")


class CustomerVerification(Base):
    """Stores the courier's verification decision for a customer."""
    __tablename__ = "customer_verifications"

    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=False)
    call_session_id = Column(Integer, ForeignKey("video_call_sessions.id"), nullable=False)
    courier_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_verified = Column(Boolean, default=False)
    method = Column(String(20), default="video_call")  # video_call, async_video
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    call_session = relationship("VideoCallSession", back_populates="verification")
    shipment = relationship("Shipment", backref="verifications")
    courier = relationship("User", foreign_keys=[courier_id])
    customer = relationship("User", foreign_keys=[customer_id])


class AsyncVerificationToken(Base):
    """Token sent to customer for async video/voice verification."""
    __tablename__ = "async_verification_tokens"

    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=False)
    call_session_id = Column(Integer, ForeignKey("video_call_sessions.id"), nullable=True)
    courier_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token = Column(String(100), unique=True, index=True, nullable=False)
    status = Column(String(20), default="pending")  # pending, submitted, verified, rejected, expired
    video_data = Column(Text, nullable=True)  # Base64 video/image data submitted by customer
    audio_data = Column(Text, nullable=True)  # Base64 audio data
    ai_confidence = Column(Integer, nullable=True)  # AI match confidence 0-100
    ai_result = Column(String(20), nullable=True)  # match, no_match, inconclusive
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    submitted_at = Column(DateTime, nullable=True)

    # Relationships
    shipment = relationship("Shipment", backref="async_verifications")
    courier = relationship("User", foreign_keys=[courier_id])
    customer = relationship("User", foreign_keys=[customer_id])
