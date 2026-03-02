"""
WebSocket signaling server for WebRTC video calls.

Handles peer-to-peer connection negotiation (SDP offers/answers + ICE candidates).
Only the assigned courier and customer can join a given call session.
Sessions are validated against the database and expire automatically.
"""

import json
from typing import Dict, List, Optional
from datetime import datetime

from fastapi import WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.video_call import VideoCallSession
from app.models.user import User
from app.services.auth import SECRET_KEY, ALGORITHM


class SignalingManager:
    """Manages WebSocket connections for WebRTC signaling relay."""

    def __init__(self):
        # session_token -> [{"ws": WebSocket, "user_id": int, "role": str}, ...]
        self.active_connections: Dict[str, List[dict]] = {}

    async def connect(
        self, session_token: str, websocket: WebSocket, user_id: int, role: str
    ) -> bool:
        await websocket.accept()

        if session_token not in self.active_connections:
            self.active_connections[session_token] = []

        # Prevent duplicate connections from the same user
        self.active_connections[session_token] = [
            c for c in self.active_connections[session_token] if c["user_id"] != user_id
        ]

        # Max 2 participants per session
        if len(self.active_connections[session_token]) >= 2:
            await websocket.close(code=4003, reason="Session full")
            return False

        # Add to connection list FIRST
        self.active_connections[session_token].append(
            {"ws": websocket, "user_id": user_id, "role": role}
        )

        # Notify ALL participants (including new one) about current peer count
        peer_count = len(self.active_connections[session_token])
        roles_present = [c["role"] for c in self.active_connections[session_token]]

        for conn in self.active_connections[session_token]:
            try:
                await conn["ws"].send_text(
                    json.dumps({
                        "type": "peer-joined",
                        "role": role,
                        "peerCount": peer_count,
                        "rolesPresent": roles_present,
                    })
                )
            except Exception:
                pass

        return True

    def disconnect(self, session_token: str, websocket: WebSocket):
        if session_token in self.active_connections:
            self.active_connections[session_token] = [
                c
                for c in self.active_connections[session_token]
                if c["ws"] != websocket
            ]
            if not self.active_connections[session_token]:
                del self.active_connections[session_token]

    async def relay(self, session_token: str, sender: WebSocket, message: str):
        """Relay a signaling message to the other peer."""
        if session_token in self.active_connections:
            for conn in self.active_connections[session_token]:
                if conn["ws"] != sender:
                    try:
                        await conn["ws"].send_text(message)
                    except Exception:
                        pass

    def get_peer_count(self, session_token: str) -> int:
        return len(self.active_connections.get(session_token, []))


signaling_manager = SignalingManager()


def _authenticate_token(token: str, db: Session) -> Optional[User]:
    """Validate JWT and return the User, or None."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: Optional[str] = payload.get("sub")
        if not email:
            return None
        return db.query(User).filter(User.email == email).first()
    except JWTError:
        return None


async def signaling_endpoint(
    websocket: WebSocket, session_token: str, token: str = Query(...)
):
    """
    WebSocket endpoint for WebRTC signaling.

    - Authenticates via JWT (passed as ?token= query param).
    - Validates the call session against the database.
    - Relays SDP offers/answers and ICE candidates between peers.
    - Auto-expires stale sessions.
    """
    db: Session = SessionLocal()
    role = "unknown"
    connected = False

    try:
        # 1. Authenticate user
        user = _authenticate_token(token, db)
        if not user:
            await websocket.close(code=4001, reason="Unauthorized")
            return

        # 2. Validate call session
        call_session = (
            db.query(VideoCallSession)
            .filter(VideoCallSession.session_token == session_token)
            .first()
        )
        if not call_session:
            await websocket.close(code=4004, reason="Session not found")
            return

        # 3. Authorise – only assigned courier/customer
        if user.id not in (call_session.courier_id, call_session.customer_id):
            await websocket.close(code=4003, reason="Not authorized for this call")
            return

        # 4. Check expiry
        if call_session.expires_at < datetime.utcnow():
            call_session.status = "expired"
            db.commit()
            await websocket.close(code=4010, reason="Session expired")
            return

        # 4b. Only allow connection for active sessions
        if call_session.status not in ("active",):
            await websocket.close(code=4005, reason="Call is not active")
            return

        # 5. Determine role
        role = "courier" if user.id == call_session.courier_id else "customer"

        # 6. Connect to signaling manager
        connected = await signaling_manager.connect(
            session_token, websocket, user.id, role
        )
        if not connected:
            return

        # 7. Message relay loop
        while True:
            data = await websocket.receive_text()
            await signaling_manager.relay(session_token, websocket, data)

    except WebSocketDisconnect:
        pass
    finally:
        if connected:
            signaling_manager.disconnect(session_token, websocket)
            # Notify remaining peer
            try:
                await signaling_manager.relay(
                    session_token,
                    websocket,
                    json.dumps({"type": "peer-left", "role": role}),
                )
            except Exception:
                pass
        db.close()
