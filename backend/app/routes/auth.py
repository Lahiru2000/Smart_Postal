from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse
from app.services import auth

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Request / Response schemas for token endpoints ──────────────────────────
class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    full_name: str


# ── Register ────────────────────────────────────────────────────────────────
@router.post("/register", response_model=UserResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pwd = auth.get_password_hash(user.password)
    new_user = User(
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        hashed_password=hashed_pwd,
        role=user.role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


# ── Login — returns access + refresh tokens ─────────────────────────────────
@router.post("/login", response_model=TokenResponse)
def login(user_credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_credentials.email).first()
    if not user or not auth.verify_password(user_credentials.password, user.hashed_password):
        raise HTTPException(status_code=403, detail="Invalid credentials")

    # Enforce role-based login
    if user.role != user_credentials.role:
        raise HTTPException(
            status_code=403,
            detail=f"Access denied. This account is not registered as a {user_credentials.role.value}.",
        )

    access_token = auth.create_access_token(data={"sub": user.email, "role": user.role.value})
    refresh_token = auth.create_refresh_token(db, user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        role=user.role.value,
        user_id=user.id,
        full_name=user.full_name,
    )


# ── Refresh — rotate refresh token & issue new access token ────────────────
@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    """Exchange a valid refresh token for a fresh access + refresh token pair.
    The old refresh token is revoked (rotation).  If a revoked token is
    presented, the entire family is killed (theft detection)."""
    new_refresh, user = auth.rotate_refresh_token(db, body.refresh_token)
    access_token = auth.create_access_token(data={"sub": user.email, "role": user.role.value})

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh,
        role=user.role.value,
        user_id=user.id,
        full_name=user.full_name,
    )


# ── Logout — revoke the refresh token family ───────────────────────────────
@router.post("/logout")
def logout(body: RefreshRequest, db: Session = Depends(get_db)):
    """Revoke the refresh token family so it can't be reused."""
    auth.revoke_family(db, body.refresh_token)
    return {"detail": "Logged out successfully"}


# ── Logout everywhere — revoke ALL user tokens ─────────────────────────────
@router.post("/logout-all")
def logout_all(
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_user),
):
    """Revoke every refresh token for the authenticated user (all devices)."""
    auth.revoke_all_user_tokens(db, current_user.id)
    return {"detail": "All sessions revoked"}