"""
Pydantic schemas for the delivery feature set.
All timestamps are returned as ISO-8601 strings for consistent frontend parsing.
"""

from __future__ import annotations
from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, Field, validator


# ── Postman Location ──────────────────────────────────────────────────────────

class LocationUpdateRequest(BaseModel):
    lat:         float = Field(..., ge=-90,  le=90)
    lng:         float = Field(..., ge=-180, le=180)
    accuracy_m:  Optional[float] = None
    heading:     Optional[float] = Field(None, ge=0, le=360)
    speed_kmh:   Optional[float] = Field(None, ge=0)
    is_available: bool = True


class NearbyPostman(BaseModel):
    postman_id:      int
    name:            str
    email:           str
    lat:             float
    lng:             float
    distance_km:     float
    is_available:    bool
    deliveries_left: int   # stops remaining in active session, or 0
    zone:            Optional[str] = None
    updated_at:      datetime

    class Config:
        from_attributes = True


# ── Delivery Session ──────────────────────────────────────────────────────────

class RouteStop(BaseModel):
    name:     str
    lat:      float
    lng:      float
    priority: str = "normal"


class StartSessionRequest(BaseModel):
    route_data:       List[RouteStop]
    google_maps_url:  Optional[str] = None
    total_distance_m: Optional[int] = None
    total_duration_s: Optional[int] = None


class CompleteStopRequest(BaseModel):
    stop_index: int


class EndSessionRequest(BaseModel):
    status: str = "completed"   # completed | abandoned


class SessionResponse(BaseModel):
    id:               int
    postman_id:       int
    postman_name:     str
    route_data:       List[Any]
    total_stops:      int
    completed_stops:  List[int]
    current_stop_idx: int
    status:           str
    google_maps_url:  Optional[str]
    started_at:       datetime
    ended_at:         Optional[datetime]
    total_distance_m: Optional[int]
    total_duration_s: Optional[int]

    class Config:
        from_attributes = True


# ── Disruption Events ─────────────────────────────────────────────────────────

class ReportDisruptionRequest(BaseModel):
    session_id:      int
    stop_index:      int
    stop_name:       Optional[str] = None
    disruption_type: str   # closure | accident | flooding | construction
    lat:             Optional[float] = None
    lng:             Optional[float] = None

    @validator("disruption_type")
    def validate_type(cls, v):
        allowed = {"closure", "accident", "flooding", "construction"}
        if v not in allowed:
            raise ValueError(f"disruption_type must be one of {allowed}")
        return v


class ResolveDisruptionRequest(BaseModel):
    status:          str   # resolved | bypassed
    resolution_note: Optional[str] = None


class DisruptionResponse(BaseModel):
    id:              int
    session_id:      int
    postman_id:      int
    postman_name:    str
    stop_index:      int
    stop_name:       Optional[str]
    disruption_type: str
    description:     Optional[str]
    lat:             Optional[float]
    lng:             Optional[float]
    status:          str
    reported_at:     datetime
    resolved_at:     Optional[datetime]
    resolution_note: Optional[str]

    class Config:
        from_attributes = True


# ── Redirection Events ────────────────────────────────────────────────────────

class CreateRedirectionRequest(BaseModel):
    session_id:     int
    stop_index:     int
    stop_name:      Optional[str] = None
    stop_lat:       Optional[float] = None
    stop_lng:       Optional[float] = None
    to_postman_id:  int
    reason:         str = Field(..., min_length=3, max_length=255)


class RedirectionResponse(BaseModel):
    id:              int
    session_id:      int
    from_postman_id: int
    from_postman_name: str
    to_postman_id:   int
    to_postman_name: str
    to_postman_zone: Optional[str]
    stop_index:      int
    stop_name:       Optional[str]
    stop_lat:        Optional[float]
    stop_lng:        Optional[float]
    reason:          str
    status:          str
    created_at:      datetime
    accepted_at:     Optional[datetime]

    class Config:
        from_attributes = True
