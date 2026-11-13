"""Pydantic request/response schemas for the LSTM forecasting API.

These are the contract between the Python service and the .NET consumer.
Keep them in sync with the .NET DTOs in SteelTrack.Application.DTOs.Forecast.
"""

from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# Which engine produced a forecast row: the trained LSTM, or the
# seasonal-naive fallback used for series that have no trained model.
ForecastSource = Literal["lstm", "seasonal_naive"]


class TrainRequest(BaseModel):
    """Request body for POST /train to trigger model retraining."""

    product_ids: list[UUID] = Field(
        ...,
        description="List of product UUIDs to train models for. Empty = all active products.",
    )
    branch_ids: list[UUID] = Field(
        ...,
        description="List of branch UUIDs to train models for. Empty = all active branches.",
    )
    lookback_months: int = Field(
        default=24,
        ge=6,
        le=60,
        description="Number of historical months to use as input sequence.",
    )
    horizon_months: int = Field(
        default=3,
        ge=1,
        le=12,
        description="Number of future months to predict.",
    )
    retrain: bool = Field(
        default=False,
        description="If true, overwrite existing model artifacts; if false, only train missing models.",
    )
    min_history_months: int | None = Field(
        default=None,
        ge=1,
        description="Optional minimum non-zero history months required to train. Defaults to service config.",
    )

    model_config = ConfigDict(from_attributes=True)


class TrainingJobResponse(BaseModel):
    """Response for POST /train — accepted job with tracking ID."""

    job_id: str = Field(..., description="Unique job identifier for status polling")
    status: str = Field(..., description="Current state: queued, running, completed, failed")
    model_version: str | None = Field(None, description="Semantic version of trained model")
    estimated_completion: str | None = Field(
        None, description="ISO8601 timestamp of expected completion"
    )


class ForecastPrediction(BaseModel):
    """Single prediction for a (product, branch, month) tuple."""

    product_id: UUID
    product_sku: str
    product_name: str
    branch_id: UUID
    branch_code: str
    forecast_month: date = Field(..., description="First day of the forecast month (UTC)")
    predicted_quantity: int = Field(..., ge=0, description="Point forecast: expected units")
    confidence_lower: int = Field(..., ge=0, description="95% CI lower bound (inclusive)")
    confidence_upper: int = Field(..., ge=0, description="95% CI upper bound (inclusive)")
    trend: str = Field(..., pattern="^(up|down|stable)$", description="Direction vs prior month")
    model_version: str = Field(..., description="Model artifact version used for this prediction")
    source: ForecastSource = Field(
        ...,
        description=(
            "Which engine produced this row: the trained LSTM, or the "
            "seasonal-naive fallback used for series without a trained model"
        ),
    )


class PredictRequest(BaseModel):
    """Query parameters for GET /predict (validated via FastAPI Query)."""

    product_ids: list[UUID] | None = Field(
        default=None, description="Filter to specific products; None = all"
    )
    branch_ids: list[UUID] | None = Field(
        default=None, description="Filter to specific branches; None = all"
    )
    horizon_months: int = Field(
        default=3, ge=1, le=12, description="How many months ahead to return"
    )
    model_version: str | None = Field(
        default=None, description="Specific model version; None = latest"
    )


class PredictResponse(BaseModel):
    """Response body for GET /predict."""

    predictions: list[ForecastPrediction]
    model_version: str = Field(..., description="Model version used for all predictions")
    generated_at: str = Field(..., description="ISO8601 timestamp of generation")
    count: int = Field(..., description="Number of prediction rows returned")