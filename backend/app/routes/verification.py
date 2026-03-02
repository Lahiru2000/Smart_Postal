"""
Routes for customer verification during delivery.

- Courier can verify/reject a customer after video call
- Courier can send async verification link if video call verification fails
- Customer can submit video/voice via async link
- AI comparison stub for async verification
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import uuid
import hashlib
import random

from app.database import get_db
from app.models.video_call import (
    VideoCallSession, CallMediaCapture, CustomerVerification,
    AsyncVerificationToken, DeliveryDecision,
)
from app.models.shipment import Shipment
from app.models.user import User, UserRole
from app.schemas.video_call import (
    VerifyCustomerRequest, CustomerVerificationResponse,
    SendAsyncVerificationRequest, AsyncVerificationResponse,
    AsyncVerificationSubmitRequest, AsyncVerificationDecideRequest,
    AsyncVerificationAnalyzeResponse,
    VerificationDashboardResponse,
    CallSessionResponse, MediaCaptureResponse, CaptureFrameRequest,
)
from app.services.auth import get_current_user

# ---------------------------------------------------------------------------
# AI face verification (optional — degrades gracefully if not installed)
# ---------------------------------------------------------------------------
try:
    from app.services.AI_Face_Identification.video_cl import get_identity_system
    _AI_AVAILABLE = True
except ImportError:
    _AI_AVAILABLE = False

router = APIRouter(prefix="/verification", tags=["Customer Verification"])

ASYNC_TOKEN_EXPIRY_HOURS = 24


# ─── Verification Dashboard Data ─────────────────────────────────────────────

@router.get("/dashboard/{session_token}", response_model=VerificationDashboardResponse)
def get_verification_dashboard(
    session_token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all verification data for a call session — captured frames, verification status, etc."""
    session = db.query(VideoCallSession).filter(
        VideoCallSession.session_token == session_token
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Call session not found")
    if current_user.id not in (session.courier_id, session.customer_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    captures = db.query(CallMediaCapture).filter(
        CallMediaCapture.call_session_id == session.id
    ).order_by(CallMediaCapture.created_at.desc()).all()

    verification = db.query(CustomerVerification).filter(
        CustomerVerification.call_session_id == session.id
    ).first()

    shipment = db.query(Shipment).filter(Shipment.id == session.shipment_id).first()

    return VerificationDashboardResponse(
        session=session,
        captures=captures,
        verification=verification,
        shipment_id=session.shipment_id,
        customer_id=session.customer_id,
        courier_id=session.courier_id,
        reference_image_url=shipment.image_url if shipment else None,
    )


@router.get("/captures-by-id/{session_id}", response_model=List[MediaCaptureResponse])
def get_session_captures_by_id(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all captured frames for a call session by its numeric ID.
    Used by the async review page to show reference (video call) frames."""
    session = db.query(VideoCallSession).filter(
        VideoCallSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Call session not found")
    if current_user.id not in (session.courier_id, session.customer_id):
        raise HTTPException(status_code=403, detail="Not authorized")
    return (
        db.query(CallMediaCapture)
        .filter(CallMediaCapture.call_session_id == session.id)
        .order_by(CallMediaCapture.created_at.asc())
        .all()
    )


@router.get("/captures/{session_token}", response_model=List[MediaCaptureResponse])
def get_session_captures(
    session_token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all captured frames for a session."""
    session = db.query(VideoCallSession).filter(
        VideoCallSession.session_token == session_token
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Call session not found")
    if current_user.id not in (session.courier_id, session.customer_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    return db.query(CallMediaCapture).filter(
        CallMediaCapture.call_session_id == session.id
    ).order_by(CallMediaCapture.created_at.desc()).all()

@router.get("/captures-by-id/{session_id}", response_model=List[MediaCaptureResponse])
def get_captures_by_session_id(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all captured frames for a session by numeric session ID (not token)."""
    session = db.query(VideoCallSession).filter(
        VideoCallSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Call session not found")
    if current_user.id not in (session.courier_id, session.customer_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    return db.query(CallMediaCapture).filter(
        CallMediaCapture.call_session_id == session.id
    ).order_by(CallMediaCapture.created_at.asc()).all()

# ─── Courier Verifies/Rejects Customer ───────────────────────────────────────

@router.post("/verify", response_model=CustomerVerificationResponse)
def verify_customer(
    req: VerifyCustomerRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Courier verifies or rejects a customer after reviewing captured frames."""
    if current_user.role != UserRole.COURIER:
        raise HTTPException(status_code=403, detail="Only couriers can verify customers")

    call_session = db.query(VideoCallSession).filter(
        VideoCallSession.id == req.call_session_id
    ).first()
    if not call_session:
        raise HTTPException(status_code=404, detail="Call session not found")
    if call_session.courier_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized for this session")

    # Check for existing verification
    existing = db.query(CustomerVerification).filter(
        CustomerVerification.call_session_id == req.call_session_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Verification already submitted for this session")

    verification = CustomerVerification(
        shipment_id=call_session.shipment_id,
        call_session_id=req.call_session_id,
        courier_id=current_user.id,
        customer_id=call_session.customer_id,
        is_verified=req.is_verified,
        method="video_call",
        notes=req.notes,
    )
    db.add(verification)

    # Update shipment status
    shipment = db.query(Shipment).filter(Shipment.id == call_session.shipment_id).first()
    if shipment:
        if req.is_verified:
            shipment.status = "Awaiting Decision"
        else:
            shipment.status = "Verification Failed"

    db.commit()
    db.refresh(verification)
    return verification


@router.get("/status/{shipment_id}", response_model=Optional[CustomerVerificationResponse])
def get_verification_status(
    shipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the latest verification status for a shipment."""
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if current_user.id not in (shipment.sender_id, shipment.courier_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    verification = db.query(CustomerVerification).filter(
        CustomerVerification.shipment_id == shipment_id
    ).order_by(CustomerVerification.created_at.desc()).first()

    if not verification:
        return None
    return verification


# ─── Async Verification Link ─────────────────────────────────────────────────

@router.post("/send-link", response_model=AsyncVerificationResponse)
def send_async_verification_link(
    req: SendAsyncVerificationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Courier sends an async verification link to the customer when video call verification fails."""
    if current_user.role != UserRole.COURIER:
        raise HTTPException(status_code=403, detail="Only couriers can send verification links")

    shipment = db.query(Shipment).filter(Shipment.id == req.shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if shipment.courier_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized for this shipment")
    if not shipment.sender_id:
        raise HTTPException(status_code=400, detail="No customer assigned to this shipment")

    # Cancel existing pending tokens for this shipment
    existing = db.query(AsyncVerificationToken).filter(
        AsyncVerificationToken.shipment_id == req.shipment_id,
        AsyncVerificationToken.status == "pending",
    ).all()
    for t in existing:
        t.status = "expired"
    if existing:
        db.commit()

    token_str = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(hours=ASYNC_TOKEN_EXPIRY_HOURS)

    async_token = AsyncVerificationToken(
        shipment_id=req.shipment_id,
        call_session_id=req.call_session_id,
        courier_id=current_user.id,
        customer_id=shipment.sender_id,
        token=token_str,
        status="pending",
        expires_at=expires_at,
    )
    db.add(async_token)

    # Update shipment status
    shipment.status = "Async Verification Pending"

    db.commit()
    db.refresh(async_token)
    return async_token


@router.get("/async/{token}", response_model=AsyncVerificationResponse)
def get_async_verification(
    token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get async verification token details."""
    async_token = db.query(AsyncVerificationToken).filter(
        AsyncVerificationToken.token == token
    ).first()
    if not async_token:
        raise HTTPException(status_code=404, detail="Verification link not found")
    if current_user.id not in (async_token.courier_id, async_token.customer_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Check expiry
    if async_token.expires_at < datetime.utcnow() and async_token.status == "pending":
        async_token.status = "expired"
        db.commit()
        db.refresh(async_token)

    return async_token


@router.post("/async/{token}/submit", response_model=AsyncVerificationResponse)
def submit_async_verification(
    token: str,
    req: AsyncVerificationSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Customer submits video/voice data for async verification."""
    async_token = db.query(AsyncVerificationToken).filter(
        AsyncVerificationToken.token == token
    ).first()
    if not async_token:
        raise HTTPException(status_code=404, detail="Verification link not found")
    if async_token.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if async_token.status != "pending":
        raise HTTPException(status_code=400, detail=f"This verification is already {async_token.status}")
    if async_token.expires_at < datetime.utcnow():
        async_token.status = "expired"
        db.commit()
        raise HTTPException(status_code=410, detail="Verification link has expired")

    async_token.video_data = req.video_data
    async_token.audio_data = req.audio_data
    async_token.status = "submitted"
    async_token.submitted_at = datetime.utcnow()

    # Update shipment status so courier sees the submission
    shipment = db.query(Shipment).filter(Shipment.id == async_token.shipment_id).first()
    if shipment:
        shipment.status = "Async Verification Submitted"

    db.commit()
    db.refresh(async_token)
    return async_token


# ─── Courier: Get Submitted Frames ───────────────────────────────────────────

@router.get("/async/{token}/frames")
def get_async_verification_frames(
    token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Courier retrieves the submitted face frames for manual review."""
    async_token = db.query(AsyncVerificationToken).filter(
        AsyncVerificationToken.token == token
    ).first()
    if not async_token:
        raise HTTPException(status_code=404, detail="Verification link not found")
    if async_token.courier_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if async_token.status not in ("submitted", "verified", "rejected", "inconclusive"):
        raise HTTPException(status_code=400, detail="No submitted data yet")

    frames: List[str] = []
    if async_token.video_data:
        frames = async_token.video_data.split("||")

    return {"frames": frames, "frame_count": len(frames)}


# ─── Courier: Run AI Analysis ────────────────────────────────────────────────

@router.post("/async/{token}/analyze", response_model=AsyncVerificationAnalyzeResponse)
def analyze_async_verification(
    token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Courier triggers AI analysis on the customer's submitted frames."""
    if current_user.role != UserRole.COURIER:
        raise HTTPException(status_code=403, detail="Only couriers can run AI analysis")

    async_token = db.query(AsyncVerificationToken).filter(
        AsyncVerificationToken.token == token
    ).first()
    if not async_token:
        raise HTTPException(status_code=404, detail="Verification link not found")
    if async_token.courier_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if async_token.status not in ("submitted", "verified", "rejected", "inconclusive"):
        raise HTTPException(status_code=400, detail="No submitted data to analyze")
    if not async_token.video_data:
        raise HTTPException(status_code=400, detail="No video frames in submission")

    if not _AI_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="AI module not available. Install required packages (deepface, opencv-python).",
        )

    # ── Build reference list: shipment photo (primary) + call captures (secondary) ──
    reference_b64_list: List[str] = []
    shipment = db.query(Shipment).filter(Shipment.id == async_token.shipment_id).first()
    if shipment and shipment.image_url:
        reference_b64_list.append(shipment.image_url)
    if async_token.call_session_id:
        captures = db.query(CallMediaCapture).filter(
            CallMediaCapture.call_session_id == async_token.call_session_id,
            CallMediaCapture.encrypted_data.isnot(None),
        ).all()
        reference_b64_list.extend(c.encrypted_data for c in captures if c.encrypted_data)

    live_b64_list = async_token.video_data.split("||")

    try:
        system = get_identity_system()
        result = system.verify_from_base64(reference_b64_list, live_b64_list)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {exc}")

    # Persist results on the token (but do NOT change status — courier decides)
    confidence_pct = int(round(result["confidence"] * 100))
    if result["is_match"]:
        ai_result = "match"
    elif result["avg_similarity"] >= 0.4:
        ai_result = "inconclusive"
    else:
        ai_result = "no_match"

    async_token.ai_confidence = confidence_pct
    async_token.ai_result = ai_result
    db.commit()

    return AsyncVerificationAnalyzeResponse(
        is_match=result["is_match"],
        confidence=result["confidence"],
        avg_similarity=result["avg_similarity"],
        avg_liveness=result["avg_liveness"],
        frame_count=result["frame_count"],
        frames_analysed=result.get("frames_analysed", 0),
        ai_confidence=confidence_pct,
        ai_result=ai_result,
        error=result.get("error"),
        courier_decision=result.get("courier_decision"),
    )


# ─── Courier: Make Verification Decision ─────────────────────────────────────

@router.post("/async/{token}/decide", response_model=AsyncVerificationResponse)
def decide_async_verification(
    token: str,
    req: AsyncVerificationDecideRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Courier manually accepts or rejects the customer identity verification."""
    if current_user.role != UserRole.COURIER:
        raise HTTPException(status_code=403, detail="Only couriers can make verification decisions")

    async_token = db.query(AsyncVerificationToken).filter(
        AsyncVerificationToken.token == token
    ).first()
    if not async_token:
        raise HTTPException(status_code=404, detail="Verification link not found")
    if async_token.courier_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if async_token.status not in ("submitted", "inconclusive"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot decide on a verification with status '{async_token.status}'",
        )

    async_token.status = "verified" if req.is_verified else "rejected"

    shipment = db.query(Shipment).filter(Shipment.id == async_token.shipment_id).first()
    if shipment:
        if req.is_verified:
            shipment.status = "Awaiting Decision"
        else:
            shipment.status = "Verification Failed"

    # Create CustomerVerification record
    verification = CustomerVerification(
        shipment_id=async_token.shipment_id,
        call_session_id=async_token.call_session_id,
        courier_id=async_token.courier_id,
        customer_id=async_token.customer_id,
        is_verified=req.is_verified,
        method="async_video",
        notes=req.notes or (
            f"AI confidence: {async_token.ai_confidence}%"
            if async_token.ai_confidence is not None else None
        ),
    )
    db.add(verification)
    db.commit()
    db.refresh(async_token)
    return async_token


@router.get("/async-pending/{shipment_id}", response_model=List[AsyncVerificationResponse])
def get_pending_async_verifications(
    shipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all async verification tokens for a shipment."""
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if current_user.id not in (shipment.sender_id, shipment.courier_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    return db.query(AsyncVerificationToken).filter(
        AsyncVerificationToken.shipment_id == shipment_id,
    ).order_by(AsyncVerificationToken.created_at.desc()).all()


# ─── Post-Call Photo Capture (Courier takes photo at the door) ────────────────────────

@router.post("/capture-post/{session_token}", response_model=MediaCaptureResponse)
def capture_post_call_frame(
    session_token: str,
    req: CaptureFrameRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Courier takes a photo of the customer at the door after (or during) the call.
    Saved as a CallMediaCapture snapshot so it can be used for AI analysis.
    """
    if current_user.role != UserRole.COURIER:
        raise HTTPException(status_code=403, detail="Only couriers can add verification photos")

    session = db.query(VideoCallSession).filter(
        VideoCallSession.session_token == session_token
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Call session not found")
    if session.courier_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized for this session")
    if session.status not in ("active", "completed"):
        raise HTTPException(
            status_code=400,
            detail="Session must be active or completed to add verification photos",
        )

    capture = CallMediaCapture(
        call_session_id=session.id,
        capture_type="snapshot",
        encrypted_data=req.image_data,
    )
    db.add(capture)
    db.commit()
    db.refresh(capture)
    return capture


# ─── AI Face-Consistency Check ───────────────────────────────────────────────────────────

@router.post("/ai-check/{session_token}")
def ai_check_session(
    session_token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Run AI face-consistency check on all captured frames for a call session.

    Strategy:
      - 1 frame  → verify face was detected (single-frame self-check).
      - 2+ frames → use the first frame as the reference identity; compare all
                    subsequent frames against it to confirm the same face
                    appeared throughout the call.

    Returns confidence, similarity, and liveness scores to help the courier
    make a verification decision.
    """
    if current_user.role != UserRole.COURIER:
        raise HTTPException(status_code=403, detail="Only couriers can run AI checks")

    session = db.query(VideoCallSession).filter(
        VideoCallSession.session_token == session_token
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Call session not found")
    if session.courier_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized for this session")

    captures = (
        db.query(CallMediaCapture)
        .filter(
            CallMediaCapture.call_session_id == session.id,
            CallMediaCapture.encrypted_data.isnot(None),
        )
        .order_by(CallMediaCapture.created_at.asc())
        .all()
    )
    if not captures:
        raise HTTPException(
            status_code=400,
            detail="No captured frames available. Capture frames during the call or take a post-call photo.",
        )

    if not _AI_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="AI module not available. Install insightface to enable.",
        )

    b64_list = [c.encrypted_data for c in captures]
    try:
        system = get_identity_system()
        # Use shipment registration photo as primary reference; fall back to first capture
        shipment = db.query(Shipment).filter(Shipment.id == session.shipment_id).first()
        ref_list = [shipment.image_url] if (shipment and shipment.image_url) else []
        if ref_list:
            # Shipment registration photo vs all captured frames
            result = system.verify_from_base64(ref_list, b64_list)
        elif len(b64_list) == 1:
            result = system.verify_from_base64(b64_list, b64_list)
        else:
            # Fallback: first captured frame as reference
            result = system.verify_from_base64([b64_list[0]], b64_list[1:])

        return {
            "frame_count": len(b64_list),
            "is_match": result.get("is_match", False),
            "confidence": result.get("confidence", 0.0),
            "avg_similarity": result.get("avg_similarity", 0.0),
            "avg_liveness": result.get("avg_liveness", 0.0),
            "frames_analysed": result.get("frames_analysed", 0),
            "courier_decision": result.get("courier_decision"),
            "error": result.get("error"),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {exc}")


@router.get("/my-pending-links", response_model=List[AsyncVerificationResponse])
def get_my_pending_verification_links(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all pending async verification links for the current customer."""
    now = datetime.utcnow()

    # Auto-expire old tokens
    expired = db.query(AsyncVerificationToken).filter(
        AsyncVerificationToken.customer_id == current_user.id,
        AsyncVerificationToken.status == "pending",
        AsyncVerificationToken.expires_at < now,
    ).all()
    for t in expired:
        t.status = "expired"
    if expired:
        db.commit()

    return db.query(AsyncVerificationToken).filter(
        AsyncVerificationToken.customer_id == current_user.id,
        AsyncVerificationToken.status == "pending",
        AsyncVerificationToken.expires_at >= now,
    ).order_by(AsyncVerificationToken.created_at.desc()).all()


# ─── AI Comparison ───────────────────────────────────────────────────────────

def _run_ai_comparison(async_token: AsyncVerificationToken, db: Session) -> int:
    """
    Run AI face-similarity comparison between:
      - Reference: captured frames from the video call session (CallMediaCapture).
      - Live:      base64 image(s) submitted by the customer (video_data).

    Returns confidence as an integer 0-100.
    Falls back to a heuristic score when insightface is unavailable.
    """
    # ── Build reference list: shipment photo (primary) + call captures ────────
    reference_b64_list = []
    shipment_obj = db.query(Shipment).filter(Shipment.id == async_token.shipment_id).first()
    if shipment_obj and shipment_obj.image_url:
        reference_b64_list.append(shipment_obj.image_url)
    if async_token.call_session_id:
        captures = db.query(CallMediaCapture).filter(
            CallMediaCapture.call_session_id == async_token.call_session_id,
            CallMediaCapture.encrypted_data.isnot(None),
        ).all()
        reference_b64_list.extend(c.encrypted_data for c in captures if c.encrypted_data)

    # ── Run AI comparison if the library is available ─────────────────────────
    if _AI_AVAILABLE and reference_b64_list and async_token.video_data:
        try:
            system = get_identity_system()
            # video_data may be a single base64 image or a comma-separated list
            live_b64_list = (
                async_token.video_data.split("||")
                if "||" in async_token.video_data
                else [async_token.video_data]
            )
            result = system.verify_from_base64(reference_b64_list, live_b64_list)
            # Convert cosine similarity (0-1) to a 0-100 integer confidence
            return int(round(result["confidence"] * 100))
        except Exception as exc:
            # Log but don't crash the endpoint
            print(f"[AI verification error] {exc}")

    # ── Fallback heuristic (no AI library / no reference frames) ─────────────
    base_confidence = 40 if reference_b64_list else 20
    video_bonus = min(30, len(async_token.video_data or "") // 1000)
    audio_bonus = min(20, len(async_token.audio_data or "") // 500)
    noise = random.randint(-10, 10)
    return max(0, min(100, base_confidence + video_bonus + audio_bonus + noise))


# ─── Get Latest Call Session for Shipment ────────────────────────────────────

@router.get("/session/{shipment_id}", response_model=Optional[CallSessionResponse])
def get_shipment_latest_session(
    shipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the latest video call session for a shipment (for navigation to verification page)."""
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if current_user.role == UserRole.CUSTOMER and shipment.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if current_user.role == UserRole.COURIER and shipment.courier_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get the latest session for this shipment
    session = db.query(VideoCallSession).filter(
        VideoCallSession.shipment_id == shipment_id
    ).order_by(VideoCallSession.created_at.desc()).first()

    if not session:
        return None
    return session
