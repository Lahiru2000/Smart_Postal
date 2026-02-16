from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import uuid
from app.database import get_db
from app.models.shipment import Shipment
from app.models.user import User, UserRole
from app.schemas.shipment import ShipmentCreate, ShipmentUpdate, ShipmentResponse
from app.services.auth import get_current_user

router = APIRouter(prefix="/shipments", tags=["Shipments"])

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
    
    if update_data.status:
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