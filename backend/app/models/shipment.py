<<<<<<< HEAD
from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey, DateTime, LargeBinary
=======
from sqlalchemy import Column, Integer, String, Float, Boolean, Text, ForeignKey, DateTime
>>>>>>> 54e2011845a6733081074d04a5f29da037390fd1
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Shipment(Base):
    __tablename__ = "shipments"

    id = Column(Integer, primary_key=True, index=True)
    tracking_number = Column(String(50), unique=True, index=True)
    
    sender_id = Column(Integer, ForeignKey("users.id"))
    courier_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Sender details
    sender_name = Column(String(100))
    sender_phone = Column(String(20))
    pickup_address = Column(String(255))
    
    # Receiver details
    receiver_name = Column(String(100))
    receiver_phone = Column(String(20))
    delivery_address = Column(String(255))
    
    # Package details
    package_weight = Column(Float, nullable=True)
    package_type = Column(String(50), default="Standard")
    description = Column(Text, nullable=True)
    
    status = Column(String(50), default="Pending")
    image_url = Column(Text, nullable=True)  # Base64 data URL — needs Text (not String/255)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    voice_verification_required = Column(Boolean, default=False)
    voice_verification_status = Column(String(20), nullable=True)  # None, pending, approved, failed

    # Relationships
    sender = relationship("User", foreign_keys=[sender_id], back_populates="sent_shipments")
    courier = relationship("User", foreign_keys=[courier_id], back_populates="assigned_shipments")
    voice_verifications = relationship("VoiceVerification", back_populates="shipment")