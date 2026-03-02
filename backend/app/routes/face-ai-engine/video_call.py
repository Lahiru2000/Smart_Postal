"""
Video Call Routes – REST endpoints + WebSocket signaling for WebRTC video calls.
"""

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
from datetime import datetime
import json
import logging

from app.database import get_db
from app.services.auth import get_current_user
from app.models.user import User
from app.models.face_ai_engine.video_call import VideoCallSession
from app.schemas.face_ai_engine.video_call import (
    VideoCallCreate,
    VideoCallResponse,
    IncomingCallResponse,
)
from app.services.face_ai_engine.signaling import manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/video-call", tags=["Video Call"])


# ── REST Endpoints ────────────────────────────────────────


@router.post("/initiate", response_model=VideoCallResponse)
def initiate_call(
    payload: VideoCallCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start a new video call session."""
    if payload.callee_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot call yourself")

    callee = db.query(User).filter(User.id == payload.callee_id).first()
    if not callee:
        raise HTTPException(status_code=404, detail="Callee not found")

    # Cancel any existing ringing calls from this caller to this callee
    existing = (
        db.query(VideoCallSession)
        .filter(
            VideoCallSession.caller_id == current_user.id,
            VideoCallSession.callee_id == payload.callee_id,
            VideoCallSession.status == "ringing",
        )
        .all()
    )
    for call in existing:
        call.status = "missed"
        call.ended_at = datetime.utcnow()

    session = VideoCallSession(
        caller_id=current_user.id,
        callee_id=payload.callee_id,
        shipment_id=payload.shipment_id,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return VideoCallResponse(
        id=session.id,
        room_id=session.room_id,
        shipment_id=session.shipment_id,
        caller_id=session.caller_id,
        callee_id=session.callee_id,
        status=session.status,
        started_at=session.started_at,
        answered_at=session.answered_at,
        ended_at=session.ended_at,
        caller_name=current_user.full_name,
        callee_name=callee.full_name,
    )


@router.get("/incoming", response_model=list[IncomingCallResponse])
def get_incoming_calls(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all ringing calls for the current user (used for polling)."""
    calls = (
        db.query(VideoCallSession)
        .filter(
            VideoCallSession.callee_id == current_user.id,
            VideoCallSession.status == "ringing",
        )
        .all()
    )
    results = []
    for call in calls:
        caller = db.query(User).filter(User.id == call.caller_id).first()
        shipment_tracking = None
        if call.shipment_id:
            from app.models.shipment import Shipment
            shipment = db.query(Shipment).filter(Shipment.id == call.shipment_id).first()
            shipment_tracking = shipment.tracking_number if shipment else None

        results.append(IncomingCallResponse(
            room_id=call.room_id,
            caller_id=call.caller_id,
            caller_name=caller.full_name if caller else "Unknown",
            shipment_id=call.shipment_id,
            shipment_tracking=shipment_tracking,
            started_at=call.started_at,
        ))
    return results


@router.get("/{room_id}", response_model=VideoCallResponse)
def get_call(
    room_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get call details by room_id."""
    session = db.query(VideoCallSession).filter(VideoCallSession.room_id == room_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Call session not found")

    # Only participants can view
    if current_user.id not in (session.caller_id, session.callee_id):
        raise HTTPException(status_code=403, detail="Not a participant of this call")

    caller = db.query(User).filter(User.id == session.caller_id).first()
    callee = db.query(User).filter(User.id == session.callee_id).first()

    return VideoCallResponse(
        id=session.id,
        room_id=session.room_id,
        shipment_id=session.shipment_id,
        caller_id=session.caller_id,
        callee_id=session.callee_id,
        status=session.status,
        started_at=session.started_at,
        answered_at=session.answered_at,
        ended_at=session.ended_at,
        caller_name=caller.full_name if caller else None,
        callee_name=callee.full_name if callee else None,
    )


@router.put("/{room_id}/answer")
def answer_call(
    room_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Callee answers the call."""
    session = db.query(VideoCallSession).filter(VideoCallSession.room_id == room_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Call session not found")
    if session.callee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the callee can answer")
    if session.status != "ringing":
        raise HTTPException(status_code=400, detail=f"Call is already {session.status}")

    session.status = "active"
    session.answered_at = datetime.utcnow()
    db.commit()
    return {"detail": "Call answered", "room_id": room_id}


@router.put("/{room_id}/decline")
def decline_call(
    room_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Callee declines the call."""
    session = db.query(VideoCallSession).filter(VideoCallSession.room_id == room_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Call session not found")
    if session.callee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the callee can decline")
    if session.status != "ringing":
        raise HTTPException(status_code=400, detail=f"Call is already {session.status}")

    session.status = "declined"
    session.ended_at = datetime.utcnow()
    db.commit()
    return {"detail": "Call declined", "room_id": room_id}


@router.put("/{room_id}/end")
def end_call(
    room_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Either participant ends the call."""
    session = db.query(VideoCallSession).filter(VideoCallSession.room_id == room_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Call session not found")
    if current_user.id not in (session.caller_id, session.callee_id):
        raise HTTPException(status_code=403, detail="Not a participant")
    if session.status in ("ended", "missed", "declined"):
        raise HTTPException(status_code=400, detail=f"Call is already {session.status}")

    session.status = "ended"
    session.ended_at = datetime.utcnow()
    db.commit()
    return {"detail": "Call ended", "room_id": room_id}


# ── WebSocket Signaling ──────────────────────────────────


@router.websocket("/ws/{room_id}")
async def signaling_websocket(
    websocket: WebSocket,
    room_id: str,
    token: str = Query(...),
):
    """
    WebSocket endpoint for WebRTC signaling.
    Connect with: ws://host/video-call/ws/{room_id}?token=JWT_TOKEN

    Messages are JSON with a "type" field:
      - offer:      { type: "offer", sdp: ... }
      - answer:     { type: "answer", sdp: ... }
      - ice:        { type: "ice-candidate", candidate: ... }
      - hang-up:    { type: "hang-up" }
    """
    # Authenticate via token query param
    from app.services.auth import SECRET_KEY, ALGORITHM
    from jose import jwt, JWTError

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            await websocket.close(code=4001, reason="Invalid token")
            return
    except JWTError:
        await websocket.close(code=4001, reason="Invalid token")
        return

    # Look up user
    db = next(get_db())
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            await websocket.close(code=4001, reason="User not found")
            return
        user_id = user.id
    finally:
        db.close()

    # Verify room exists
    db2 = next(get_db())
    try:
        session = db2.query(VideoCallSession).filter(VideoCallSession.room_id == room_id).first()
        if not session:
            await websocket.close(code=4004, reason="Room not found")
            return
        if user_id not in (session.caller_id, session.callee_id):
            await websocket.close(code=4003, reason="Not a participant")
            return
    finally:
        db2.close()

    await manager.connect(room_id, user_id, websocket)

    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                continue

            msg_type = message.get("type")

            if msg_type in ("offer", "answer", "ice-candidate", "hang-up"):
                # Relay to all other peers in the room
                message["userId"] = user_id
                await manager.broadcast(room_id, user_id, message)
            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})
            else:
                logger.warning(f"Unknown message type: {msg_type}")
    except WebSocketDisconnect:
        manager.disconnect(room_id, user_id)
        await manager.broadcast(room_id, user_id, {
            "type": "peer-left",
            "userId": user_id,
        })
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(room_id, user_id)
