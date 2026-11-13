"""FastAPI application entry point for the SteelTrack LSTM forecasting service.

Responsibilities:
- Load settings and configure structured logging
- Start the Prometheus metrics exporter
- Register the background scheduler (nightly retrain + drift check)
- Mount the health, prediction and training routers
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import uvicorn
from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import JSONResponse, Response
from fastapi.security import APIKeyHeader
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest, start_http_server

from src.api.routes_health import router as health_router
from src.api.routes_predict import router as predict_router
from src.api.routes_train import router as train_router
from src.config import get_settings
from src.scheduling.scheduler import get_scheduler, stop_scheduler
from src.utils.logging import configure_logging

_settings = get_settings()
configure_logging(_settings.log_level)

# Security: the .NET API sends this header on every forecast call.
api_key_header = APIKeyHeader(name="X-LSTM-API-KEY", auto_error=False)


async def verify_api_key(x_lstm_api_key: str | None = Depends(api_key_header)) -> None:
    """Dependency enforcing the shared secret on protected routes."""
    if x_lstm_api_key is None or x_lstm_api_key != _settings.api_key:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Start and stop the metrics exporter and background scheduler."""
    start_http_server(_settings.metrics_port)

    scheduler = get_scheduler()
    scheduler.start()

    print(
        f"LSTM API ready — API on :8000, metrics on :{_settings.metrics_port}, "
        f"model dir {_settings.model_dir}"
    )

    yield

    stop_scheduler(scheduler)
    print("LSTM API shutting down")


app = FastAPI(
    title="SteelTrack LSTM Demand Forecast",
    version="0.1.0",
    description=(
        "Predicts monthly unit demand per (product, branch) from historical "
        "sales transactions using per-series LSTM models."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    openapi_url="/openapi.json",
)

app.include_router(health_router, tags=["health"])
app.include_router(predict_router, dependencies=[Depends(verify_api_key)], tags=["predictions"])
app.include_router(train_router, dependencies=[Depends(verify_api_key)], tags=["training"])


@app.get("/", tags=["root"])
async def root() -> JSONResponse:
    return JSONResponse(
        content={
            "service": "SteelTrack LSTM Demand Forecasting",
            "version": "0.1.0",
            "status": "ready",
            "docs": "/docs",
            "health": "/health",
            "models": "/models",
            "predict": "/predict",
            "train": "/train",
            "metrics": "/metrics",
        }
    )


@app.get("/models", tags=["models"])
async def list_models() -> JSONResponse:
    """Return available trained model versions and the active version."""
    from src.models.model_registry import ModelRegistry

    registry = ModelRegistry(_settings.model_dir)
    versions = registry.list_versions()
    latest = registry.latest_version()
    recent = {}
    for v in versions[:5]:
        m = registry.read_manifest(v)
        if m:
            recent[v] = {
                "created_at": m.get("created_at"),
                "trained": m.get("trained", 0),
                "skipped": m.get("skipped", 0),
                "failed": m.get("failed", 0),
            }
    return JSONResponse(
        content={
            "latest_version": latest,
            "total_versions": len(versions),
            "versions": versions,
            "recent_manifests": recent,
        }
    )


@app.get("/metrics", operation_id="prometheus_metrics", tags=["monitoring"])
async def metrics() -> Response:
    """Prometheus metrics endpoint for scraping and CI health checks."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


def main() -> None:
    """Console-script entry point."""
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level=_settings.log_level.lower(),
    )


if __name__ == "__main__":
    main()
