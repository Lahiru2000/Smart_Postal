from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from app.database import engine, Base
from app.routes import auth, shipments, voice_auth
# Import models to register them with SQLAlchemy Base
from app.models import user, shipment
from app.models import voice_auth as voice_auth_models
import logging
import importlib.util
import sys
import os

# ── Bootstrap face-ai-engine directories (hyphens → underscore aliases) ──
_app_dir = os.path.dirname(os.path.abspath(__file__))
for _sub in ["models", "routes", "schemas", "services"]:
    _pkg_dir = os.path.join(_app_dir, _sub, "face-ai-engine")
    _init = os.path.join(_pkg_dir, "__init__.py")
    _alias = f"app.{_sub}.face_ai_engine"
    if os.path.isfile(_init) and _alias not in sys.modules:
        _spec = importlib.util.spec_from_file_location(
            _alias, _init, submodule_search_locations=[_pkg_dir]
        )
        _mod = importlib.util.module_from_spec(_spec)
        sys.modules[_alias] = _mod
        _spec.loader.exec_module(_mod)

# Now import face-ai-engine modules using underscore alias
from app.models.face_ai_engine import video_call as video_call_models  # noqa: E402
from app.models.face_ai_engine import verification_link as verification_link_models  # noqa: E402
from app.routes.face_ai_engine import video_call as video_call_routes  # noqa: E402
from app.routes.face_ai_engine import verification_link as verification_link_routes  # noqa: E402

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
app.include_router(video_call_routes.router)
app.include_router(verification_link_routes.router)

# Serve uploaded verification videos as static files
_uploads_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads", "verifications")
os.makedirs(_uploads_dir, exist_ok=True)
app.mount("/uploads/verifications", StaticFiles(directory=_uploads_dir), name="verification_uploads")

# Serve uploaded shipment media (images + videos) as static files
_shipment_uploads_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads", "shipments")
os.makedirs(_shipment_uploads_dir, exist_ok=True)
app.mount("/uploads/shipments", StaticFiles(directory=_shipment_uploads_dir), name="shipment_uploads")

@app.get("/")
def read_root():
    return {"message": "Welcome to SmartPostal API"}