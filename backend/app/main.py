from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routes import auth, shipments
# Import models to register them with SQLAlchemy Base
from app.models import user, shipment 

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

app.include_router(auth.router)
app.include_router(shipments.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to SmartPostal API"}