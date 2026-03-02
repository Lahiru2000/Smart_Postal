"""
Replay guard — detects duplicate / replayed audio submissions.
Uses SHA-256 audio fingerprinting with a time window.
"""
import hashlib
import logging
from datetime import datetime, timedelta
from typing import Dict

logger = logging.getLogger(__name__)


class ReplayGuard:
    """In-memory replay detector using audio content hashing."""

    def __init__(self):
        self._hashes: Dict[str, datetime] = {}

    def _prune(self, window_minutes: int = 30):
        """Remove expired fingerprints."""
        cutoff = datetime.utcnow() - timedelta(minutes=window_minutes)
        expired = [h for h, ts in self._hashes.items() if ts < cutoff]
        for h in expired:
            del self._hashes[h]
        if expired:
            logger.info(f"Cleaned up {len(expired)} expired audio fingerprints.")

    def fingerprint(self, audio_bytes: bytes) -> str:
        """Compute SHA-256 fingerprint of audio content."""
        return hashlib.sha256(audio_bytes).hexdigest()

    def is_replay(self, audio_bytes: bytes, window_minutes: int = 30) -> bool:
        """Check if this audio has been submitted before within the time window."""
        self._prune(window_minutes)
        fp = self.fingerprint(audio_bytes)
        if fp in self._hashes:
            logger.warning(f"Replay detected: fingerprint {fp[:16]}...")
            return True
        self._hashes[fp] = datetime.utcnow()
        return False


# Singleton instance
replay_guard = ReplayGuard()
