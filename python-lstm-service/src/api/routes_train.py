"""Training endpoint for the LSTM forecasting service.

POST /train — triggers a (re)training run for the requested scope.

The run executes in a background asyncio task so the HTTP request returns
immediately with a job ID that the caller can poll via
GET /train/status/{job_id}.
"""

import asyncio
import logging
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status

from src.api.schemas import TrainingJobResponse, TrainRequest
from src.training.pipeline import retrain_all

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/train", tags=["training"])

# In-memory job registry for the MVP. Swap for Redis/DB in production so
# status survives a restart and can be read by multiple workers.
_JOBS: dict[str, dict] = {}


def _public_job(job: dict) -> TrainingJobResponse:
    return TrainingJobResponse(
        job_id=job["job_id"],
        status=job["status"],
        model_version=job.get("model_version"),
        estimated_completion=job.get("estimated_completion"),
    )


@router.post(
    "",
    response_model=TrainingJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger a model training run",
)
async def trigger_training(request: TrainRequest) -> TrainingJobResponse:
    """
    Queue a training run for the given (product, branch) scope.

    Passing empty lists means "all active products" / "all active branches".
    """
    if not request.product_ids and not request.branch_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one of product_ids or branch_ids must be provided",
        )

    job_id = f"job-{datetime.now(UTC).strftime('%Y%m%dT%H%M%S%f')}"
    now = datetime.now(UTC)

    _JOBS[job_id] = {
        "job_id": job_id,
        "status": "queued",
        "model_version": None,
        "product_ids": [str(p) for p in request.product_ids],
        "branch_ids": [str(b) for b in request.branch_ids],
        "lookback_months": request.lookback_months,
        "horizon_months": request.horizon_months,
        "retrain": request.retrain,
        "created_at": now.isoformat(),
        "error": None,
    }

    # Kick off the run in the background.
    asyncio.create_task(_run_job(job_id, request))

    return _public_job(_JOBS[job_id])


async def _run_job(job_id: str, request: TrainRequest) -> None:
    """Execute the training run and update the job record."""
    job = _JOBS.get(job_id)
    if job is None:
        return

    job["status"] = "running"

    try:
        summary = await retrain_all(
            product_ids=list(request.product_ids) if request.product_ids else None,
            branch_ids=list(request.branch_ids) if request.branch_ids else None,
            lookback=request.lookback_months,
            horizon=request.horizon_months,
            min_history_months=request.min_history_months,
        )
        job["status"] = "completed"
        job["model_version"] = summary.get("version")
        job["summary"] = {
            "trained": summary.get("trained", 0),
            "skipped": summary.get("skipped", 0),
            "failed": summary.get("failed", 0),
        }
    except Exception as exc:  # noqa: BLE001 — surface the failure on the job
        logger.exception("Training job %s failed", job_id)
        job["status"] = "failed"
        job["error"] = str(exc)


@router.get(
    "/status/{job_id}",
    response_model=TrainingJobResponse,
    summary="Poll the status of a training job",
)
async def get_training_status(job_id: str) -> TrainingJobResponse:
    """Return the current state of a previously queued training job."""
    job = _JOBS.get(job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Training job '{job_id}' not found",
        )
    return _public_job(job)


@router.get("/jobs", summary="List recent training jobs")
async def list_training_jobs() -> dict:
    """Return the most recent training jobs, newest first."""
    jobs = sorted(_JOBS.values(), key=lambda j: j["created_at"], reverse=True)
    return {"count": len(jobs), "jobs": jobs}
