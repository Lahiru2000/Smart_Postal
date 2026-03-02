from sqlalchemy import Column, Integer, String, Float, Boolean, Text, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class VoiceEnrollment(Base):
    """Tracks voice enrollment sessions for customers."""
    __tablename__ = "voice_enrollments"

    id = Column(Integer, primary_key=True, index=True)
    enrollment_id = Column(String(64), unique=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    required_samples = Column(Integer, default=3)
    verified_samples = Column(Integer, default=0)
    status = Column(String(20), default="pending")  # pending, completed, denied
    denied_reason = Column(String(255), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="voice_enrollments")
    samples = relationship("VoiceEnrollmentSample", back_populates="enrollment", cascade="all, delete-orphan")


class VoiceEnrollmentSample(Base):
    """Stores individual voice sample results during enrollment."""
    __tablename__ = "voice_enrollment_samples"

    id = Column(Integer, primary_key=True, index=True)
    enrollment_id = Column(Integer, ForeignKey("voice_enrollments.id"), nullable=False)
    sample_number = Column(Integer, nullable=False)
    
    is_human = Column(Boolean, nullable=False)
    confidence = Column(Float, nullable=True)
    ai_probability = Column(Float, nullable=True)
    analysis_details = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    enrollment = relationship("VoiceEnrollment", back_populates="samples")


class VoiceProfile(Base):
    """Stores a customer's verified voice profile after successful enrollment."""
    __tablename__ = "voice_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    
    sample_count = Column(Integer, default=3)
    voice_vector = Column(JSON, nullable=True)  # Stored audio fingerprint vector
    is_active = Column(Boolean, default=True)
    
    enrolled_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="voice_profile")


class VoiceVerification(Base):
    """Tracks voice verification sessions during delivery."""
    __tablename__ = "voice_verifications"

    id = Column(Integer, primary_key=True, index=True)
    verification_id = Column(String(64), unique=True, index=True)
    
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    courier_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    challenge_phrase = Column(String(255), nullable=True)
    status = Column(String(20), default="pending")  # pending, approved, failed, expired
    
    is_human = Column(Boolean, nullable=True)
    confidence = Column(Float, nullable=True)
    speaker_similarity = Column(Float, nullable=True)
    delivery_approved = Column(Boolean, default=False)
    analysis_details = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime, nullable=True)

    shipment = relationship("Shipment", back_populates="voice_verifications")
    customer = relationship("User", foreign_keys=[customer_id])
    courier = relationship("User", foreign_keys=[courier_id])
