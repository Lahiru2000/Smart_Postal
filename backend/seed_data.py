"""Insert sample users and shipments for testing the voice assistant.

Run: python -m seed_data   (from backend/)
Re-run safe: deletes old test shipments first, then re-inserts.
"""
from app.database import SessionLocal
from app.models.user import User, UserRole
from app.models.shipment import Shipment
from app.models.voice_auth import VoiceEnrollment, VoiceProfile, VoiceVerification  # needed for relationship resolution
from passlib.context import CryptContext
from datetime import datetime, timedelta

pwd = CryptContext(schemes=["bcrypt"])
db = SessionLocal()

# ── Clean old test data ──
TEST_TRACKING_IDS = ["TRK-1001", "TRK-1002", "TRK-1003", "TRK-1004", "TRK-1005",
                     "TRK-00000001", "TRK-00000002", "TRK-00000003", "TRK-00000004", "TRK-00000005"]
deleted = db.query(Shipment).filter(Shipment.tracking_number.in_(TEST_TRACKING_IDS)).delete(synchronize_session=False)
db.commit()
if deleted:
    print(f"Cleaned {deleted} old test shipments")

# ── Users (idempotent) ──
if not db.query(User).filter(User.email == "nadil@test.com").first():
    u1 = User(email="nadil@test.com", full_name="Nadil Roshana",
              hashed_password=pwd.hash("test123"), phone="0771234567", role=UserRole.CUSTOMER)
    u2 = User(email="kamal@test.com", full_name="Kamal Perera",
              hashed_password=pwd.hash("test123"), phone="0779876543", role=UserRole.COURIER)
    u3 = User(email="nimal@test.com", full_name="Nimal Silva",
              hashed_password=pwd.hash("test123"), phone="0775551234", role=UserRole.CUSTOMER)
    db.add_all([u1, u2, u3])
    db.commit()
    print(f"Users created: IDs {u1.id}, {u2.id}, {u3.id}")
else:
    u1 = db.query(User).filter(User.email == "nadil@test.com").first()
    u2 = db.query(User).filter(User.email == "kamal@test.com").first()
    u3 = db.query(User).filter(User.email == "nimal@test.com").first()
    print(f"Users already exist: {u1.id}, {u2.id}, {u3.id}")

# ── Shipments with easy-to-say tracking IDs and FUTURE delivery dates ──
today = datetime.utcnow()

shipments = [
    Shipment(
        tracking_number="TRK-1001", sender_id=u1.id, courier_id=u2.id,
        sender_name="Nadil Roshana", sender_phone="0771234567",
        pickup_address="123 Galle Road, Colombo 03",
        receiver_name="Samantha Fernando", receiver_phone="0776543210",
        delivery_address="45 Kandy Road, Kandy",
        package_weight=2.5, package_type="Standard",
        description="Electronics - Laptop charger",
        status="In Transit",
        package_location="Kaduwela Sorting Center",
        payment_status="Paid",
        not_answered_count=0,
        estimated_delivery=today + timedelta(days=5),
        created_at=today - timedelta(days=1),
    ),
    Shipment(
        tracking_number="TRK-1002", sender_id=u1.id, courier_id=u2.id,
        sender_name="Nadil Roshana", sender_phone="0771234567",
        pickup_address="123 Galle Road, Colombo 03",
        receiver_name="Anjali Wijesinghe", receiver_phone="0712345678",
        delivery_address="78 Beach Road, Galle",
        package_weight=1.0, package_type="Express",
        description="Documents - University papers",
        status="Out for Delivery",
        package_location="Galle Delivery Hub",
        payment_status="COD",
        not_answered_count=0,
        estimated_delivery=today + timedelta(days=2),
        created_at=today,
    ),
    Shipment(
        tracking_number="TRK-1003", sender_id=u3.id, courier_id=u2.id,
        sender_name="Nimal Silva", sender_phone="0775551234",
        pickup_address="900 High Level Road, Nugegoda",
        receiver_name="Ruwan Jayasena", receiver_phone="0789998877",
        delivery_address="12 Temple Road, Kurunegala",
        package_weight=5.0, package_type="Heavy",
        description="Clothing - bulk order",
        status="Pending",
        package_location="Nugegoda Post Office",
        payment_status="Pending",
        not_answered_count=0,
        estimated_delivery=today + timedelta(days=7),
        created_at=today - timedelta(days=2),
    ),
    Shipment(
        tracking_number="TRK-1004", sender_id=u3.id, courier_id=u2.id,
        sender_name="Nimal Silva", sender_phone="0775551234",
        pickup_address="900 High Level Road, Nugegoda",
        receiver_name="Dilshan Bandara", receiver_phone="0701112233",
        delivery_address="56 Main Street, Matara",
        package_weight=0.5, package_type="Standard",
        description="Gift - birthday present",
        status="Delivered",
        package_location="Matara - Delivered",
        payment_status="Paid",
        not_answered_count=0,
        estimated_delivery=today - timedelta(days=3),
        created_at=today - timedelta(days=5),
    ),
    Shipment(
        tracking_number="TRK-1005", sender_id=u1.id, courier_id=u2.id,
        sender_name="Nadil Roshana", sender_phone="0771234567",
        pickup_address="123 Galle Road, Colombo 03",
        receiver_name="Priya Kumari", receiver_phone="0761234567",
        delivery_address="33 Jaffna Road, Jaffna",
        package_weight=3.0, package_type="Standard",
        description="Books - educational materials",
        status="Customer_Not_Answered",
        package_location="Jaffna Delivery Hub",
        payment_status="COD",
        not_answered_count=2,
        estimated_delivery=today + timedelta(days=10),
        created_at=today - timedelta(days=3),
    ),
]
db.add_all(shipments)
db.commit()
print(f"Shipments created: {len(shipments)}")

# ── Summary ──
count = db.query(Shipment).count()
print(f"\nTotal shipments in DB: {count}")
for s in db.query(Shipment).all():
    ed = s.estimated_delivery.strftime("%Y-%m-%d") if s.estimated_delivery else "N/A"
    print(f"  {s.tracking_number} | {s.status:20s} | est: {ed} | {s.receiver_name:20s} | {s.delivery_address}")
db.close()
