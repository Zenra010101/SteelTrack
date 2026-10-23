"""Inference pipeline: turn trained models + recent history into forecasts.

The flow for a batch of (product, branch) series:

    1. Load artifacts for the requested model version from the registry.
    2. Fetch the last `lookback_months` of sales from PostgreSQL.
    3. Scale the history with each artifact's frozen scaler.
    4. Run the model to get (mu, sigma) per horizon step.
    5. Un-scale, convert back to integer unit counts.
    6. Compute the 95% confidence interval and the trend label.
    7. Fall back to seasonal-naive for series with no trained model.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from uuid import UUID

import numpy as np
import torch

from src.api.schemas import ForecastSource
from src.config import get_settings
from src.data.preprocessing import (
    classify_trend,
    seasonal_naive_predict,
)
from src.data.repository import (
    ForecastRepository,
    MonthlySeriesPoint,
    add_months,
    month_floor,
)
from src.models.lstm_model import LSTMDemandModel
from src.models.model_registry import ModelRegistry, SeriesArtifact

logger = logging.getLogger(__name__)

# 95% confidence interval multiplier for a standard normal
Z_95 = 1.959963985


@dataclass
class RawPrediction:
    """A forecast before it is shaped into the API response."""

    product_id: UUID
    product_sku: str
    product_name: str
    branch_id: UUID
    branch_code: str
    forecast_month: date
    predicted_quantity: int
    confidence_lower: int
    confidence_upper: int
    trend: str
    model_version: str
    source: ForecastSource  # "lstm" | "seasonal_naive"


class Predictor:
    """Batched inference over a model registry version."""

    def __init__(self, registry: ModelRegistry, repository: ForecastRepository) -> None:
        self._registry = registry
        self._repository = repository

    # ------------------------------------------------------------------
    def _build_model(self, artifact: SeriesArtifact) -> LSTMDemandModel:
        """Recreate the model architecture described by an artifact."""
        model = LSTMDemandModel(
            hidden_size=64,
            num_layers=2,
            dropout=0.1,
            horizon=artifact.horizon_months,
        )
        model.load_state_dict(artifact.state_dict)
        model.eval()
        return model

    # ------------------------------------------------------------------
    async def predict(
        self,
        *,
        product_ids: list[UUID] | None = None,
        branch_ids: list[UUID] | None = None,
        horizon_months: int = 3,
        model_version: str | None = None,
    ) -> list[RawPrediction]:
        """Produce forecasts for the requested scope."""
        version = model_version or self._registry.latest_version()
        if version is None:
            raise RuntimeError(
                "No trained models found. Run POST /train before requesting predictions."
            )

        artifacts = self._registry.load_version_artifacts(version)

        # Determine the lookback window. Prefer what the models were
        # trained with; fall back to the configured default when the
        # version contains no artifacts at all.
        if artifacts:
            lookback = max(a.lookback_months for a in artifacts.values())
        else:
            # A version with no artifacts means every series was skipped
            # for insufficient history. That is not an error — the
            # seasonal-naive fallback still produces a usable forecast, and
            # refusing to answer would leave the UI with no data at all.
            lookback = get_settings().lookback_months
            logger.warning(
                "Model version '%s' has no artifacts; serving seasonal-naive "
                "forecasts for every series.",
                version,
            )

        series = await self._repository.get_monthly_series(
            lookback_months=lookback,
            product_ids=product_ids,
            branch_ids=branch_ids,
        )

        if product_ids is not None:
            wanted = set(product_ids)
            series = {k: v for k, v in series.items() if k.product_id in wanted}
        if branch_ids is not None:
            wanted_b = set(branch_ids)
            series = {k: v for k, v in series.items() if k.branch_id in wanted_b}

        last_month = month_floor(date.today())
        predictions: list[RawPrediction] = []

        for key, points in series.items():
            # The registry keys artifacts by a plain (product_id, branch_id)
            # tuple, while `series` is keyed by the SeriesKey dataclass. The
            # two hash identically but are not equal, so the lookup has to
            # be done against the tuple form or every series would miss its
            # trained model and silently fall back to seasonal-naive.
            artifact = artifacts.get((key.product_id, key.branch_id))
            if artifact is None:
                # No trained model for this series — seasonal-naive fallback.
                predictions.extend(
                    self._seasonal_naive_predictions(
                        points, horizon_months=horizon_months, model_version=version
                    )
                )
                continue

            predictions.extend(
                self._lstm_predictions(
                    points,
                    artifact=artifact,
                    model_version=version,
                    last_month=last_month,
                    horizon_months=horizon_months,
                )
            )

        return predictions

    # ------------------------------------------------------------------
    def _lstm_predictions(
        self,
        points: list[MonthlySeriesPoint],
        *,
        artifact: SeriesArtifact,
        model_version: str,
        last_month: date,
        horizon_months: int,
    ) -> list[RawPrediction]:
        """Run the trained model for one series."""
        lookback = artifact.lookback_months
        # The model was trained on a window of `seq_len` months, which may be
        # shorter than the full history we keep. Use the most recent
        # `seq_len` months as the input window.
        seq_len = artifact.seq_len or lookback

        values = np.array([p.quantity for p in points], dtype=np.float32)
        if values.size < seq_len:
            # Pad at the FRONT: the months we are missing are the oldest
            # ones, and the model reads the window oldest-to-newest.
            values = np.pad(values, (seq_len - values.size, 0), constant_values=0.0)
        values = values[-seq_len:]

        # Apply the scaler frozen at training time. We deliberately do NOT
        # re-fit here — refitting on inference data would leak and would
        # also make historical predictions irreproducible.
        scaler = _FrozenScaler(
            center=artifact.scaler_center, scale=artifact.scaler_scale
        )
        scaled = scaler.transform(values)

        # Apply the input standardisation that was fitted during training.
        # Skipping this would create a train/serve mismatch: the model
        # expects windows centred around zero with unit variance.
        input_mean = artifact.input_mean
        input_std = artifact.input_std if abs(artifact.input_std) > 1e-8 else 1.0
        scaled = (scaled - input_mean) / input_std

        model = self._build_model(artifact)
        with torch.no_grad():
            x = torch.tensor(scaled, dtype=torch.float32).view(1, seq_len, 1)
            mu, sigma = model(x)

        mu_np = mu[0].numpy()
        sigma_np = sigma[0].numpy()

        results: list[RawPrediction] = []
        for step in range(horizon_months):
            idx = min(step, mu_np.size - 1)

            # Un-scale from log1p space back to units.
            pred = float(scaler.inverse_single(float(mu_np[idx])))
            spread = float(scaler.inverse_single(float(mu_np[idx] + sigma_np[idx]))) - pred

            # A negative lower bound is legitimate (the model is uncertain);
            # it is clamped at zero, not at the point forecast.
            lower = max(0.0, pred - Z_95 * abs(spread))
            upper = max(0.0, pred + Z_95 * abs(spread))

            month = add_months(last_month, step + 1)
            results.append(
                RawPrediction(
                    product_id=points[0].product_id,
                    product_sku=points[0].product_sku,
                    product_name=points[0].product_name,
                    branch_id=points[0].branch_id,
                    branch_code=points[0].branch_code,
                    forecast_month=month,
                    predicted_quantity=int(round(max(0.0, pred))),
                    confidence_lower=int(round(lower)),
                    confidence_upper=int(round(upper)),
                    trend="stable",  # filled in below across the horizon
                    model_version=model_version,
                    source="lstm",
                )
            )

        # Trend compares the first and last predicted month of the horizon.
        trend = classify_trend([r.predicted_quantity for r in results])
        for r in results:
            r.trend = trend

        return results

    def _seasonal_naive_predictions(
        self,
        points: list[MonthlySeriesPoint],
        *,
        horizon_months: int,
        model_version: str,
    ) -> list[RawPrediction]:
        """Fallback for series without a trained model."""
        preds, lowers, uppers = seasonal_naive_predict(points, horizon=horizon_months)
        trend = classify_trend(preds)

        last_month = month_floor(date.today())
        results = []
        for step in range(horizon_months):
            results.append(
                RawPrediction(
                    product_id=points[0].product_id,
                    product_sku=points[0].product_sku,
                    product_name=points[0].product_name,
                    branch_id=points[0].branch_id,
                    branch_code=points[0].branch_code,
                    forecast_month=add_months(last_month, step + 1),
                    predicted_quantity=preds[step],
                    confidence_lower=lowers[step],
                    confidence_upper=uppers[step],
                    trend=trend,
                    model_version=model_version,
                    source="seasonal_naive",
                )
            )
        return results


class _FrozenScaler:
    """Applies a scaler fitted at training time (median/IQR on log1p values)."""

    def __init__(self, center: float, scale: float) -> None:
        self.center = center
        self.scale = scale if abs(scale) > 1e-8 else 1.0

    def transform(self, values: np.ndarray) -> np.ndarray:
        masked = np.where(values > 0, values, np.nan).astype(np.float32)
        log_values = np.log1p(masked)
        scaled = (log_values - self.center) / self.scale
        scaled = np.nan_to_num(scaled, nan=0.0, posinf=10.0, neginf=-10.0)
        return np.clip(scaled, -10.0, 10.0).astype(np.float32)

    def inverse_single(self, x: float) -> float:
        """Invert the log1p + scaling transform for a single value."""
        log_value = x * self.scale + self.center
        return float(np.expm1(log_value))
