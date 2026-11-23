"""FastAPI HTTP service for SteelTrack TensorFlow/Keras LSTM Demand Forecasting."""

from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from uuid import UUID

import uvicorn
from fastapi import Depends, FastAPI, HTTPException, Header, status
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from ml.predictor import KerasPredictor

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("KerasLstmServer")

API_KEY = os.getenv("LSTM_API_KEY", "st_live_lstm_dAnBjPTeD6YZCoQdm5UX5RpZVDBqRSRLrctKzG8z-bQ")


# --- Schemas ----------------------------------------------------------------
class PredictRequest(BaseModel):
    product_ids: list[UUID] | None = Field(default=None, alias="product_ids")
    branch_ids: list[UUID] | None = Field(default=None, alias="branch_ids")
    horizon_months: int = Field(default=3, alias="horizon_months", ge=1, le=12)
    model_version: str | None = Field(default=None, alias="model_version")

    model_config = {"populate_by_name": True}


class TrainRequest(BaseModel):
    product_ids: list[UUID] = Field(default_factory=list)
    branch_ids: list[UUID] = Field(default_factory=list)
    lookback_months: int = 12
    horizon_months: int = 3
    retrain: bool = False


_predictor: KerasPredictor | None = None
_training_jobs: dict[str, dict] = {}


def get_predictor() -> KerasPredictor:
    global _predictor
    if _predictor is None:
        _predictor = KerasPredictor()
    return _predictor


async def verify_api_key(x_lstm_api_key: str | None = Header(default=None, alias="X-LSTM-API-KEY")):
    if x_lstm_api_key and x_lstm_api_key != API_KEY:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing SteelTrack Keras LSTM service...")
    get_predictor()
    logger.info("Keras LSTM service ready on http://0.0.0.0:8000")
    yield
    logger.info("Keras LSTM service shutting down.")


app = FastAPI(
    title="SteelTrack Keras LSTM Demand Forecast Service",
    version="1.0.0",
    description="TensorFlow / Keras 3 LSTM monthly demand forecasting service for steel products.",
    lifespan=lifespan,
)


@app.get("/", tags=["root"])
async def root():
    predictor = get_predictor()
    return {
        "service": "SteelTrack Keras LSTM Forecasting Service",
        "version": predictor.version,
        "status": "ready",
        "framework": "TensorFlow 2.21 / Keras 3.15",
        "endpoints": {
            "health": "/health",
            "models": "/models",
            "predict": "/predict",
            "train": "/train",
            "metrics": "/metrics",
            "docs": "/docs",
        },
    }


@app.get("/health", tags=["health"])
async def health():
    predictor = get_predictor()
    return {
        "status": "healthy",
        "service": "steeltrack-keras-lstm",
        "model_loaded": predictor.model is not None,
        "model_version": predictor.version,
    }


@app.get("/models", tags=["models"])
async def list_models():
    predictor = get_predictor()
    manifest_path = predictor.models_dir / "manifest.json"
    manifest = {}
    if manifest_path.exists():
        import json

        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

    return {
        "latest_version": predictor.version,
        "model_loaded": predictor.model is not None,
        "manifest": manifest,
    }


@app.post("/predict", dependencies=[Depends(verify_api_key)], tags=["predictions"])
async def predict(req: PredictRequest):
    predictor = get_predictor()
    try:
        raw_rows = predictor.predict(
            product_ids=req.product_ids,
            branch_ids=req.branch_ids,
            horizon_months=req.horizon_months,
        )
        return {
            "predictions": [r.to_dict() for r in raw_rows],
            "model_version": predictor.version,
            "generated_at": datetime.now(UTC).isoformat(),
            "count": len(raw_rows),
        }
    except Exception as exc:
        logger.exception("Inference failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference error: {exc}",
        ) from exc


@app.get("/predict", dependencies=[Depends(verify_api_key)], tags=["predictions"])
async def predict_get(horizon_months: int = 3):
    predictor = get_predictor()
    raw_rows = predictor.predict(horizon_months=horizon_months)
    return {
        "predictions": [r.to_dict() for r in raw_rows],
        "model_version": predictor.version,
        "generated_at": datetime.now(UTC).isoformat(),
        "count": len(raw_rows),
    }


@app.post("/train", dependencies=[Depends(verify_api_key)], status_code=status.HTTP_202_ACCEPTED, tags=["training"])
async def trigger_training(req: TrainRequest):
    job_id = f"job-{datetime.now(UTC).strftime('%Y%m%dT%H%M%S')}"
    _training_jobs[job_id] = {
        "job_id": job_id,
        "status": "queued",
        "created_at": datetime.now(UTC).isoformat(),
    }

    async def _async_train():
        _training_jobs[job_id]["status"] = "running"
        try:
            from ml.train import train as do_train

            manifest = do_train()
            _training_jobs[job_id]["status"] = "completed"
            _training_jobs[job_id]["manifest"] = manifest
            # Reload predictor
            global _predictor
            _predictor = KerasPredictor()
        except Exception as e:
            _training_jobs[job_id]["status"] = "failed"
            _training_jobs[job_id]["error"] = str(e)

    asyncio.create_task(_async_train())

    return {
        "job_id": job_id,
        "status": "queued",
        "model_version": None,
    }


@app.get("/train/status/{job_id}", tags=["training"])
async def training_status(job_id: str):
    job = _training_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.get("/metrics", tags=["monitoring"])
async def metrics():
    # Simple Prometheus metrics representation
    predictor = get_predictor()
    body = (
        f"# HELP keras_lstm_service_up Status of Keras LSTM service\n"
        f"# TYPE keras_lstm_service_up gauge\n"
        f"keras_lstm_service_up 1\n"
        f"# HELP keras_lstm_model_loaded 1 if model is loaded\n"
        f"# TYPE keras_lstm_model_loaded gauge\n"
        f"keras_lstm_model_loaded {1 if predictor.model else 0}\n"
    )
    return Response(content=body, media_type="text/plain; version=0.0.4; charset=utf-8")


def main():
    uvicorn.run("ml.server:app", host="0.0.0.0", port=8000, reload=False)


if __name__ == "__main__":
    main()

