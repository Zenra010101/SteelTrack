"""Health endpoints for the LSTM forecasting service.

Provides:
- GET /health → health check probe
"""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health", summary="Health check endpoint")
async def health_check():
    """Simple liveness probe — returns OK if the process is alive.

    In a production deployment, this could probe PostgreSQL connectivity
    and model registry health, but for MVP it confirms the process
    is running and responsive.
    """
    return {
        "status": "healthy",
        "service": "steeltrack-lstm",
        "uptime_seconds": None,
    }
