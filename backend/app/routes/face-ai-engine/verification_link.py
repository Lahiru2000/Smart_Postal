"""
Verification Link Routes – couriers generate one-time links, customers
open them to record/upload a video without authentication.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import os
import uuid
import logging

from app.database import get_db
from app.services.auth import get_current_user
from app.models.user import User
from app.models.shipment import Shipment
from app.models.face_ai_engine.verification_link import VerificationLink
from app.schemas.face_ai_engine.verification_link import (
    VerificationLinkCreate,
    VerificationLinkResponse,
    VerificationLinkPublic,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/verification-link", tags=["Verification Link"])

# Directory to store uploaded videos
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "uploads", "verifications")
os.makedirs(UPLOAD_DIR, exist_ok=True)

LINK_EXPIRY_MINUTES = 30  # link valid for 30 minutes


# ── Courier endpoints (auth required) ───────────────────


@router.post("/generate", response_model=VerificationLinkResponse)
def generate_link(
    payload: VerificationLinkCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Courier generates a one-time verification link for the customer."""
    # Only couriers can generate links
    if current_user.role != "courier":
        raise HTTPException(status_code=403, detail="Only couriers can generate verification links")

    shipment = db.query(Shipment).filter(Shipment.id == payload.shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    if shipment.courier_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not the assigned courier for this shipment")

    # Expire any existing pending links for this shipment
    existing = (
        db.query(VerificationLink)
        .filter(
            VerificationLink.shipment_id == payload.shipment_id,
            VerificationLink.status == "pending",
        )
        .all()
    )
    for link in existing:
        link.status = "expired"
        link.completed_at = datetime.utcnow()

    # Create new link
    vlink = VerificationLink(
        shipment_id=shipment.id,
        courier_id=current_user.id,
        customer_id=shipment.sender_id,
        expires_at=datetime.utcnow() + timedelta(minutes=LINK_EXPIRY_MINUTES),
    )
    db.add(vlink)
    db.commit()
    db.refresh(vlink)

    # Build the customer-facing URL (customer frontend port 3001)
    customer_link = f"http://localhost:3001/verification/{vlink.token}"

    return VerificationLinkResponse(
        id=vlink.id,
        token=vlink.token,
        shipment_id=vlink.shipment_id,
        courier_id=vlink.courier_id,
        customer_id=vlink.customer_id,
        status=vlink.status,
        video_path=vlink.video_path,
        created_at=vlink.created_at,
        completed_at=vlink.completed_at,
        expires_at=vlink.expires_at,
        link=customer_link,
    )


@router.get("/shipment/{shipment_id}", response_model=list[VerificationLinkResponse])
def get_links_for_shipment(
    shipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all verification links for a shipment (courier only)."""
    links = (
        db.query(VerificationLink)
        .filter(VerificationLink.shipment_id == shipment_id)
        .order_by(VerificationLink.created_at.desc())
        .all()
    )
    results = []
    for vl in links:
        results.append(VerificationLinkResponse(
            id=vl.id,
            token=vl.token,
            shipment_id=vl.shipment_id,
            courier_id=vl.courier_id,
            customer_id=vl.customer_id,
            status=vl.status,
            video_path=vl.video_path,
            created_at=vl.created_at,
            completed_at=vl.completed_at,
            expires_at=vl.expires_at,
            link=f"http://localhost:3001/verification/{vl.token}",
        ))
    return results


@router.get("/customer/shipment/{shipment_id}")
def get_pending_link_for_customer(
    shipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Customer checks if there is a pending verification link for their shipment."""
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    # Must be the sender (customer) of this shipment
    if shipment.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your shipment")

    vlink = (
        db.query(VerificationLink)
        .filter(
            VerificationLink.shipment_id == shipment_id,
            VerificationLink.customer_id == current_user.id,
            VerificationLink.status == "pending",
        )
        .order_by(VerificationLink.created_at.desc())
        .first()
    )

    if not vlink:
        return None

    # Check expiry
    if vlink.expires_at and datetime.utcnow() > vlink.expires_at:
        vlink.status = "expired"
        vlink.completed_at = datetime.utcnow()
        db.commit()
        return None

    courier = db.query(User).filter(User.id == vlink.courier_id).first()

    return {
        "token": vlink.token,
        "courier_name": courier.full_name if courier else None,
        "expires_at": vlink.expires_at.isoformat() if vlink.expires_at else None,
        "link": f"http://localhost:3001/verification/{vlink.token}",
    }


@router.get("/status/{token}")
def get_link_status(
    token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Courier polls this to see if the customer completed the verification."""
    vlink = db.query(VerificationLink).filter(VerificationLink.token == token).first()
    if not vlink:
        raise HTTPException(status_code=404, detail="Link not found")

    # Check expiry
    if vlink.status == "pending" and vlink.expires_at and datetime.utcnow() > vlink.expires_at:
        vlink.status = "expired"
        vlink.completed_at = datetime.utcnow()
        db.commit()

    return {
        "token": vlink.token,
        "status": vlink.status,
        "video_path": vlink.video_path,
        "completed_at": vlink.completed_at,
    }


# ── Public endpoints (NO auth – customer uses token) ─────


@router.get("/public/{token}", response_model=VerificationLinkPublic)
def get_link_public(
    token: str,
    db: Session = Depends(get_db),
):
    """
    Customer opens the link → we return info about the verification
    request WITHOUT requiring login.
    """
    vlink = db.query(VerificationLink).filter(VerificationLink.token == token).first()
    if not vlink:
        raise HTTPException(status_code=404, detail="Verification link not found or invalid")

    # Check expiry
    if vlink.status == "pending" and vlink.expires_at and datetime.utcnow() > vlink.expires_at:
        vlink.status = "expired"
        vlink.completed_at = datetime.utcnow()
        db.commit()

    if vlink.status != "pending":
        raise HTTPException(
            status_code=410,
            detail=f"This link has already been {vlink.status}. Please ask the courier for a new link."
        )

    # Get shipment tracking + courier name
    shipment = db.query(Shipment).filter(Shipment.id == vlink.shipment_id).first()
    courier = db.query(User).filter(User.id == vlink.courier_id).first()

    return VerificationLinkPublic(
        token=vlink.token,
        shipment_tracking=shipment.tracking_number if shipment else None,
        courier_name=courier.full_name if courier else None,
        status=vlink.status,
        expires_at=vlink.expires_at,
    )


@router.post("/public/{token}/submit")
async def submit_verification_video(
    token: str,
    video: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Customer submits their recorded/uploaded video.
    No auth required – the one-time token IS the auth.
    """
    vlink = db.query(VerificationLink).filter(VerificationLink.token == token).first()
    if not vlink:
        raise HTTPException(status_code=404, detail="Verification link not found")

    # Expiry check
    if vlink.status == "pending" and vlink.expires_at and datetime.utcnow() > vlink.expires_at:
        vlink.status = "expired"
        vlink.completed_at = datetime.utcnow()
        db.commit()
        raise HTTPException(status_code=410, detail="This verification link has expired")

    if vlink.status != "pending":
        raise HTTPException(
            status_code=410,
            detail=f"This link has already been {vlink.status}. Please ask the courier for a new link."
        )

    # Validate file type
    allowed = {"video/webm", "video/mp4", "video/quicktime", "video/x-matroska", "video/avi"}
    if video.content_type not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported video type: {video.content_type}. Accepted: mp4, webm, mov, mkv")

    # Save file
    ext = video.filename.split(".")[-1] if "." in video.filename else "webm"
    filename = f"{vlink.token}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    contents = await video.read()
    with open(filepath, "wb") as f:
        f.write(contents)

    # Update link
    vlink.status = "completed"
    vlink.video_path = filepath
    vlink.completed_at = datetime.utcnow()
    db.commit()

    logger.info(f"Verification video submitted for token {token}: {filepath}")

    return {
        "detail": "Video submitted successfully",
        "token": token,
        "status": "completed",
    }
