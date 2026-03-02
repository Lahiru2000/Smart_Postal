from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List
from datetime import datetime, timedelta
import uuid
import hashlib

from app.database import get_db
from app.models.video_call import VideoCallSession, DeliveryDecision, CallMediaCapture
from app.models.shipment import Shipment
from app.models.user import User, UserRole
from app.schemas.video_call import (
    InitiateCallRequest, CallSessionResponse,
    DeliveryDecisionRequest, DeliveryDecisionResponse,
    CaptureFrameRequest, MediaCaptureResponse,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/calls", tags=["Video Calls"])

SESSION_EXPIRY_MINUTES = 10


@router.post("/initiate", response_model=CallSessionResponse)
def initiate_call(
    req: InitiateCallRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Either party initiates a video call for a shipment."""
    shipment = db.query(Shipment).filter(Shipment.id == req.shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    # Must be associated with the shipment
    if current_user.id not in [shipment.sender_id, shipment.courier_id]:
        raise HTTPException(status_code=403, detail="You are not associated with this shipment")

    # Need both parties to exist
    if not shipment.courier_id or not shipment.sender_id:
        raise HTTPException(status_code=400, detail="Both customer and courier must be assigned to this shipment")

    # Cancel any existing ringing/active sessions for this shipment
    existing = (
        db.query(VideoCallSession)
        .filter(
            VideoCallSession.shipment_id == req.shipment_id,
            VideoCallSession.status.in_(["ringing", "pending", "active"]),
        )
        .all()
    )
    for s in existing:
        if s.expires_at < datetime.utcnow():
            s.status = "expired"
        else:
            s.status = "cancelled"
            s.ended_at = datetime.utcnow()
    if existing:
        db.commit()

    session_token = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(minutes=SESSION_EXPIRY_MINUTES)

    call_session = VideoCallSession(
        shipment_id=req.shipment_id,
        courier_id=shipment.courier_id,
        customer_id=shipment.sender_id,
        session_token=session_token,
        status="ringing",
        expires_at=expires_at,
        initiated_by=current_user.id,
    )
    db.add(call_session)
    db.commit()
    db.refresh(call_session)
    return call_session


@router.get("/incoming", response_model=List[CallSessionResponse])
def get_incoming_calls(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get incoming ringing calls where the current user is the callee (not the initiator)."""
    now = datetime.utcnow()

    # Auto-expire old ringing sessions
    expired = (
        db.query(VideoCallSession)
        .filter(
            VideoCallSession.status == "ringing",
            VideoCallSession.expires_at < now,
        )
        .all()
    )
    for s in expired:
        s.status = "expired"
    if expired:
        db.commit()

    calls = (
        db.query(VideoCallSession)
        .filter(
            VideoCallSession.status == "ringing",
            VideoCallSession.initiated_by != current_user.id,
            VideoCallSession.expires_at >= now,
            or_(
                VideoCallSession.customer_id == current_user.id,
                VideoCallSession.courier_id == current_user.id,
            ),
        )
        .order_by(VideoCallSession.created_at.desc())
        .all()
    )
    return calls


@router.get("/pending", response_model=List[CallSessionResponse])
def get_pending_calls(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all ringing or active calls for the current user."""
    now = datetime.utcnow()

    # Auto-expire old sessions
    expired = (
        db.query(VideoCallSession)
        .filter(
            or_(
                VideoCallSession.customer_id == current_user.id,
                VideoCallSession.courier_id == current_user.id,
            ),
            VideoCallSession.status.in_(["ringing", "pending", "active"]),
            VideoCallSession.expires_at < now,
        )
        .all()
    )
    for s in expired:
        s.status = "expired"
    if expired:
        db.commit()

    calls = (
        db.query(VideoCallSession)
        .filter(
            or_(
                VideoCallSession.customer_id == current_user.id,
                VideoCallSession.courier_id == current_user.id,
            ),
            VideoCallSession.status.in_(["ringing", "active"]),
            VideoCallSession.expires_at >= now,
        )
        .order_by(VideoCallSession.created_at.desc())
        .all()
    )
    return calls


@router.post("/{session_token}/answer", response_model=CallSessionResponse)
def answer_call(
    session_token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Callee accepts the incoming call. Status: ringing -> active."""
    session = db.query(VideoCallSession).filter(
        VideoCallSession.session_token == session_token
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Call session not found")
    if current_user.id not in [session.courier_id, session.customer_id]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if session.expires_at < datetime.utcnow():
        session.status = "expired"
        db.commit()
        raise HTTPException(status_code=410, detail="Call session has expired")
    if session.status != "ringing":
        raise HTTPException(status_code=400, detail="Call is not in ringing state")
    session.status = "active"
    db.commit()
    db.refresh(session)
    return session


@router.post("/{session_token}/decline", response_model=CallSessionResponse)
def decline_call(
    session_token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Decline an incoming call."""
    session = db.query(VideoCallSession).filter(
        VideoCallSession.session_token == session_token
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Call session not found")
    if current_user.id not in [session.courier_id, session.customer_id]:
        raise HTTPException(status_code=403, detail="Not authorized")
    session.status = "cancelled"
    session.ended_at = datetime.utcnow()
    db.commit()
    db.refresh(session)
    return session


@router.get("/{session_token}", response_model=CallSessionResponse)
def get_call_session(
    session_token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get call session details by token."""
    session = db.query(VideoCallSession).filter(VideoCallSession.session_token == session_token).first()
    if not session:
        raise HTTPException(status_code=404, detail="Call session not found")
    if current_user.id not in [session.courier_id, session.customer_id]:
        raise HTTPException(status_code=403, detail="Not authorized to access this call")
    # Auto-expire
    if session.expires_at < datetime.utcnow() and session.status in ("ringing", "pending", "active"):
        session.status = "expired"
        db.commit()
        db.refresh(session)
    return session


@router.post("/{session_token}/join", response_model=CallSessionResponse)
def join_call(
    session_token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark call session as active when a participant joins."""
    session = db.query(VideoCallSession).filter(VideoCallSession.session_token == session_token).first()
    if not session:
        raise HTTPException(status_code=404, detail="Call session not found")
    if current_user.id not in [session.courier_id, session.customer_id]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if session.expires_at < datetime.utcnow():
        session.status = "expired"
        db.commit()
        raise HTTPException(status_code=410, detail="Call session has expired")
    if session.status in ("ringing", "pending"):
        session.status = "active"
        db.commit()
        db.refresh(session)
    return session


@router.post("/{session_token}/end", response_model=CallSessionResponse)
def end_call(
    session_token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """End the video call."""
    session = db.query(VideoCallSession).filter(VideoCallSession.session_token == session_token).first()
    if not session:
        raise HTTPException(status_code=404, detail="Call session not found")
    if current_user.id not in [session.courier_id, session.customer_id]:
        raise HTTPException(status_code=403, detail="Not authorized")
    session.status = "completed"
    session.ended_at = datetime.utcnow()
    db.commit()
    db.refresh(session)
    return session


@router.post("/{session_token}/capture", response_model=MediaCaptureResponse)
def capture_frame(
    session_token: str,
    req: CaptureFrameRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Capture a video frame for future AI verification. Stored encrypted."""
    session = db.query(VideoCallSession).filter(VideoCallSession.session_token == session_token).first()
    if not session:
        raise HTTPException(status_code=404, detail="Call session not found")
    if current_user.id not in [session.courier_id, session.customer_id]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if session.status != "active":
        raise HTTPException(status_code=400, detail="Call must be active to capture frames")

    capture = CallMediaCapture(
        call_session_id=session.id,
        capture_type="frame",
        encrypted_data=req.image_data,  # In production, encrypt before storing
    )
    db.add(capture)
    db.commit()
    db.refresh(capture)
    return capture


# ─── Delivery Decisions ──────────────────────────────────────────────────────

decisions_router = APIRouter(prefix="/decisions", tags=["Delivery Decisions"])


@decisions_router.post("/", response_model=DeliveryDecisionResponse)
def submit_decision(
    req: DeliveryDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Customer submits a delivery decision after video-call verification."""
    if current_user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=403, detail="Only customers can submit decisions")

    call_session = db.query(VideoCallSession).filter(VideoCallSession.id == req.call_session_id).first()
    if not call_session:
        raise HTTPException(status_code=404, detail="Call session not found")
    if call_session.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if call_session.status not in ("active", "completed"):
        raise HTTPException(status_code=400, detail="Call must be active or completed to submit a decision")

    # Prevent duplicate decisions
    existing = db.query(DeliveryDecision).filter(DeliveryDecision.call_session_id == req.call_session_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Decision already submitted for this call")

    valid_decisions = ("return", "neighbor", "locker")
    if req.decision not in valid_decisions:
        raise HTTPException(status_code=400, detail=f"Invalid decision. Must be one of: {list(valid_decisions)}")

    # Tamper-proof blockchain hash
    hash_input = f"{call_session.shipment_id}:{current_user.id}:{req.decision}:{datetime.utcnow().isoformat()}"
    blockchain_hash = hashlib.sha256(hash_input.encode()).hexdigest()

    decision = DeliveryDecision(
        shipment_id=call_session.shipment_id,
        call_session_id=req.call_session_id,
        customer_id=current_user.id,
        decision=req.decision,
        notes=req.notes,
        blockchain_hash=blockchain_hash,
    )
    db.add(decision)

    # Update shipment status based on decision
    shipment = db.query(Shipment).filter(Shipment.id == call_session.shipment_id).first()
    if shipment:
        status_map = {
            "return": "Return Requested",
            "neighbor": "Neighbor Delivery",
            "locker": "Locker Delivery",
        }
        shipment.status = status_map.get(req.decision, shipment.status)

    # Complete the call if still active
    if call_session.status == "active":
        call_session.status = "completed"
        call_session.ended_at = datetime.utcnow()

    db.commit()
    db.refresh(decision)
    return decision


@decisions_router.get("/{shipment_id}", response_model=List[DeliveryDecisionResponse])
def get_decisions(
    shipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all delivery decisions for a shipment."""
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if current_user.id not in [shipment.sender_id, shipment.courier_id]:
        raise HTTPException(status_code=403, detail="Not authorized")

    return db.query(DeliveryDecision).filter(DeliveryDecision.shipment_id == shipment_id).all()
