from fastapi import FastAPI, WebSocket, Query
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routes import auth, shipments
from app.routes.calls import router as calls_router, decisions_router
from app.routes.verification import router as verification_router
# Import models to register them with SQLAlchemy Base
from app.models import user, shipment
from app.models import video_call  # noqa – registers tables
from app.signaling import signaling_endpoint

# Create Tables
Base.metadata.create_all(bind=engine)

# Migrate: add initiated_by column if missing
from sqlalchemy import inspect as sa_inspect, text as sa_text
_inspector = sa_inspect(engine)
if "video_call_sessions" in _inspector.get_table_names():
    _cols = [c["name"] for c in _inspector.get_columns("video_call_sessions")]
    if "initiated_by" not in _cols:
        with engine.connect() as _conn:
            _conn.execute(sa_text("ALTER TABLE video_call_sessions ADD COLUMN initiated_by INTEGER"))
            _conn.commit()

# Migrate: create refresh_tokens table if missing
if "refresh_tokens" not in _inspector.get_table_names():
    from app.models.user import RefreshToken  # noqa
    RefreshToken.__table__.create(bind=engine, checkfirst=True)

# Migrate: widen shipments.image_url from VARCHAR(255) to LONGTEXT for base64 images
if "shipments" in _inspector.get_table_names():
    _img_col = next((c for c in _inspector.get_columns("shipments") if c["name"] == "image_url"), None)
    if _img_col and "VARCHAR" in str(_img_col["type"]).upper():
        with engine.connect() as _conn:
            _conn.execute(sa_text("ALTER TABLE shipments MODIFY COLUMN image_url LONGTEXT"))
            _conn.commit()

app = FastAPI(title="SmartPostal API")

# CORS - Allow frontend apps to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",   # Courier frontend
        "http://localhost:3001",   # Customer frontend
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(shipments.router)
app.include_router(calls_router)
app.include_router(decisions_router)
app.include_router(verification_router)


@app.websocket("/ws/call/{session_token}")
async def ws_call(websocket: WebSocket, session_token: str, token: str = Query(...)):
    """WebRTC signaling relay – authenticated via JWT query param."""
    await signaling_endpoint(websocket, session_token, token)


@app.get("/")
def read_root():
    return {"message": "Welcome to SmartPostal API"}