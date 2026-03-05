"""
Video Call Routes – REST endpoints + WebSocket signaling for WebRTC video calls.
"""

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
import json
import logging
import base64
import numpy as np
import os
import tempfile

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


# ── Live Face Verification (during video call) ───────────


class VerifyFaceRequest(BaseModel):
    room_id: str
    snapshot: str  # base64-encoded JPEG/PNG image from remote video frame


@router.post("/verify-face")
def verify_face_during_call(
    payload: VerifyFaceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Courier captures a frame from the remote video stream during a live call
    and sends it here. We compare it against the shipment's reference
    image/video using DeepFace ArcFace and return the result.
    """
    import cv2
    from app.models.shipment import Shipment

    # 1. Validate the call session
    session = db.query(VideoCallSession).filter(
        VideoCallSession.room_id == payload.room_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Call session not found")
    if current_user.id not in (session.caller_id, session.callee_id):
        raise HTTPException(status_code=403, detail="Not a participant")
    if not session.shipment_id:
        raise HTTPException(status_code=400, detail="No shipment linked to this call")

    # 2. Get the shipment and its reference media
    shipment = db.query(Shipment).filter(Shipment.id == session.shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    if not shipment.image_url and not shipment.video_url:
        raise HTTPException(
            status_code=400,
            detail="No reference media on this shipment. Customer must upload an image or video first."
        )

    # 3. Decode the base64 snapshot into an OpenCV frame
    try:
        # Handle data URL format: "data:image/jpeg;base64,/9j/4AAQ..."
        snapshot_data = payload.snapshot
        if "," in snapshot_data:
            snapshot_data = snapshot_data.split(",", 1)[1]
        img_bytes = base64.b64decode(snapshot_data)
        img_array = np.frombuffer(img_bytes, dtype=np.uint8)
        live_frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        if live_frame is None:
            raise ValueError("Failed to decode image")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid snapshot image: {e}")

    # 4. Get face embedding from the live snapshot
    from app.services.face_ai_engine.ai_model.face_verifier import get_face_embedding

    live_embedding = get_face_embedding(live_frame)
    if live_embedding is None:
        return {
            "success": False,
            "error": "No face detected in the video call snapshot. Please ensure the person's face is clearly visible and try again.",
            "face_score": None,
            "verdict": None,
            "confidence": None,
        }

    # 5. Get reference embedding from the shipment's media
    ref_embedding = None
    media_source = None

    # Resolve the file path from the URL
    base_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "uploads")

    if shipment.video_url:
        # Reference is a video — use robust multi-frame embedding
        from app.services.face_ai_engine.ai_model.face_verifier import get_robust_embedding
        ref_path = os.path.join(base_dir, shipment.video_url.lstrip("/uploads/"))
        if os.path.exists(ref_path):
            ref_embedding, frame_count = get_robust_embedding(ref_path)
            media_source = "video"
            logger.info(f"Reference embedding from video: {frame_count} frames")
        else:
            logger.warning(f"Reference video not found at: {ref_path}")

    if ref_embedding is None and shipment.image_url:
        # Reference is an image — extract single frame embedding
        ref_path = os.path.join(base_dir, shipment.image_url.lstrip("/uploads/"))
        if os.path.exists(ref_path):
            ref_frame = cv2.imread(ref_path)
            if ref_frame is not None:
                ref_embedding = get_face_embedding(ref_frame)
                media_source = "image"
        else:
            logger.warning(f"Reference image not found at: {ref_path}")

    if ref_embedding is None:
        return {
            "success": False,
            "error": "Could not extract face from reference media. The reference image/video may not contain a clear face.",
            "face_score": None,
            "verdict": None,
            "confidence": None,
        }

    # 6. Compare embeddings (cosine similarity → sigmoid score)
    cos_sim = float(np.dot(live_embedding, ref_embedding) / (
        np.linalg.norm(live_embedding) * np.linalg.norm(ref_embedding)
    ))

    # Sigmoid mapping (same as face_verifier.py)
    SIGMOID_STEEPNESS = 15
    SIGMOID_MIDPOINT = 0.32
    score = 1.0 / (1.0 + np.exp(-SIGMOID_STEEPNESS * (cos_sim - SIGMOID_MIDPOINT)))
    score = float(np.clip(score, 0.0, 1.0))
    score = round(score, 4)

    # Determine verdict
    MATCH_THRESHOLD = 0.62
    is_match = score >= MATCH_THRESHOLD

    if score >= 0.85:
        confidence = "HIGH"
    elif score >= 0.65:
        confidence = "MEDIUM"
    elif score >= MATCH_THRESHOLD:
        confidence = "LOW"
    else:
        confidence = "HIGH" if score < 0.25 else "MEDIUM"

    verdict = "SAME PERSON" if is_match else "DIFFERENT PERSON"

    logger.info(
        f"Live face verification: cos_sim={cos_sim:.4f}, score={score:.4f}, "
        f"verdict={verdict}, confidence={confidence}, ref={media_source}"
    )

    return {
        "success": True,
        "face_score": round(score * 100, 1),
        "cos_similarity": round(cos_sim, 4),
        "verdict": verdict,
        "confidence": confidence,
        "is_match": is_match,
        "reference_type": media_source,
        "error": None,
    }


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
