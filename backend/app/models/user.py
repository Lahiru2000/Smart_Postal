from sqlalchemy import Column, Integer, String, Enum, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class UserRole(str, enum.Enum):
    CUSTOMER = "customer"
    COURIER = "courier"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), unique=True, index=True)
    full_name = Column(String(100))
    hashed_password = Column(String(255))
    phone = Column(String(20))
    role = Column(Enum(UserRole), default=UserRole.CUSTOMER)

    # Relationships
    sent_shipments = relationship("Shipment", foreign_keys="Shipment.sender_id", back_populates="sender")
    assigned_shipments = relationship("Shipment", foreign_keys="Shipment.courier_id", back_populates="courier")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")


class RefreshToken(Base):
    """Stores issued refresh tokens — one per device/session.
    Supports token rotation: each refresh generates a new token and
    revokes the old one. A revoked token that is re-presented triggers
    a full family revocation (theft detection)."""

    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(128), unique=True, nullable=False, index=True)
    family_id = Column(String(64), nullable=False, index=True)  # groups tokens from same login
    is_revoked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)

    user = relationship("User", back_populates="refresh_tokens")