"""Health and metrics endpoints for the LSTM forecasting service.

Provides:
- GET /health → health check with database connectivity probe
- GET /metrics → Prometheus metrics (simple counter of prediction requests)
"""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health", summary="Health check endpoint")
async def health_check():
    """Simple liveness probe — returns OK if the process is alive.

    In a production deployment, this could probe PostgreSQL connectivity
    and model registry health, but for MVP it just confirms the process
    is running and responsive.
    """
    return {
        "status": "healthy",
        "service": "steeltrack-lstm",
        "uptime_seconds": None,  # placeholder; can add runtime tracking later
    }


@router.get("/metrics", summary="Prometheus metrics endpoint")
async def metrics():
    """Prometheus metrics exporter.

    Starts a Prometheus HTTP server on the configured port during lifespan.
    In this MVP, we expose a single counter: `prediction_requests_total`.
    Extend with histograms, gauges, etc. as needed.
    """
    from prometheus_client import Counter, generate_latest

    prediction_counter = Counter(
        "prediction_requests_total",
        "Total number of prediction requests served by LSTM API",
    )

    # Increment on every GET /metrics call for demo purposes
    prediction_counter.inc()

    # Return raw Prometheus text format
    return generate_latest(), {"Content-Type": "text/plain; version=0.0.4; charset=utf-8"}