from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.database import engine, Base
from app.routes import auth, shipments, voice_auth
# Import models to register them with SQLAlchemy Base
from app.models import user, shipment
from app.models import voice_auth as voice_auth_models
import logging

logger = logging.getLogger(__name__)

# Create Tables
Base.metadata.create_all(bind=engine)

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


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch unhandled exceptions so CORS headers are still included in the response."""
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Check server logs for details."},
    )

app.include_router(auth.router)
app.include_router(shipments.router)
app.include_router(voice_auth.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to SmartPostal API"}