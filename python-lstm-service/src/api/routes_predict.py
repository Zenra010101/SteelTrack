"""Prediction endpoint for the LSTM forecasting service.

GET /predict  — returns forecasted demand for (product, branch) pairs.
POST /predict — same thing, with the scope in a JSON body.

Both forms share one implementation. The GET form exists for ad-hoc
tooling (curl, the e2e verifier); the POST form exists because a scope of
several hundred product UUIDs does not belong in a URL — a 646-product
query string is ~31 KB, which is well past what proxies and servers
handle comfortably. The .NET API uses POST.
"""

# B008: FastAPI's documented idiom is to call Query()/Depends() in the
# argument defaults — that call *is* the declaration of the parameter's
# metadata, not an accidental default value.
# ruff: noqa: B008

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from prometheus_client import Counter

from src.api.schemas import ForecastPrediction, PredictRequest, PredictResponse
from src.config import get_settings
from src.data.db import get_session
from src.data.repository import ForecastRepository
from src.inference.predictor import Predictor
from src.models.model_registry import ModelRegistry

router = APIRouter(prefix="/predict", tags=["predictions"])

_settings = get_settings()

PREDICTION_REQUESTS_TOTAL = Counter(
    "prediction_requests_total",
    "Total number of prediction requests served by LSTM API",
)


async def _run_predictions(
    *,
    product_ids: list[UUID] | None,
    branch_ids: list[UUID] | None,
    horizon_months: int,
    model_version: str | None,
) -> PredictResponse:
    """Resolve the requested scope into a forecast response.

    Raises HTTPException(503) when the service has no trained model or
    cannot reach the database.
    """
    registry = ModelRegistry(_settings.model_dir)

    if not registry.list_versions():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "No model versions available. Trigger a training run via "
                "POST /train first."
            ),
        )

    async with get_session() as session:
        repository = ForecastRepository(session)
        predictor = Predictor(registry, repository)

        try:
            raw = await predictor.predict(
                product_ids=list(product_ids) if product_ids else None,
                branch_ids=list(branch_ids) if branch_ids else None,
                horizon_months=horizon_months,
                model_version=model_version,
            )
            PREDICTION_REQUESTS_TOTAL.inc()
        except RuntimeError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
            ) from exc

    now = datetime.now(UTC)
    resolved_version = model_version or registry.latest_version() or "unknown"

    return PredictResponse(
        predictions=[
            ForecastPrediction(
                product_id=p.product_id,
                product_sku=p.product_sku,
                product_name=p.product_name,
                branch_id=p.branch_id,
                branch_code=p.branch_code,
                forecast_month=p.forecast_month,
                predicted_quantity=p.predicted_quantity,
                confidence_lower=p.confidence_lower,
                confidence_upper=p.confidence_upper,
                trend=p.trend,
                model_version=p.model_version,
                source=p.source,
            )
            for p in raw
        ],
        model_version=resolved_version,
        generated_at=now.isoformat(),
        count=len(raw),
    )


@router.get(
    "",
    response_model=PredictResponse,
    summary="Get LSTM demand forecasts for given products and branches",
)
async def get_predictions(
    product_ids: list[UUID] | None = Query(
        default=None, description="Repeat or comma-separate product UUIDs; omit for all"
    ),
    branch_ids: list[UUID] | None = Query(
        default=None, description="Repeat or comma-separate branch UUIDs; omit for all"
    ),
    horizon_months: int = Query(
        default=3, ge=1, le=12, description="Number of months to forecast"
    ),
    model_version: str | None = Query(
        default=None, description="Specific model version; omit for latest"
    ),
) -> PredictResponse:
    """
    Return predicted quantities with 95% confidence intervals.

    Each row covers one (product, branch, month) tuple. Series without a
    trained model fall back to a seasonal-naive estimate, and the response
    still includes them so the UI shows complete coverage.
    """
    return await _run_predictions(
        product_ids=product_ids,
        branch_ids=branch_ids,
        horizon_months=horizon_months,
        model_version=model_version,
    )


@router.post(
    "",
    response_model=PredictResponse,
    summary="Get LSTM demand forecasts (scope in the request body)",
)
async def post_predictions(request: PredictRequest) -> PredictResponse:
    """
    Body-based equivalent of GET /predict.

    Prefer this over the GET form when scoping to many products: a scope
    of several hundred UUIDs is a ~30 KB query string, which is not a
    reasonable thing to put in a URL.
    """
    return await _run_predictions(
        product_ids=request.product_ids,
        branch_ids=request.branch_ids,
        horizon_months=request.horizon_months,
        model_version=request.model_version,
    )


@router.get(
    "/versions",
    summary="List available trained model versions",
)
async def list_model_versions() -> dict:
    """Return every stored model version, newest first."""
    registry = ModelRegistry(_settings.model_dir)
    versions = registry.list_versions()
    return {
        "count": len(versions),
        "latest": registry.latest_version(),
        "versions": [
            {
                "version": v,
                "manifest": registry.read_manifest(v),
            }
            for v in versions
        ],
    }
