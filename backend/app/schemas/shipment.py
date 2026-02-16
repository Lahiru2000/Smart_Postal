from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ShipmentCreate(BaseModel):
    sender_name: str
    sender_phone: str
    pickup_address: str
    receiver_name: str
    receiver_phone: str
    delivery_address: str
    package_weight: Optional[float] = None
    package_type: Optional[str] = "Standard"
    description: Optional[str] = None
    image_url: Optional[str] = None

class ShipmentUpdate(BaseModel):
    status: Optional[str] = None
    image_url: Optional[str] = None

class ShipmentResponse(BaseModel):
    id: int
    tracking_number: str
    sender_id: int
    courier_id: Optional[int] = None
    sender_name: Optional[str] = None
    sender_phone: Optional[str] = None
    pickup_address: str
    receiver_name: Optional[str] = None
    receiver_phone: Optional[str] = None
    delivery_address: str
    package_weight: Optional[float] = None
    package_type: Optional[str] = None
    description: Optional[str] = None
    status: str
    image_url: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True