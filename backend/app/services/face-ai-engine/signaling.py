"""
WebRTC Signaling Service – manages WebSocket connections for video call rooms.
Handles SDP offer/answer exchange and ICE candidate relay between peers.
"""

from fastapi import WebSocket
from typing import Dict, List
import json
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections grouped by room_id."""

    def __init__(self):
        # room_id -> list of (user_id, websocket) tuples
        self.rooms: Dict[str, List[tuple]] = {}

    async def connect(self, room_id: str, user_id: int, websocket: WebSocket):
        await websocket.accept()
        if room_id not in self.rooms:
            self.rooms[room_id] = []

        # Prevent duplicate connections for the same user in the same room
        self.rooms[room_id] = [
            (uid, ws) for uid, ws in self.rooms[room_id] if uid != user_id
        ]
        self.rooms[room_id].append((user_id, websocket))
        logger.info(f"User {user_id} connected to room {room_id}. Peers: {len(self.rooms[room_id])}")

        # Notify the other peer that someone joined
        await self.broadcast(room_id, user_id, {
            "type": "peer-joined",
            "userId": user_id,
            "peerCount": len(self.rooms[room_id]),
        })

    def disconnect(self, room_id: str, user_id: int):
        if room_id in self.rooms:
            self.rooms[room_id] = [
                (uid, ws) for uid, ws in self.rooms[room_id] if uid != user_id
            ]
            if not self.rooms[room_id]:
                del self.rooms[room_id]
            logger.info(f"User {user_id} disconnected from room {room_id}")

    async def broadcast(self, room_id: str, sender_id: int, message: dict):
        """Send a message to all peers in the room except the sender."""
        if room_id not in self.rooms:
            return
        for uid, ws in self.rooms[room_id]:
            if uid != sender_id:
                try:
                    await ws.send_json(message)
                except Exception:
                    logger.warning(f"Failed to send to user {uid} in room {room_id}")

    async def send_to_user(self, room_id: str, target_user_id: int, message: dict):
        """Send a message to a specific user in a room."""
        if room_id not in self.rooms:
            return
        for uid, ws in self.rooms[room_id]:
            if uid == target_user_id:
                try:
                    await ws.send_json(message)
                except Exception:
                    logger.warning(f"Failed to send to user {uid} in room {room_id}")

    def get_peer_count(self, room_id: str) -> int:
        return len(self.rooms.get(room_id, []))


# Singleton instance
manager = ConnectionManager()
