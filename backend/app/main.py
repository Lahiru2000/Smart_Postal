from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.database import engine, Base
from app.routes import auth, shipments, voice_auth
from app.routes import delivery                          # ← new

# Import models to register them with SQLAlchemy Base
from app.models import user, shipment
from app.models import voice_auth as voice_auth_models
from app.models import delivery as delivery_models       # ← new (registers 4 tables)

import logging

logger = logging.getLogger(__name__)

# Create Tables (idempotent — safe to run on every startup)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SmartPostal API",
    version="2.0.0",
    description="Smart postal delivery platform with real-time routing, disruption management, and inter-postman handoffs.",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",    # Courier frontend
        "http://localhost:3001",    # Customer frontend
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global exception handler ─────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch unhandled exceptions so CORS headers are still present in the response."""
    logger.error(
        "Unhandled error on %s %s: %s",
        request.method, request.url.path, exc,
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Check server logs for details."},
    )

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(shipments.router)
app.include_router(voice_auth.router)
app.include_router(delivery.router)              # ← new

@app.get("/", tags=["Health"])
def read_root():
    return {"message": "Welcome to SmartPostal API", "version": "2.0.0"}

@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "healthy"}