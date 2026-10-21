"""Tests for series construction, scaling and splitting."""

from datetime import date
from uuid import uuid4

import numpy as np
import pytest

from src.data.preprocessing import (
    build_sequences,
    build_train_val_sequences,
    classify_trend,
    fit_scaler,
    seasonal_naive_predict,
    series_to_array,
    smape,
    temporal_split,
    wape,
)
from src.data.repository import MonthlySeriesPoint, add_months, month_floor, month_start

PRODUCT_ID = uuid4()
BRANCH_ID = uuid4()


def make_series(values: list[int]) -> list[MonthlySeriesPoint]:
    """Build a dense monthly series starting Jan 2024."""
    start = date(2024, 1, 1)
    return [
        MonthlySeriesPoint(
            product_id=PRODUCT_ID,
            product_sku="SKU-1",
            product_name="Test Product",
            branch_id=BRANCH_ID,
            branch_code="DAV",
            month=add_months(start, i),
            quantity=q,
        )
        for i, q in enumerate(values)
    ]


class TestDateHelpers:
    def test_month_floor(self):
        assert month_floor(date(2025, 7, 19)) == date(2025, 7, 1)

    def test_add_months_wraps_year(self):
        assert add_months(date(2025, 11, 1), 3) == date(2026, 2, 1)
        assert add_months(date(2025, 1, 1), -1) == date(2024, 12, 1)

    def test_month_start_backwards(self):
        assert month_start(0, today=date(2025, 3, 15)) == date(2025, 3, 1)
        assert month_start(1, today=date(2025, 3, 15)) == date(2025, 2, 1)
        assert month_start(12, today=date(2025, 3, 15)) == date(2024, 3, 1)


class TestScaler:
    def test_fit_scaler_ignores_nan(self):
        values = np.array([1.0, np.nan, 3.0, 5.0])
        scaler = fit_scaler(values)
        assert scaler.center == pytest.approx(3.0)
        assert scaler.scale > 0

    def test_fit_scaler_handles_all_nan(self):
        scaler = fit_scaler(np.array([np.nan, np.nan]))
        assert scaler.center == 0.0
        assert scaler.scale == 1.0

    def test_fit_scaler_falls_back_when_iqr_zero(self):
        scaler = fit_scaler(np.array([2.0, 2.0, 2.0]))
        assert scaler.scale > 0


class TestSeriesToArray:
    def test_rejects_sparse_series(self):
        series = make_series([0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0])
        values, scaler, ok = series_to_array(series, lookback=12)
        assert ok is False
        assert values.shape == (12,)

    def test_accepts_dense_series(self):
        series = make_series([10, 12, 11, 15, 14, 16, 13, 18, 17, 20, 19, 21])
        values, scaler, ok = series_to_array(series, lookback=12)
        assert ok is True
        assert values.shape == (12,)
        assert values.dtype == np.float32
        assert np.isfinite(values).all()

    def test_pads_short_series(self):
        series = make_series([10, 12, 11])
        values, _, ok = series_to_array(series, lookback=12)
        assert values.shape == (12,)

    def test_min_nonzero_months_gate_is_configurable(self):
        """The number of months with activity drives trainability.

        A series with only 3 of 24 months of demand is rejected at the
        default bar, but accepted when the gate is lowered — the
        decision knob is configurable, not a hardcoded ratio.
        """
        series = make_series([5, 5, 5] + [0] * 21)  # 3 nonzero months of 24

        _, _, ok = series_to_array(series, lookback=24, min_nonzero_months=12)
        assert ok is False

        # The same sparsity passes when the bar drops to 3 nonzero months.
        _, _, ok = series_to_array(series, lookback=24, min_nonzero_months=3)
        assert ok is True

    def test_intermittent_series_with_enough_months_is_accepted(self):
        """A seasonal SKU that sells half the year is still trainable.

        The gate counts months with activity, so a 12-of-24-month series
        passes even though it is 'sparse' by ratio. This is the common
        real-world shape and must not be rejected.
        """
        series = make_series([10] * 12 + [0] * 12)
        _, _, ok = series_to_array(series, lookback=24, min_nonzero_months=12)
        assert ok is True

    def test_zero_quantity_series_is_rejected(self):
        """A series with no demand at all carries no signal."""
        series = make_series([0] * 24)
        values, _, ok = series_to_array(series, lookback=24, min_nonzero_months=1)
        assert ok is False


