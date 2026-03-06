"""
VerificationLink model – one-time-use video/voice verification links
sent by couriers to customers for identity confirmation.
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, Text
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

    # pending | completed | processing | verified | expired | failed
    status = Column(String(20), default="pending")

    # URL to the uploaded / recorded video (stored as file path)
    video_path = Column(String(500), nullable=True)

    # ── AI Verification Result fields ───────────────────────────────
    ai_match = Column(Boolean, nullable=True)              # True = SAME PERSON
    face_score = Column(Float, nullable=True)              # 0.0–1.0
    voice_score = Column(Float, nullable=True)             # 0.0–1.0
    combined_score = Column(Float, nullable=True)          # weighted combination
    confidence = Column(String(20), nullable=True)         # HIGH | MEDIUM | LOW
    verdict = Column(String(30), nullable=True)            # SAME PERSON | DIFFERENT PERSON
    face_available = Column(Boolean, nullable=True)        # was face detected?
    voice_available = Column(Boolean, nullable=True)       # was audio usable?
    ai_error = Column(Text, nullable=True)                 # error message if AI failed

    # ── Delivery preference (set by customer after successful verification) ──
    delivery_preference = Column(String(30), nullable=True)  # deliver_to_neighbor | place_in_locker | return_order
    delivery_message = Column(Text, nullable=True)           # optional note from customer

    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
