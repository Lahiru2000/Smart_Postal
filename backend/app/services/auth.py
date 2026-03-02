import os
import secrets
import hashlib
import bcrypt
from datetime import datetime, timedelta
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, RefreshToken

# ── Configuration ─────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "YOUR_SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60           # 1 hour – short-lived
REFRESH_TOKEN_EXPIRE_DAYS = 30             # 30 days – long-lived, stored in DB

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


# ── Password Hashing ─────────────────────────────────────────────────────────
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


# ── Access Token (JWT) ───────────────────────────────────────────────────────
def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# ── Refresh Token (opaque + hashed in DB) ────────────────────────────────────
def _hash_token(raw: str) -> str:
    """SHA-256 hash so we never store the raw refresh token."""
    return hashlib.sha256(raw.encode()).hexdigest()


def create_refresh_token(db: Session, user_id: int, family_id: str | None = None) -> str:
    """Issue a new refresh token.  If family_id is None a new login family is started."""
    raw_token = secrets.token_urlsafe(64)
    token_hash = _hash_token(raw_token)
    family = family_id or secrets.token_urlsafe(32)

    rt = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        family_id=family,
        expires_at=datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(rt)
    db.commit()
    return raw_token


def rotate_refresh_token(db: Session, raw_token: str):
    """Validate & rotate: revoke the presented token, issue a new one in the
    same family.  Returns (new_raw_token, user) or raises HTTPException.

    If a *revoked* token is presented the entire family is killed
    (possible token theft)."""
    token_hash = _hash_token(raw_token)
    rt: RefreshToken | None = (
        db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    )

    if rt is None:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    # ── Theft detection: revoked token re-used → nuke the family ──────────
    if rt.is_revoked:
        db.query(RefreshToken).filter(
            RefreshToken.family_id == rt.family_id
        ).update({"is_revoked": True})
        db.commit()
        raise HTTPException(status_code=401, detail="Refresh token reuse detected — all sessions revoked")

    # ── Expired? ──────────────────────────────────────────────────────────
    if rt.expires_at < datetime.utcnow():
        rt.is_revoked = True
        db.commit()
        raise HTTPException(status_code=401, detail="Refresh token expired — please log in again")

    # ── Rotate: revoke old, mint new in same family ───────────────────────
    rt.is_revoked = True
    db.commit()

    user = db.query(User).filter(User.id == rt.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    new_raw = create_refresh_token(db, user.id, family_id=rt.family_id)
    return new_raw, user


def revoke_family(db: Session, raw_token: str) -> None:
    """Revoke all tokens in the family (logout everywhere for this session chain)."""
    token_hash = _hash_token(raw_token)
    rt = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    if rt:
        db.query(RefreshToken).filter(
            RefreshToken.family_id == rt.family_id
        ).update({"is_revoked": True})
        db.commit()


def revoke_all_user_tokens(db: Session, user_id: int) -> None:
    """Logout from every device / session."""
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id
    ).update({"is_revoked": True})
    db.commit()


def cleanup_expired_tokens(db: Session) -> int:
    """Purge expired/revoked rows older than 7 days (housekeeping)."""
    cutoff = datetime.utcnow() - timedelta(days=7)
    deleted = db.query(RefreshToken).filter(
        RefreshToken.is_revoked == True,
        RefreshToken.created_at < cutoff,
    ).delete(synchronize_session=False)
    db.commit()
    return deleted


# ── Current-user dependency (unchanged interface) ────────────────────────────
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type", "access")
        if email is None or token_type != "access":
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user