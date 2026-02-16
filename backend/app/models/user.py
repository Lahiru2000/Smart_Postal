from sqlalchemy import Column, Integer, String, Enum
from sqlalchemy.orm import relationship
import enum
from app.database import Base

class UserRole(str, enum.Enum):
    CUSTOMER = "customer"
    COURIER = "courier"
    ADMIN = "admin"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), unique=True, index=True)
    full_name = Column(String(100))
    hashed_password = Column(String(255))
    phone = Column(String(20))
    role = Column(Enum(UserRole), default=UserRole.CUSTOMER)

    # Relationships
    sent_shipments = relationship("Shipment", foreign_keys="Shipment.sender_id", back_populates="sender")
    assigned_shipments = relationship("Shipment", foreign_keys="Shipment.courier_id", back_populates="courier")