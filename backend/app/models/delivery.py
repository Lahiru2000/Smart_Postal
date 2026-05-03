"""
Delivery-related SQLAlchemy models for SmartPostal.

Tables:
  - postman_locations   : Real-time GPS positions broadcast by postmen
  - delivery_sessions   : One per active dispatch, tracks progress
  - disruption_events   : Road closures / accidents reported mid-route
  - redirection_events  : Parcel handoffs between postmen

ENHANCED: Added start_location tracking for clear route visualization
"""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean,
    DateTime, ForeignKey, JSON, Text, Enum
)
from sqlalchemy.orm import relationship
import enum

from app.database import Base


# ── Enumerations ──────────────────────────────────────────────────────────────

class SessionStatus(str, enum.Enum):
    active    = "active"
    completed = "completed"
    abandoned = "abandoned"


class DisruptionType(str, enum.Enum):
    closure      = "closure"
    accident     = "accident"
    flooding     = "flooding"
    construction = "construction"


class DisruptionStatus(str, enum.Enum):
    reported = "reported"
    resolved = "resolved"
    bypassed = "bypassed"


class RedirectionStatus(str, enum.Enum):
    pending    = "pending"
    accepted   = "accepted"
    transferred = "transferred"
    rejected   = "rejected"


# ── Models ────────────────────────────────────────────────────────────────────

class PostmanLocation(Base):
    """
    Upserted every time a postman's browser fires the Geolocation API.
    One row per postman (unique constraint on postman_id).
    """
    __tablename__ = "postman_locations"

    id           = Column(Integer, primary_key=True, index=True)
    postman_id   = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    lat          = Column(Float, nullable=False)
    lng          = Column(Float, nullable=False)
    accuracy_m   = Column(Float, nullable=True)          # GPS accuracy in metres
    heading      = Column(Float, nullable=True)          # degrees 0-360
    speed_kmh    = Column(Float, nullable=True)
    is_available = Column(Boolean, default=True)         # not mid-break / off-shift
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # back-ref (optional, lazy)
    postman      = relationship("User", foreign_keys=[postman_id], lazy="joined")


class DeliverySession(Base):
    """
    Represents one postman's full delivery run.
    Created when the postman presses "Start Delivery" in the UI.
    
    ENHANCED: Now tracks start_location for clear route visualization
    """
    __tablename__ = "delivery_sessions"

    id              = Column(Integer, primary_key=True, index=True)
    postman_id      = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Full optimised route stored as JSON so we don't need a stops table
    route_data      = Column(JSON, nullable=False)       # List[{name, lat, lng, priority}]
    total_stops     = Column(Integer, nullable=False)
    completed_stops = Column(JSON, default=list)         # List[int] indices
    current_stop_idx = Column(Integer, default=0)

    status          = Column(String(20), default=SessionStatus.active)
    google_maps_url = Column(Text, nullable=True)

    # NEW: Track where delivery started from
    start_location  = Column(JSON, nullable=True)        # {lat, lng, name}

    started_at      = Column(DateTime, default=datetime.utcnow)
    ended_at        = Column(DateTime, nullable=True)
    total_distance_m = Column(Integer, nullable=True)
    total_duration_s = Column(Integer, nullable=True)

    # Relationships
    postman         = relationship("User", foreign_keys=[postman_id], lazy="joined")
    disruptions     = relationship("DisruptionEvent", back_populates="session", lazy="dynamic")
    redirections    = relationship("RedirectionEvent", back_populates="session", lazy="dynamic")


class DisruptionEvent(Base):
    """
    A road disruption reported by a postman mid-delivery.
    Triggers automatic re-routing in the frontend.
    """
    __tablename__ = "disruption_events"

    id               = Column(Integer, primary_key=True, index=True)
    session_id       = Column(Integer, ForeignKey("delivery_sessions.id"), nullable=False, index=True)
    postman_id       = Column(Integer, ForeignKey("users.id"), nullable=False)

    stop_index       = Column(Integer, nullable=False)
    stop_name        = Column(String(500), nullable=True)
    disruption_type  = Column(String(30), nullable=False)   # DisruptionType values
    description      = Column(String(255), nullable=True)
    lat              = Column(Float, nullable=True)
    lng              = Column(Float, nullable=True)

    status           = Column(String(20), default=DisruptionStatus.reported)
    reported_at      = Column(DateTime, default=datetime.utcnow)
    resolved_at      = Column(DateTime, nullable=True)
    resolution_note  = Column(Text, nullable=True)

    # Relationships
    session          = relationship("DeliverySession", back_populates="disruptions")
    postman          = relationship("User", foreign_keys=[postman_id], lazy="joined")


class RedirectionEvent(Base):
    """
    A parcel/stop handed off from one postman to another.
    Logged for full auditability.
    """
    __tablename__ = "redirection_events"

    id               = Column(Integer, primary_key=True, index=True)
    session_id       = Column(Integer, ForeignKey("delivery_sessions.id"), nullable=False, index=True)
    from_postman_id  = Column(Integer, ForeignKey("users.id"), nullable=False)
    to_postman_id    = Column(Integer, ForeignKey("users.id"), nullable=False)

    stop_index       = Column(Integer, nullable=False)
    stop_name        = Column(String(500), nullable=True)
    stop_lat         = Column(Float, nullable=True)
    stop_lng         = Column(Float, nullable=True)

    reason           = Column(String(255), nullable=False)
    status           = Column(String(20), default=RedirectionStatus.transferred)

    created_at       = Column(DateTime, default=datetime.utcnow)
    accepted_at      = Column(DateTime, nullable=True)

    # Relationships
    session          = relationship("DeliverySession", back_populates="redirections")
    from_postman     = relationship("User", foreign_keys=[from_postman_id], lazy="joined")
    to_postman       = relationship("User", foreign_keys=[to_postman_id],   lazy="joined")
