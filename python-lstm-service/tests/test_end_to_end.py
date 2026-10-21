"""End-to-end test: train a model on a synthetic series, save it, reload it, predict.

This exercises the whole path without touching the live database:
    series -> scale -> build sequences -> train LSTM -> save to registry
           -> load from registry -> predict -> confidence interval
"""

from datetime import date
from uuid import uuid4

import numpy as np
import pytest
import torch

from src.data.preprocessing import seasonal_naive_predict, series_to_array
from src.data.repository import MonthlySeriesPoint, add_months
from src.inference.predictor import _FrozenScaler
from src.models.model_registry import ModelRegistry, SeriesArtifact
from src.training.pipeline import train_single_series

PRODUCT_ID = uuid4()
BRANCH_ID = uuid4()
LOOKBACK = 24
HORIZON = 3
Z_95 = 1.959963985


def synthetic_series() -> list[MonthlySeriesPoint]:
    """24 months of demand with trend + yearly seasonality + noise."""
    rng = np.random.default_rng(42)
    start = date(2024, 1, 1)
    points = []

    for i in range(LOOKBACK):
        trend = 40 + i * 1.5
        seasonal = 12 * np.sin(2 * np.pi * i / 12)
        noise = rng.normal(0, 3)
        qty = max(0, int(round(trend + seasonal + noise)))

        points.append(
            MonthlySeriesPoint(
                product_id=PRODUCT_ID,
                product_sku="E2E-TEST-001",
                product_name="Synthetic Steel Product",
                branch_id=BRANCH_ID,
                branch_code="SMK",
                month=add_months(start, i),
                quantity=qty,
            )
        )

    return points


class TestEndToEnd:
    @pytest.fixture(scope="class")
    def trained(self):
        """Train once and reuse across the assertions below."""
        series = synthetic_series()
        scaled, scaler, ok = series_to_array(series, lookback=LOOKBACK)
        assert ok is True

        def unscale(arr):
            return np.expm1(np.asarray(arr) * scaler.scale + scaler.center)

        raw = np.array([p.quantity for p in series], dtype=np.float32)

        model, metrics = train_single_series(
            scaled,
            lookback=LOOKBACK,
            horizon=HORIZON,
            max_epochs=80,
            learning_rate=1e-3,
            batch_size=32,
            unscale=unscale,
            raw_values=raw,
        )
        return series, model, metrics, scaler

    def test_series_has_expected_shape(self, trained):
        series, _, _, _ = trained
        assert len(series) == LOOKBACK
        assert all(p.quantity >= 0 for p in series)
        # The synthetic series has an upward trend, so the tail exceeds the head.
        assert series[-1].quantity > series[0].quantity

    def test_training_produced_finite_metrics(self, trained):
        _, _, metrics, _ = trained
        assert np.isfinite(metrics["train_loss"])
        assert np.isfinite(metrics["val_loss"])
        assert metrics["train_samples"] > 0
        assert metrics["epochs"] >= 1

    def test_model_beats_naive_on_validation(self, trained):
        """The LSTM must be meaningfully more accurate than seasonal naive.

        This is the acceptance gate for the whole engine: a neural model
        that cannot beat "same month last year" is not worth shipping.
        The pipeline computes both figures on the same validation windows,
        in real units.
        """
        _, _, metrics, _ = trained

        assert "val_wape_units" in metrics, "unit-based metrics were not computed"
        assert "val_wape_units_naive" in metrics, "baseline was not computed"

        assert metrics["val_wape_units"] < metrics["val_wape_units_naive"], (
            f"LSTM WAPE {metrics['val_wape_units']:.3f} is not better than "
            f"seasonal naive {metrics['val_wape_units_naive']:.3f}"
        )

    def test_registry_round_trip(self, trained, tmp_path):
        series, model, metrics, scaler = trained

        registry = ModelRegistry(tmp_path)
        version = ModelRegistry.new_version()

        artifact = SeriesArtifact(
            product_id=PRODUCT_ID,
            branch_id=BRANCH_ID,
            state_dict={k: v.detach().cpu() for k, v in model.state_dict().items()},
            scaler_center=scaler.center,
            scaler_scale=scaler.scale,
            lookback_months=LOOKBACK,
            horizon_months=HORIZON,
            seq_len=int(metrics.get("seq_len", 12)),
            input_mean=float(metrics.get("input_mean", 0.0)),
            input_std=float(metrics.get("input_std", 1.0)),
            last_trained_at="2026-10-21T00:00:00Z",
            metrics=metrics,
        )
        registry.save_artifact(version, artifact)
        registry.write_manifest(version, {"version": version, "trained": 1})
        registry.set_latest(version)

        assert registry.latest_version() == version
        assert version in registry.list_versions()

        loaded = registry.load_artifact(version, PRODUCT_ID, BRANCH_ID)
        assert loaded is not None
        assert loaded.scaler_center == pytest.approx(scaler.center)
        assert loaded.horizon_months == HORIZON
        assert loaded.seq_len == metrics["seq_len"]
        assert loaded.input_mean == pytest.approx(metrics["input_mean"])
        assert loaded.input_std == pytest.approx(metrics["input_std"])

    def test_inference_produces_bounded_intervals(self, trained, tmp_path):
        """Predictions must be non-negative with the point inside the band."""
        series, model, metrics, scaler = trained

        registry = ModelRegistry(tmp_path)
        version = ModelRegistry.new_version()
        registry.save_artifact(
            version,
            SeriesArtifact(
                product_id=PRODUCT_ID,
                branch_id=BRANCH_ID,
                state_dict={k: v.detach().cpu() for k, v in model.state_dict().items()},
                scaler_center=scaler.center,
                scaler_scale=scaler.scale,
                lookback_months=LOOKBACK,
                horizon_months=HORIZON,
                seq_len=int(metrics.get("seq_len", 12)),
                input_mean=float(metrics.get("input_mean", 0.0)),
                input_std=float(metrics.get("input_std", 1.0)),
                last_trained_at="2026-10-21T00:00:00Z",
                metrics=metrics,
            ),
        )

        loaded = registry.load_artifact(version, PRODUCT_ID, BRANCH_ID)
        seq_len = loaded.seq_len
        values = np.array([p.quantity for p in series], dtype=np.float32)[-seq_len:]

        fs = _FrozenScaler(center=loaded.scaler_center, scale=loaded.scaler_scale)
        scaled_in = fs.transform(values)
        scaled_in = (scaled_in - loaded.input_mean) / (
            loaded.input_std if abs(loaded.input_std) > 1e-8 else 1.0
        )

        m = model
        m.load_state_dict(loaded.state_dict)
        m.eval()
        with torch.no_grad():
            x = torch.tensor(scaled_in, dtype=torch.float32).view(1, seq_len, 1)
            mu, sigma = m(x)

        for step in range(HORIZON):
            mu_v = float(mu[0][step])
            sigma_v = float(sigma[0][step])
            pred = fs.inverse_single(mu_v)
            spread = abs(fs.inverse_single(mu_v + sigma_v) - pred)

            lower = max(0.0, pred - Z_95 * spread)
            upper = max(0.0, pred + Z_95 * spread)

            assert pred >= 0
            assert lower <= pred <= upper
            assert sigma_v > 0, "sigma must be strictly positive"

    def test_seasonal_naive_baseline_also_bounded(self, trained):
        series, _, _, _ = trained
        preds, lowers, uppers = seasonal_naive_predict(series, horizon=HORIZON)
        assert len(preds) == len(lowers) == len(uppers) == HORIZON
        for p, lo, hi in zip(preds, lowers, uppers, strict=True):
            assert lo <= p <= hi
