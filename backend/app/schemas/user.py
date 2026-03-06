from pydantic import BaseModel, EmailStr
from app.models.user import UserRole

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    phone: str
    role: UserRole

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str
    role: UserRole  # Required: must match user's actual role

class UserUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    password: str | None = None

class UserResponse(UserBase):
    id: int
    class Config:
        from_attributes = True