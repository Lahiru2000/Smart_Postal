"""
VerificationLink model – one-time-use video/voice verification links
sent by couriers to customers for identity confirmation.
"""

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from datetime import datetime
import uuid

from app.database import Base


class VerificationLink(Base):
    __tablename__ = "verification_links"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(64), unique=True, index=True, default=lambda: uuid.uuid4().hex)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=False)
    courier_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # pending | completed | expired | failed
    status = Column(String(20), default="pending")

    # URL to the uploaded / recorded video (stored as file path)
    video_path = Column(String(500), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
