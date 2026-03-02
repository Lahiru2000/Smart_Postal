from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
import os
from app.database import get_db
from app.models.shipment import Shipment
from app.models.user import User, UserRole
from app.schemas.shipment import ShipmentCreate, ShipmentUpdate, ShipmentResponse
from app.services.auth import get_current_user

router = APIRouter(prefix="/shipments", tags=["Shipments"])

# Upload directory for shipment media (images + videos)
SHIPMENT_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "uploads", "shipments")
os.makedirs(SHIPMENT_UPLOAD_DIR, exist_ok=True)

@router.post("/", response_model=ShipmentResponse)
def create_shipment(
    shipment: ShipmentCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=403, detail="Only customers can create shipments")

    tracking_num = "TRK-" + str(uuid.uuid4())[:8].upper()
    new_shipment = Shipment(
        tracking_number=tracking_num,
        sender_id=current_user.id,
        sender_name=shipment.sender_name,
        sender_phone=shipment.sender_phone,
        pickup_address=shipment.pickup_address,
        receiver_name=shipment.receiver_name,
        receiver_phone=shipment.receiver_phone,
        delivery_address=shipment.delivery_address,
        package_weight=shipment.package_weight,
        package_type=shipment.package_type,
        description=shipment.description,
        image_url=shipment.image_url,
        video_url=shipment.video_url,
        media_type=shipment.media_type,
        voice_verification_required=shipment.voice_verification_required or False,
        status="Pending"
    )
    db.add(new_shipment)
    db.commit()
    db.refresh(new_shipment)
    return new_shipment

@router.get("/", response_model=List[ShipmentResponse])
def get_shipments(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    if current_user.role == UserRole.CUSTOMER:
        return db.query(Shipment).filter(Shipment.sender_id == current_user.id).order_by(Shipment.created_at.desc()).all()
    elif current_user.role == UserRole.COURIER:
        return db.query(Shipment).filter(
            (Shipment.courier_id == current_user.id) | (Shipment.status == "Pending")
        ).order_by(Shipment.created_at.desc()).all()
    return []

@router.get("/track/{tracking_number}", response_model=ShipmentResponse)
def track_shipment(
    tracking_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    shipment = db.query(Shipment).filter(Shipment.tracking_number == tracking_number).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    # Customers can only track their own shipments
    if current_user.role == UserRole.CUSTOMER and shipment.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this shipment")
    return shipment

@router.get("/{shipment_id}", response_model=ShipmentResponse)
def get_shipment(
    shipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if current_user.role == UserRole.CUSTOMER and shipment.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return shipment

@router.put("/{shipment_id}", response_model=ShipmentResponse)
def update_shipment(
    shipment_id: int,
    update_data: ShipmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    # Courier Accepting Job logic
    if current_user.role == UserRole.COURIER:
        if shipment.courier_id is None:
             shipment.courier_id = current_user.id
             shipment.status = "In Transit"
        elif shipment.courier_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")

    # Image Logic (Only allow adding if none exists)
    if update_data.image_url:
        if shipment.image_url:
             raise HTTPException(status_code=400, detail="Image already exists. Cannot replace.")
        shipment.image_url = update_data.image_url

    # Video URL update
    if update_data.video_url is not None:
        shipment.video_url = update_data.video_url

    # Media type update
    if update_data.media_type is not None:
        shipment.media_type = update_data.media_type

    # Update editable fields (customer can update before delivery)
    for field in ["receiver_name", "receiver_phone", "delivery_address", "package_weight", "package_type", "description"]:
        val = getattr(update_data, field, None)
        if val is not None:
            setattr(shipment, field, val)

    if update_data.voice_verification_required is not None:
        shipment.voice_verification_required = update_data.voice_verification_required

    if update_data.courier_id is not None and current_user.role == UserRole.COURIER:
        shipment.courier_id = update_data.courier_id

    if update_data.status:
        # Block delivery completion if voice verification is required but not approved
        if update_data.status == "Delivered" and shipment.voice_verification_required:
            if shipment.voice_verification_status != "approved":
                raise HTTPException(
                    status_code=400,
                    detail="Voice verification is required before marking as delivered. "
                           "Please complete the voice verification process first."
                )
        shipment.status = update_data.status

    db.commit()
    db.refresh(shipment)
    return shipment

@router.delete("/{shipment_id}")
def delete_shipment(
    shipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    # Only the sender can delete, and only while still Pending
    if current_user.role != UserRole.CUSTOMER or shipment.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this shipment")
    if shipment.status != "Pending":
        raise HTTPException(status_code=400, detail="Can only delete shipments with Pending status")
    
    db.delete(shipment)
    db.commit()
    return {"detail": "Shipment deleted successfully"}


@router.post("/upload-media")
async def upload_shipment_media(
    file: UploadFile = File(...),
    media_type: str = Form(...),  # 'image' or 'video'
    current_user: User = Depends(get_current_user),
):
    """
    Upload an image or video file for a shipment.
    Returns the URL path that can be stored in the shipment record.
    """
    # Validate media type
    if media_type not in ("image", "video"):
        raise HTTPException(status_code=400, detail="media_type must be 'image' or 'video'")

    # Validate file type
    allowed_image = {"image/jpeg", "image/png", "image/gif", "image/svg+xml", "image/webp"}
    allowed_video = {"video/mp4", "video/webm", "video/quicktime", "video/x-matroska", "video/avi"}
    allowed = allowed_image if media_type == "image" else allowed_video

    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

    # Size limits: images 5MB, videos 100MB
    max_size = 5 * 1024 * 1024 if media_type == "image" else 100 * 1024 * 1024
    contents = await file.read()
    if len(contents) > max_size:
        limit_mb = max_size // (1024 * 1024)
        raise HTTPException(status_code=400, detail=f"File too large. Max {limit_mb}MB.")

    # Generate unique filename
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else ("jpg" if media_type == "image" else "webm")
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(SHIPMENT_UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(contents)

    # Return the public URL
    url = f"/uploads/shipments/{filename}"
    return {"url": url, "media_type": media_type, "filename": filename}