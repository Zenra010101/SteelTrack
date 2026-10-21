"""End-to-end training pipeline for per-series LSTM demand models.

For each (product, branch) series:

    1. Fetch the monthly quantity series from PostgreSQL.
    2. Skip the series if it has too little history.
    3. Scale, then build sliding (input, target) pairs.
    4. Train with Gaussian NLL, early stopping on validation NLL.
    5. Persist the model + frozen scaler to the model registry.
    6. Record accuracy metrics (WAPE / MAE / sMAPE) in the manifest.

The per-series approach keeps each model tiny (a few hundred KB) and
lets a single slow-moving SKU be retrained without disturbing the rest.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import UUID

import numpy as np
import torch
from torch.utils.data import DataLoader, TensorDataset

from src.config import get_settings
from src.data.db import get_session
from src.data.preprocessing import (
    build_train_val_sequences,
    mae,
    series_to_array,
    smape,
    wape,
)
from src.data.repository import ForecastRepository, SeriesKey
from src.models.lstm_model import LSTMDemandModel, gaussian_nll_loss
from src.models.model_registry import ModelRegistry, SeriesArtifact

logger = logging.getLogger(__name__)

# Default input window length in months. A 12-month window captures a full
# yearly cycle, which is the dominant seasonality signal for steel demand.
DEFAULT_SEQ_LEN = 12


@dataclass
class SeriesTrainingResult:
    """Outcome of training one series."""

    key: SeriesKey
    status: str  # "trained" | "skipped_insufficient_history" | "failed"
    metrics: dict = field(default_factory=dict)
    error: str | None = None


@dataclass
class TrainingSummary:
    """Aggregate result of a training run."""

    version: str
    trained: int = 0
    skipped: int = 0
    failed: int = 0
    results: list[SeriesTrainingResult] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "version": self.version,
            "trained": self.trained,
            "skipped": self.skipped,
            "failed": self.failed,
            "results": [
                {
                    "product_id": str(r.key.product_id),
                    "branch_id": str(r.key.branch_id),
                    "status": r.status,
                    "metrics": r.metrics,
                    "error": r.error,
                }
                for r in self.results
            ],
        }


# ---------------------------------------------------------------------------
# Single-series training
# ---------------------------------------------------------------------------


def train_single_series(
    values: np.ndarray,
    *,
    lookback: int,
    horizon: int,
    max_epochs: int,
    learning_rate: float,
    batch_size: int,
    seq_len: int | None = None,
    patience: int = 10,
    device: str = "cpu",
    unscale: callable | None = None,
    raw_values: np.ndarray | None = None,
) -> tuple[LSTMDemandModel, dict]:
    """Train one LSTM on a single scaled series.

    Args:
        values: The scaled monthly series (length `lookback`).
        lookback: Total months of history available.
        horizon: Months to predict.
        seq_len: Input sequence length. Defaults to `lookback` when the
            series is long enough, otherwise to the largest usable length.
            Keeping this separate from `lookback` is what allows a 24-month
            history to still yield training samples.
        max_epochs, learning_rate, batch_size: Optimisation settings.
        patience: Early-stopping patience in epochs.
        device: Torch device string.
        unscale: Optional callable that maps a scaled value back to real
            units. When supplied, the accuracy metrics are reported in
            units sold rather than in scaled space, which is what makes
            them interpretable by the operations team.
        raw_values: The original unscaled series. Required to compute the
            seasonal-naive baseline in real units — a zero-demand month is
            indistinguishable from a missing month once log-transformed.

    Returns:
        (model, metrics) where metrics contains training/validation loss
        and the accuracy figures computed on the validation window.
    """
    # The input sequence is a window over the history. It must be short
    # enough that the series can still supply several sliding windows plus
    # a full horizon of future targets for each. We therefore start from a
    # sensible default and shrink it until training samples actually exist.
    if seq_len is None:
        seq_len = min(DEFAULT_SEQ_LEN, len(values))

    # Shrink the window until the split yields at least one training sample.
    for candidate in range(seq_len, 1, -1):
        x_train, y_train, x_val, y_val = build_train_val_sequences(
            values, seq_len=candidate, horizon=horizon, val_ratio=0.2
        )
        if x_train.shape[0] > 0:
            seq_len = candidate
            break
    else:
        raise ValueError(
            f"Not enough observations to build a single training sample "
            f"(history={len(values)}, horizon={horizon})."
        )

    # Standardise the training window so the LSTM sees comparable scale.
    x_mean = x_train.mean()
    x_std = x_train.std()
    x_std = x_std if x_std > 1e-8 else 1.0

    x_train = (x_train - x_mean) / x_std
    x_val = (x_val - x_mean) / x_std if x_val.shape[0] else x_val

    train_ds = TensorDataset(
        torch.tensor(x_train, dtype=torch.float32).unsqueeze(-1),
        torch.tensor(y_train, dtype=torch.float32),
    )
    loader = DataLoader(train_ds, batch_size=min(batch_size, len(train_ds)), shuffle=True)

    model = LSTMDemandModel(hidden_size=64, num_layers=2, dropout=0.1, horizon=horizon).to(device)
    optimiser = torch.optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=1e-5)

    best_val_loss = float("inf")
    best_state: dict | None = None
    epochs_without_improvement = 0

    for epoch in range(max_epochs):
        model.train()
        epoch_loss = 0.0
        batches = 0

        for xb, yb in loader:
            xb = xb.to(device)
            yb = yb.to(device)

            optimiser.zero_grad()
            mu, sigma = model(xb)
            loss = gaussian_nll_loss(mu, sigma, yb)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimiser.step()

            epoch_loss += float(loss.item())
            batches += 1

        train_loss = epoch_loss / max(1, batches)

        # Validation
        val_loss = float("nan")
        if x_val.shape[0] > 0:
            model.eval()
            with torch.no_grad():
                xv = torch.tensor(x_val, dtype=torch.float32).unsqueeze(-1).to(device)
                yv = torch.tensor(y_val, dtype=torch.float32).to(device)
                mu_v, sigma_v = model(xv)
                val_loss = float(gaussian_nll_loss(mu_v, sigma_v, yv).item())

            if val_loss < best_val_loss - 1e-4:
                best_val_loss = val_loss
                best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
                epochs_without_improvement = 0
            else:
                epochs_without_improvement += 1
                if epochs_without_improvement >= patience:
                    logger.info("Early stopping at epoch %s (patience %s)", epoch, patience)
                    break
        else:
            # No validation window — keep the last weights.
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
            best_val_loss = train_loss

    if best_state is not None:
        model.load_state_dict(best_state)

    metrics = {
        "train_loss": train_loss,
        "val_loss": best_val_loss,
        "epochs": epoch + 1,
        "train_samples": int(x_train.shape[0]),
        "val_samples": int(x_val.shape[0]),
        "seq_len": int(seq_len),
        "input_mean": float(x_mean),
        "input_std": float(x_std),
    }

    # Accuracy on the validation window.
    if x_val.shape[0] > 0:
        model.eval()
        with torch.no_grad():
            xv = torch.tensor(x_val, dtype=torch.float32).unsqueeze(-1).to(device)
            mu_v, _ = model(xv)
        pred = mu_v.numpy()
        actual = y_val

        if unscale is not None:
            # Report in real units so the numbers mean "units sold".
            actual_units = np.clip(unscale(actual), 0, None)
            pred_units = np.clip(unscale(pred), 0, None)
            metrics["val_mae_units"] = mae(actual_units, pred_units)
            metrics["val_wape_units"] = wape(actual_units, pred_units)
            metrics["val_smape_units"] = smape(actual_units, pred_units)

            # Baseline computed on the SAME windows so the comparison is
            # apples-to-apples. A neural model that cannot beat "the same
            # month last year" is not worth shipping.
            if raw_values is not None:
                naive_units = _seasonal_naive_baseline(
                    raw_values, x_val.shape[1], horizon, x_val.shape[0], seq_len
                )
                metrics["val_wape_units_naive"] = wape(actual_units, naive_units)
                metrics["val_mae_units_naive"] = mae(actual_units, naive_units)

        metrics["val_mae"] = mae(actual, pred)
        metrics["val_wape"] = wape(actual, pred)
        metrics["val_smape"] = smape(actual, pred)

    return model, metrics


def _seasonal_naive_baseline(
    raw_values: np.ndarray,
    seq_len: int,
    horizon: int,
    n_windows: int,
    window_seq_len: int,
) -> np.ndarray:
    """Predict each validation target as the same calendar month one year earlier.

    Operates in raw units on the same window set as the LSTM, so the two
    WAPE figures are directly comparable.

    Args:
        raw_values: The original unscaled series.
        seq_len: Input window length used for training.
        horizon: Number of months predicted.
        n_windows: How many validation windows to produce predictions for.
        window_seq_len: Actual window width (may be shorter than `seq_len`
            if the sequence was shrunk to fit the available history).

    Returns:
        [n_windows, horizon] array of baseline predictions in units.
    """
    total = raw_values.size
    out = np.zeros((n_windows, horizon), dtype=np.float32)

    # The final validation window ends at the last index that still has
    # `horizon` real future targets.
    last_end = total - 1 - horizon

    for i in range(n_windows):
        # Window i ends at the i-th window end from the end of the series.
        end = last_end - (n_windows - 1 - i)
        if end < 0:
            continue

        window_start = max(0, end - window_seq_len + 1)
        window = raw_values[window_start : end + 1]

        for h in range(horizon):
            # The same calendar month, one year (12 months) before the target.
            target_index = end + 1 + h
            baseline_index = target_index - 12
            if 0 <= baseline_index < total:
                out[i, h] = raw_values[baseline_index]
            elif window.size:
                out[i, h] = window.mean()
            else:
                out[i, h] = 0.0

    return out


# ---------------------------------------------------------------------------
# Full pipeline
# ---------------------------------------------------------------------------


async def train_series(
    series: dict[SeriesKey, list],
    *,
    lookback: int,
    horizon: int,
    version: str,
    registry: ModelRegistry,
    product_ids: list[UUID] | None = None,
    branch_ids: list[UUID] | None = None,
) -> TrainingSummary:
    """Train and persist models for every eligible series."""
    settings = get_settings()
    summary = TrainingSummary(version=version)

    for key, points in series.items():
        if product_ids is not None and key.product_id not in set(product_ids):
            continue
        if branch_ids is not None and key.branch_id not in set(branch_ids):
            continue

        try:
            scaled, scaler, ok = series_to_array(
                points,
                lookback=lookback,
                min_nonzero_months=settings.min_history_months,
            )
            if not ok:
                nonzero = int(sum(1 for p in points if p.quantity > 0))
                summary.skipped += 1
                summary.results.append(
                    SeriesTrainingResult(
                        key=key,
                        status="skipped_insufficient_history",
                        metrics={
                            "nonzero_months": nonzero,
                            "required_months": settings.min_history_months,
                        },
                    )
                )
                continue

            def _unscale(arr, _scaler=scaler):
                """Map scaled log-space values back to unit counts."""
                return np.expm1(np.asarray(arr) * _scaler.scale + _scaler.center)

            raw_values = np.array([p.quantity for p in points], dtype=np.float32)[:lookback]

            model, metrics = train_single_series(
                scaled,
                lookback=lookback,
                horizon=horizon,
                max_epochs=settings.max_epochs,
                learning_rate=settings.learning_rate,
                batch_size=settings.batch_size,
                unscale=_unscale,
                raw_values=raw_values,
            )

            artifact = SeriesArtifact(
                product_id=key.product_id,
                branch_id=key.branch_id,
                state_dict={k: v.detach().cpu() for k, v in model.state_dict().items()},
                scaler_center=scaler.center,
                scaler_scale=scaler.scale,
                lookback_months=lookback,
                horizon_months=horizon,
                seq_len=int(metrics.get("seq_len", 12)),
                input_mean=float(metrics.get("input_mean", 0.0)),
                input_std=float(metrics.get("input_std", 1.0)),
                last_trained_at=datetime.now(UTC).isoformat(),
                metrics=metrics,
            )
            registry.save_artifact(version, artifact)

            summary.trained += 1
            summary.results.append(SeriesTrainingResult(key=key, status="trained", metrics=metrics))

        except Exception as exc:  # noqa: BLE001 — one bad series must not kill the run
            logger.exception("Training failed for %s", key)
            summary.failed += 1
            summary.results.append(
                SeriesTrainingResult(key=key, status="failed", error=str(exc))
            )

    return summary


async def retrain_all(
    *,
    product_ids: list[UUID] | None = None,
    branch_ids: list[UUID] | None = None,
    lookback: int | None = None,
    horizon: int | None = None,
) -> dict:
    """Full retraining run across the requested scope.

    Used by both the `POST /train` endpoint and the nightly scheduler.
    """
    settings = get_settings()
    lookback = lookback or settings.lookback_months
    horizon = horizon or settings.horizon_months

    registry = ModelRegistry(settings.model_dir)
    version = ModelRegistry.new_version()

    async with get_session() as session:
        repository = ForecastRepository(session)
        series = await repository.get_monthly_series(
            lookback_months=lookback,
            product_ids=product_ids,
            branch_ids=branch_ids,
        )

    summary = await train_series(
        series,
        lookback=lookback,
        horizon=horizon,
        version=version,
        registry=registry,
        product_ids=product_ids,
        branch_ids=branch_ids,
    )

    registry.write_manifest(
        version,
        {
            "version": version,
            "created_at": datetime.now(UTC).isoformat(),
            "lookback_months": lookback,
            "horizon_months": horizon,
            "product_ids": [str(p) for p in (product_ids or [])],
            "branch_ids": [str(b) for b in (branch_ids or [])],
            **summary.to_dict(),
        },
    )
    registry.set_latest(version)

    logger.info(
        "Training run %s complete — trained=%s skipped=%s failed=%s",
        version,
        summary.trained,
        summary.skipped,
        summary.failed,
    )
    return summary.to_dict()