class TestBuildSequences:
    def test_shapes(self):
        values = np.arange(24, dtype=np.float32)
        X, Y = build_sequences(values, seq_len=6, horizon=3, train_end=20)
        assert X.shape == (20 - 6 + 1, 6)
        assert Y.shape == (20 - 6 + 1, 3)

    def test_target_is_strictly_in_the_future(self):
        values = np.arange(24, dtype=np.float32)
        X, Y = build_sequences(values, seq_len=6, horizon=3, train_end=20)
        # The last training window ends at index 19, so its targets are 20,21,22.
        assert Y[-1][0] == pytest.approx(20.0)

    def test_no_lookahead_leakage(self):
        """The value at index e must never appear as a target for window e."""
        values = np.arange(30, dtype=np.float32)
        seq_len, horizon = 8, 2
        X, Y = build_sequences(values, seq_len=seq_len, horizon=horizon, train_end=25)

        for i, (window, target) in enumerate(zip(X, Y, strict=True)):
            end = seq_len - 1 + i
            assert end not in target.tolist()
            assert window[-1] == pytest.approx(float(end))

    def test_empty_when_seq_len_exceeds_data(self):
        X, Y = build_sequences(np.arange(3, dtype=np.float32), seq_len=12, horizon=3, train_end=3)
        assert X.shape[0] == 0


class TestBuildTrainValSequences:
    def test_produces_both_sides(self):
        values = np.arange(24, dtype=np.float32)
        X_tr, Y_tr, X_va, Y_va = build_train_val_sequences(
            values, seq_len=6, horizon=3, val_ratio=0.2
        )
        assert X_tr.shape[0] > 0
        assert X_va.shape[0] > 0
        assert X_tr.shape[1] == 6
        assert Y_va.shape[1] == 3

    def test_no_target_overlap_between_train_and_val(self):
        """The central guarantee: a training target may never reappear as a
        validation target. This is what prevents optimistic accuracy numbers."""
        values = np.arange(40, dtype=np.float32)
        X_tr, Y_tr, X_va, Y_va = build_train_val_sequences(
            values, seq_len=8, horizon=3, val_ratio=0.2
        )

        train_targets = set(Y_tr.flatten().tolist())
        val_targets = set(Y_va.flatten().tolist())
        assert not (train_targets & val_targets), "train/val target leakage detected"

    def test_validation_targets_are_the_most_recent_months(self):
        values = np.arange(40, dtype=np.float32)
        _, _, _, Y_va = build_train_val_sequences(
            values, seq_len=8, horizon=3, val_ratio=0.2
        )
        # The final validation target should be near the end of the series.
        assert Y_va.max() == pytest.approx(39.0)

    def test_handles_too_little_data(self):
        values = np.arange(5, dtype=np.float32)
        X_tr, Y_tr, X_va, Y_va = build_train_val_sequences(
            values, seq_len=12, horizon=3
        )
        assert X_tr.shape[0] == 0
        assert X_va.shape[0] == 0


class TestTemporalSplit:
    def test_validation_is_the_tail(self):
        split = temporal_split(24, val_ratio=0.2)
        assert split == 19
        assert split > 24 // 2

    def test_split_never_leaves_no_training_data(self):
        assert temporal_split(12, val_ratio=0.9) >= 6


class TestSeasonalNaive:
    def test_uses_year_ago_value(self):
        series = make_series([0] * 12 + [50])
        preds, lowers, uppers = seasonal_naive_predict(series, horizon=1)
        assert preds[0] > 0
        assert lowers[0] <= preds[0] <= uppers[0]

    def test_empty_series_returns_zeros(self):
        preds, lowers, uppers = seasonal_naive_predict([], horizon=3)
        assert preds == [0, 0, 0]

    def test_bounds_contain_prediction(self):
        series = make_series(list(range(1, 25)))
        preds, lowers, uppers = seasonal_naive_predict(series, horizon=3)
        for p, lo, hi in zip(preds, lowers, uppers, strict=True):
            assert lo <= p <= hi
            assert lo >= 0

    def test_mean_is_over_active_months_not_dense_window(self):
        """The fallback mean must ignore zero months.

        A series of [10] * 12 + [0] * 12 has demand in 12 months, so
        the mean should be 10 — not 6 (the mean of the whole window).
        The year-ago slot here is a zero month, so the prediction falls
        back to that mean and the value is directly observable.
        """
        series = make_series([10] * 12 + [0] * 12)
        preds, lowers, uppers = seasonal_naive_predict(series, horizon=1)
        assert preds[0] == 10
        assert lowers[0] <= preds[0] <= uppers[0]


class TestClassifyTrend:
    def test_up(self):
        assert classify_trend([10, 20, 30]) == "up"

    def test_down(self):
        assert classify_trend([30, 20, 10]) == "down"

    def test_stable(self):
        assert classify_trend([10, 10, 10]) == "stable"

    def test_tolerance_band(self):
        # 4% change is within the 5% tolerance
        assert classify_trend([100, 102, 104]) == "stable"

    def test_single_value_is_stable(self):
        assert classify_trend([10]) == "stable"


class TestMetrics:
    def test_wape_zero(self):
        actual = np.array([10.0, 20.0])
        assert wape(actual, actual) == pytest.approx(0.0)

    def test_wape_handles_all_zero_actual(self):
        assert np.isnan(wape(np.array([0.0, 0.0]), np.array([1.0, 1.0])))

    def test_smape_zero(self):
        actual = np.array([10.0, 20.0, 30.0])
        assert smape(actual, actual) == pytest.approx(0.0)
