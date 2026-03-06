"""
Delivery router — all endpoints for:
  • Postman GPS location broadcasting & nearby-postman lookup
  • Delivery session lifecycle (start, progress, end)
  • Disruption reporting & resolution
  • Inter-postman redirection / handoff
  • NEW: Dynamic priority updates with auto re-routing

Prefix: /delivery
Auth:   None (open endpoints — add JWT when ready)
"""

import math
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.delivery import (
    PostmanLocation,
    DeliverySession,
    DisruptionEvent,
    RedirectionEvent,
)
from app.schemas.delivery import (
    LocationUpdateRequest,
    NearbyPostman,
    StartSessionRequest,
    CompleteStopRequest,
    EndSessionRequest,
    SessionResponse,
    ReportDisruptionRequest,
    ResolveDisruptionRequest,
    DisruptionResponse,
    CreateRedirectionRequest,
    RedirectionResponse,
    UpdatePriorityRequest,  # NEW
    ReoptimizeRouteRequest,  # NEW
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/delivery", tags=["Delivery"])

# ─────────────────────────────────────────────────────────────────────────────
# AUTH DEPENDENCY — no login required, uses first user in DB
# ─────────────────────────────────────────────────────────────────────────────

def get_current_user(db: Session = Depends(get_db)) -> User:
    user = db.query(User).first()
    if not user:
        raise HTTPException(status_code=404, detail="No users found in database")
    return user


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return great-circle distance in km between two lat/lng points."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


DISRUPTION_DESCRIPTIONS = {
    "closure":      "Road closure reported",
    "accident":     "Accident blocking route",
    "flooding":     "Road flooding / impassable",
    "construction": "Unexpected roadworks",
}

# NEW: Priority scoring for optimization
PRIORITY_SCORES = {
    "urgent": 100,
    "high": 70,
    "normal": 40,
    "low": 10,
}


def _session_response(session: DeliverySession) -> dict:
    postman_name = (
        f"{session.postman.first_name} {session.postman.last_name}".strip()
        if hasattr(session.postman, "first_name")
        else session.postman.email
    )
    return {
        "id":               session.id,
        "postman_id":       session.postman_id,
        "postman_name":     postman_name,
        "route_data":       session.route_data,
        "total_stops":      session.total_stops,
        "completed_stops":  session.completed_stops or [],
        "current_stop_idx": session.current_stop_idx,
        "status":           session.status,
        "google_maps_url":  session.google_maps_url,
        "started_at":       session.started_at,
        "ended_at":         session.ended_at,
        "total_distance_m": session.total_distance_m,
        "total_duration_s": session.total_duration_s,
        "start_location":   getattr(session, "start_location", None),
    }


def _disruption_response(d: DisruptionEvent) -> dict:
    postman_name = (
        f"{d.postman.first_name} {d.postman.last_name}".strip()
        if hasattr(d.postman, "first_name")
        else d.postman.email
    )
    return {
        "id":              d.id,
        "session_id":      d.session_id,
        "postman_id":      d.postman_id,
        "postman_name":    postman_name,
        "stop_index":      d.stop_index,
        "stop_name":       d.stop_name,
        "disruption_type": d.disruption_type,
        "description":     d.description,
        "lat":             d.lat,
        "lng":             d.lng,
        "status":          d.status,
        "reported_at":     d.reported_at,
        "resolved_at":     d.resolved_at,
        "resolution_note": d.resolution_note,
    }


def _redirection_response(r: RedirectionEvent) -> dict:
    from_name = (
        f"{r.from_postman.first_name} {r.from_postman.last_name}".strip()
        if hasattr(r.from_postman, "first_name")
        else r.from_postman.email
    )
    to_name = (
        f"{r.to_postman.first_name} {r.to_postman.last_name}".strip()
        if hasattr(r.to_postman, "first_name")
        else r.to_postman.email
    )
    return {
        "id":               r.id,
        "session_id":       r.session_id,
        "from_postman_id":  r.from_postman_id,
        "from_postman_name": from_name,
        "to_postman_id":    r.to_postman_id,
        "to_postman_name":  to_name,
        "to_postman_zone":  getattr(r.to_postman, "zone", None),
        "stop_index":       r.stop_index,
        "stop_name":        r.stop_name,
        "stop_lat":         r.stop_lat,
        "stop_lng":         r.stop_lng,
        "reason":           r.reason,
        "status":           r.status,
        "created_at":       r.created_at,
        "accepted_at":      r.accepted_at,
    }


# ─────────────────────────────────────────────────────────────────────────────
# POSTMAN LOCATION
# ─────────────────────────────────────────────────────────────────────────────

@router.put(
    "/location",
    summary="Broadcast postman GPS position",
    description="Called every ~10 s by the postman's browser Geolocation watchPosition.",
)
def update_location(
    payload: LocationUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    loc = db.query(PostmanLocation).filter_by(postman_id=current_user.id).first()
    if loc:
        loc.lat          = payload.lat
        loc.lng          = payload.lng
        loc.accuracy_m   = payload.accuracy_m
        loc.heading      = payload.heading
        loc.speed_kmh    = payload.speed_kmh
        loc.is_available = payload.is_available
        loc.updated_at   = datetime.utcnow()
    else:
        loc = PostmanLocation(
            postman_id   = current_user.id,
            lat          = payload.lat,
            lng          = payload.lng,
            accuracy_m   = payload.accuracy_m,
            heading      = payload.heading,
            speed_kmh    = payload.speed_kmh,
            is_available = payload.is_available,
        )
        db.add(loc)
    db.commit()
    return {"status": "ok", "updated_at": loc.updated_at.isoformat()}


@router.get(
    "/postmen/nearby",
    response_model=List[NearbyPostman],
    summary="Fetch postmen within a radius for handoff suggestions",
)
def get_nearby_postmen(
    lat:    float = Query(..., ge=-90,  le=90),
    lng:    float = Query(..., ge=-180, le=180),
    radius: float = Query(10.0, ge=0.5, le=50, description="Search radius in km"),
    db:     Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns all postmen whose last known GPS position is within `radius` km,
    ordered by ascending distance. Excludes the requesting postman.
    """
    all_locations = (
        db.query(PostmanLocation)
        .join(User, User.id == PostmanLocation.postman_id)
        .filter(PostmanLocation.postman_id != current_user.id)
        .all()
    )

    results: List[NearbyPostman] = []
    for loc in all_locations:
        dist = haversine_km(lat, lng, loc.lat, loc.lng)
        if dist > radius:
            continue

        # Count remaining stops in their active session (if any)
        active_session = (
            db.query(DeliverySession)
            .filter_by(postman_id=loc.postman_id, status="active")
            .first()
        )
        deliveries_left = 0
        if active_session:
            completed = set(active_session.completed_stops or [])
            deliveries_left = active_session.total_stops - len(completed)

        u = loc.postman
        name = (
            f"{u.first_name} {u.last_name}".strip()
            if hasattr(u, "first_name")
            else u.email.split("@")[0]
        )
        results.append(
            NearbyPostman(
                postman_id=loc.postman_id,
                name=name,
                email=u.email,
                lat=loc.lat,
                lng=loc.lng,
                distance_km=round(dist, 2),
                is_available=loc.is_available,
                deliveries_left=deliveries_left,
                zone=getattr(u, "zone", None),
                updated_at=loc.updated_at,
            )
        )

    results.sort(key=lambda x: x.distance_km)
    return results


# ─────────────────────────────────────────────────────────────────────────────
# DELIVERY SESSIONS
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/sessions",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start a new delivery session",
)
def start_session(
    payload: StartSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Creates a new delivery session.
    Stores the full route as JSON so we can track priorities dynamically.
    """
    # Close any existing active sessions for this postman
    db.query(DeliverySession).filter_by(
        postman_id=current_user.id, status="active"
    ).update({"status": "abandoned", "ended_at": datetime.utcnow()})

    route_json = [r.dict() for r in payload.route_data]
    session = DeliverySession(
        postman_id=current_user.id,
        route_data=route_json,
        total_stops=len(route_json),
        completed_stops=[],
        current_stop_idx=0,
        status="active",
        google_maps_url=payload.google_maps_url,
        total_distance_m=payload.total_distance_m,
        total_duration_s=payload.total_duration_s,
        start_location=payload.start_location,  # NEW
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    logger.info(
        f"Delivery session {session.id} started by {current_user.email} with {len(route_json)} stops"
    )
    return _session_response(session)


@router.get(
    "/sessions/{session_id}",
    response_model=SessionResponse,
    summary="Get session details",
)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.query(DeliverySession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.postman_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return _session_response(session)


@router.get(
    "/sessions/active/me",
    response_model=Optional[SessionResponse],
    summary="Get caller's active session",
)
def get_active_session(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns the currently active session for the logged-in postman, or null."""
    session = (
        db.query(DeliverySession)
        .filter_by(postman_id=current_user.id, status="active")
        .first()
    )
    return _session_response(session) if session else None


@router.patch(
    "/sessions/{session_id}/stop/{stop_index}/complete",
    response_model=SessionResponse,
    summary="Mark a stop as delivered",
)
def complete_stop(
    session_id: int,
    stop_index: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.query(DeliverySession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.postman_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    completed = set(session.completed_stops or [])
    if stop_index not in completed:
        completed.add(stop_index)
        session.completed_stops = list(completed)

    # Advance current_stop_idx to next incomplete stop
    for i in range(session.current_stop_idx, session.total_stops):
        if i not in completed:
            session.current_stop_idx = i
            break
    else:
        session.current_stop_idx = session.total_stops

    db.commit()
    db.refresh(session)
    return _session_response(session)


@router.patch(
    "/sessions/{session_id}/end",
    response_model=SessionResponse,
    summary="End a session (completed or abandoned)",
)
def end_session(
    session_id: int,
    payload: EndSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.query(DeliverySession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.postman_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    session.status = payload.status
    session.ended_at = datetime.utcnow()
    db.commit()
    db.refresh(session)
    return _session_response(session)


# ═══════════════════════════════════════════════════════════════════════════
# NEW: DYNAMIC PRIORITY UPDATES
# ═══════════════════════════════════════════════════════════════════════════

@router.patch(
    "/sessions/{session_id}/stop/{stop_index}/priority",
    response_model=SessionResponse,
    summary="Update stop priority during active delivery",
    description="""
    Updates the priority of a specific stop in an active delivery session.
    The frontend should trigger route re-optimization after this call.
    
    Priority levels: urgent > high > normal > low
    """
)
def update_stop_priority(
    session_id: int,
    stop_index: int,
    payload: UpdatePriorityRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.query(DeliverySession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.postman_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if session.status != "active":
        raise HTTPException(status_code=400, detail="Session is not active")
    
    # Validate stop index
    if stop_index < 0 or stop_index >= session.total_stops:
        raise HTTPException(status_code=400, detail="Invalid stop index")
    
    # Update priority in route_data
    route_data = session.route_data
    if stop_index < len(route_data):
        old_priority = route_data[stop_index].get("priority", "normal")
        route_data[stop_index]["priority"] = payload.new_priority
        session.route_data = route_data
        
        db.commit()
        db.refresh(session)
        
        logger.info(
            f"Session {session_id} stop {stop_index} priority changed: "
            f"{old_priority} → {payload.new_priority}"
        )
    
    return _session_response(session)


# ─────────────────────────────────────────────────────────────────────────────
# DISRUPTIONS
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/disruptions",
    response_model=DisruptionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Report a road disruption",
)
def report_disruption(
    payload: ReportDisruptionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.query(DeliverySession).filter_by(id=payload.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.postman_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    desc = DISRUPTION_DESCRIPTIONS.get(payload.disruption_type, "Disruption reported")
    event = DisruptionEvent(
        session_id=payload.session_id,
        postman_id=current_user.id,
        stop_index=payload.stop_index,
        stop_name=payload.stop_name,
        disruption_type=payload.disruption_type,
        description=desc,
        lat=payload.lat,
        lng=payload.lng,
        status="reported",
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    logger.info(
        f"Disruption {event.id} ({payload.disruption_type}) reported at stop {payload.stop_index} by {current_user.email}"
    )
    return _disruption_response(event)


@router.get(
    "/sessions/{session_id}/disruptions",
    response_model=List[DisruptionResponse],
    summary="List all disruptions for a session",
)
def get_session_disruptions(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.query(DeliverySession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.postman_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    events = (
        db.query(DisruptionEvent)
        .filter_by(session_id=session_id)
        .order_by(DisruptionEvent.reported_at.desc())
        .all()
    )
    return [_disruption_response(e) for e in events]


@router.patch(
    "/disruptions/{disruption_id}/resolve",
    response_model=DisruptionResponse,
    summary="Mark a disruption as resolved or bypassed",
)
def resolve_disruption(
    disruption_id: int,
    payload: ResolveDisruptionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = db.query(DisruptionEvent).filter_by(id=disruption_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Disruption not found")
    if event.postman_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    event.status = payload.status
    event.resolved_at = datetime.utcnow()
    event.resolution_note = payload.resolution_note
    db.commit()
    db.refresh(event)
    return _disruption_response(event)


# ─────────────────────────────────────────────────────────────────────────────
# REDIRECTIONS
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/redirections",
    response_model=RedirectionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Hand off a stop to another postman",
)
def create_redirection(
    payload: CreateRedirectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.query(DeliverySession).filter_by(id=payload.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.postman_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    target_postman = db.query(User).filter_by(id=payload.to_postman_id).first()
    if not target_postman:
        raise HTTPException(status_code=404, detail="Target postman not found")

    event = RedirectionEvent(
        session_id=payload.session_id,
        from_postman_id=current_user.id,
        to_postman_id=payload.to_postman_id,
        stop_index=payload.stop_index,
        stop_name=payload.stop_name,
        stop_lat=payload.stop_lat,
        stop_lng=payload.stop_lng,
        reason=payload.reason,
        status="transferred",
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    logger.info(
        "Redirection %d: stop %d handed from %s → %s",
        event.id, payload.stop_index, current_user.id, payload.to_postman_id,
    )
    return _redirection_response(event)


@router.get(
    "/sessions/{session_id}/redirections",
    response_model=List[RedirectionResponse],
    summary="List all redirections for a session",
)
def get_session_redirections(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.query(DeliverySession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.postman_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    events = (
        db.query(RedirectionEvent)
        .filter_by(session_id=session_id)
        .order_by(RedirectionEvent.created_at.desc())
        .all()
    )
    return [_redirection_response(e) for e in events]


@router.patch(
    "/redirections/{redirection_id}/accept",
    response_model=RedirectionResponse,
    summary="Receiving postman acknowledges the handoff",
)
def accept_redirection(
    redirection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = db.query(RedirectionEvent).filter_by(id=redirection_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Redirection not found")
    if event.to_postman_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the receiving postman can accept")

    event.status      = "accepted"
    event.accepted_at = datetime.utcnow()
    db.commit()
    db.refresh(event)
    return _redirection_response(event)


# ─────────────────────────────────────────────────────────────────────────────
# POSTMAN MANAGEMENT
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/postmen",
    summary="List all postmen with their current status and location",
)
def list_all_postmen(db: Session = Depends(get_db)):
    """
    Returns every user in the system along with their last known GPS location
    and active session info. Used by the management dashboard.
    """
    users = db.query(User).all()
    result = []
    for u in users:
        loc = db.query(PostmanLocation).filter_by(postman_id=u.id).first()
        active_session = (
            db.query(DeliverySession)
            .filter_by(postman_id=u.id, status="active")
            .first()
        )
        completed_count = 0
        total_stops     = 0
        session_id      = None
        if active_session:
            completed_count = len(active_session.completed_stops or [])
            total_stops     = active_session.total_stops
            session_id      = active_session.id

        name = getattr(u, "full_name", None) or u.email.split("@")[0]

        result.append({
            "id":             u.id,
            "name":           name,
            "email":          u.email,
            "role":           getattr(u, "role", "courier"),
            "phone":          getattr(u, "phone", None),
            "lat":            loc.lat          if loc else None,
            "lng":            loc.lng          if loc else None,
            "is_available":   loc.is_available if loc else True,
            "speed_kmh":      loc.speed_kmh    if loc else None,
            "last_seen":      loc.updated_at.isoformat() if loc else None,
            "session_id":     session_id,
            "on_delivery":    active_session is not None,
            "completed_stops": completed_count,
            "total_stops":    total_stops,
        })
    return result


@router.post(
    "/postmen",
    status_code=201,
    summary="Register a new postman account",
)
def create_postman(payload: dict, db: Session = Depends(get_db)):
    """
    Creates a new User with role=courier.
    Expects: { full_name, email, password, phone? }
    """
    import bcrypt

    email = payload.get("email", "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="email is required")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    full_name = payload.get("full_name", "").strip()
    if not full_name:
        raise HTTPException(status_code=400, detail="full_name is required")

    raw_password = payload.get("password", "")
    if len(raw_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # Hash password with bcrypt (same as your existing auth service)
    hashed = bcrypt.hashpw(raw_password.encode(), bcrypt.gensalt()).decode()

    new_user = User(
        email           = email,
        full_name       = full_name,
        phone           = payload.get("phone"),
        hashed_password = hashed,
        role            = "courier",
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    logger.info("New postman created: %s (id=%d)", email, new_user.id)
    return {
        "id":        new_user.id,
        "name":      new_user.full_name,
        "email":     new_user.email,
        "role":      str(new_user.role),
        "phone":     new_user.phone,
        "created":   True,
    }


@router.delete(
    "/postmen/{postman_id}",
    summary="Remove a postman account",
)
def delete_postman(postman_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(id=postman_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Postman not found")
    # Clean up location record
    db.query(PostmanLocation).filter_by(postman_id=postman_id).delete()
    db.delete(user)
    db.commit()
    return {"deleted": True, "id": postman_id}


# ─────────────────────────────────────────────────────────────────────────────
# HANDOFF EVENT MANAGEMENT
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/redirections",
    summary="List ALL handoff events across all sessions (management view)",
)
def list_all_redirections(
    limit:  int = Query(100, ge=1, le=500),
    offset: int = Query(0,   ge=0),
    status: str = Query(None, description="Filter by status: transferred|accepted|rejected"),
    db:     Session = Depends(get_db),
):
    q = db.query(RedirectionEvent).order_by(RedirectionEvent.created_at.desc())
    if status:
        q = q.filter(RedirectionEvent.status == status)
    total  = q.count()
    events = q.offset(offset).limit(limit).all()
    return {
        "total":  total,
        "offset": offset,
        "limit":  limit,
        "items":  [_redirection_response(e) for e in events],
    }


@router.get(
    "/redirections/stats",
    summary="Handoff event statistics for the dashboard",
)
def redirection_stats(db: Session = Depends(get_db)):
    from sqlalchemy import func
    total       = db.query(RedirectionEvent).count()
    transferred = db.query(RedirectionEvent).filter_by(status="transferred").count()
    accepted    = db.query(RedirectionEvent).filter_by(status="accepted").count()
    rejected    = db.query(RedirectionEvent).filter_by(status="rejected").count()

    # Top postmen by handoffs received
    top_receivers = (
        db.query(RedirectionEvent.to_postman_id, func.count().label("count"))
        .group_by(RedirectionEvent.to_postman_id)
        .order_by(func.count().desc())
        .limit(5)
        .all()
    )
    top_list = []
    for postman_id, count in top_receivers:
        u = db.query(User).filter_by(id=postman_id).first()
        if u:
            top_list.append({
                "postman_id": postman_id,
                "name":       getattr(u, "full_name", u.email.split("@")[0]),
                "count":      count,
            })

    return {
        "total":       total,
        "transferred": transferred,
        "accepted":    accepted,
        "rejected":    rejected,
        "top_receivers": top_list,
    }
