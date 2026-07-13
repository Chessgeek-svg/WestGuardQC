from fastapi import APIRouter

from app.api.analytes import router as analytes_router
from app.api.health import router as health_router
from app.api.qc_lots import router as qc_lots_router

api_router = APIRouter()
api_router.include_router(health_router)

v1_router = APIRouter(prefix="/api/v1")
v1_router.include_router(analytes_router)
v1_router.include_router(qc_lots_router)

api_router.include_router(v1_router)
