"""Series construction, scaling, and train/val splitting.

This is where raw monthly series (integer quantities with zero gaps)
become the shape PyTorch models expect: [Batch, SeqLen, 1].

Design notes
-------------
1. A robust median/IQR scaler is used rather than min-max, because steel
   sales often contain a few months of extreme demand spikes (project
   pull-outs, holidays) that would otherwise dominate a min-max range.
2. Series with fewer than `min_history_months` months of actual demand
   are excluded from training; the pipeline falls back to seasonal-naive.
3. The train/val split is **temporal** — only strictly past months are
   used as targets, so no future sales leak into training.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np

from src.data.repository import MonthlySeriesPoint


@dataclass(frozen=True)
class ScalingState:
    """Frozen scaler parameters needed to un-scale predictions."""

    center: float
    scale: float

    def inverse(self, x: np.ndarray) -> np.ndarray:
        return x * self.scale + self.center

    def inverse_single(self, x: float) -> float:
        return x * self.scale + self.center


def fit_scaler(values: np.ndarray) -> ScalingState:
    """Fit a median/IQR scaler over the observed (non-NaN) values."""
    observed = values[~np.isnan(values)]
    if observed.size == 0:
        return ScalingState(0.0, 1.0)

    center = float(np.median(observed))
    q75 = float(np.percentile(observed, 75))
    q25 = float(np.percentile(observed, 25))
    iqr = q75 - q25
    scale = iqr if iqr > 1e-8 else (float(np.std(observed)) or 1.0)
    return ScalingState(center=center, scale=float(scale))


def series_to_array(
    series: Sequence[MonthlySeriesPoint],
    *,
    lookback: int,
    min_nonzero_months: int = 12,
) -> tuple[np.ndarray, ScalingState, bool]:
    """Convert a dense monthly series into a model-ready array.

    Zero-demand months are treated as *missing* rather than as literal
    zeros: a branch that did not sell a SKU in a month is telling us
    "no signal", not "demand was exactly zero". Masking them lets the
    scaler learn from the months that actually had activity.

    A series is trainable when it has at least `min_nonzero_months`
    months of actual demand. The gate counts *months with activity*, not
    a ratio of the window: a series that sold steadily for 12 of the last
    24 months carries just as much signal as one that sold every month
    of a 12-month window, and rejecting it would throw away the most
    common real-world shape of a seasonal SKU.

    Returns:
        values  : [lookback] float32 array, log1p-transformed and scaled.
        scaler  : the fitted ScalingState (log-space).
        ok      : False when the series has too little history to train on.
    """
    raw = np.array([p.quantity for p in series], dtype=np.float32)[:lookback]
    if raw.size < lookback:
        raw = np.pad(raw, (0, lookback - raw.size), constant_values=0.0)

    nonzero_months = int((raw > 0).sum())
    if nonzero_months < min_nonzero_months:
        return np.zeros(lookback, dtype=np.float32), ScalingState(0.0, 1.0), False

    masked = np.where(raw > 0, raw, np.nan).astype(np.float32)
    log_values = np.log1p(masked)

    scaler = fit_scaler(log_values)
    scaled = (log_values - scaler.center) / scaler.scale
    scaled = np.nan_to_num(scaled, nan=0.0, posinf=10.0, neginf=-10.0)
    scaled = np.clip(scaled, -10.0, 10.0)

    return scaled.astype(np.float32), scaler, True


def build_sequences(
    values: np.ndarray,
    *,
    seq_len: int,
    horizon: int,
    train_end: int,
) -> tuple[np.ndarray, np.ndarray]:
    """Build sliding (input window, target) pairs from a scaled series.

    For every end index `e` in [seq_len-1, train_end):
      - input  = values[e-seq_len+1 .. e]   (shape [seq_len])
      - target = values[e+1 .. e+horizon]   (shape [horizon])

    `train_end` is the exclusive index bound on the *window end*, not on
    the target range. Callers that need a strict temporal separation
    between training and validation targets should use
    `build_train_val_sequences` instead.

    Returns:
        X : [N, seq_len] float32
        Y : [N, horizon]  float32
    """
    xs: list[np.ndarray] = []
    ys: list[np.ndarray] = []

    for end in range(seq_len - 1, train_end):
        window = values[end - seq_len + 1 : end + 1]
        target_slice = values[end + 1 : end + 1 + horizon]

        if target_slice.size < horizon:
            # Not enough future months yet — pad the remainder with zeros.
            target = np.zeros(horizon, dtype=np.float32)
            target[: target_slice.size] = target_slice
        else:
            target = target_slice.astype(np.float32)

        xs.append(window.astype(np.float32))
        ys.append(target)

    if not xs:
        return (
            np.empty((0, seq_len), dtype=np.float32),
            np.empty((0, horizon), dtype=np.float32),
        )

    return np.stack(xs), np.stack(ys)


def build_train_val_sequences(
    values: np.ndarray,
    *,
    seq_len: int,
    horizon: int,
    val_ratio: float = 0.2,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Split a series into training and validation windows with no target overlap.

    Window ends are indices into the observation array. A window ending at
    `e` has targets at `e+1 .. e+horizon`.

    The split is arranged so that:

      * the last **training** window ends at `split - horizon`, so its
        final target is index `split`;
      * the first **validation** window ends at `split`, so its first
        target is index `split + 1`.

    No target index is therefore ever shared between the two sets — the
    central guarantee that validation accuracy is not optimistic.

    The last usable window end is `total - 1 - horizon`, which is what
    guarantees a full set of future targets exists for every window.

    Returns:
        X_train, Y_train, X_val, Y_val
    """
    total = values.size

    empty_x = np.empty((0, seq_len), dtype=np.float32)
    empty_y = np.empty((0, horizon), dtype=np.float32)

    # The final window end that still has `horizon` real future targets.
    last_end = total - 1 - horizon
    if last_end < seq_len - 1:
        return empty_x, empty_y, empty_x, empty_y

    # How many window ends are available in total.
    available = last_end - (seq_len - 1) + 1

    # Reserve validation windows at the tail.
    val_count = max(1, int(round(available * val_ratio)))
    val_count = min(val_count, available - 1) if available > 1 else 1

    # First validation window end (inclusive).
    split = last_end - val_count + 1

    # Training windows must end at or before `split - horizon` so that the
    # final training target index is `split` and validation targets start
    # at `split + 1`.
    train_end_exclusive = split - horizon + 1
    if train_end_exclusive <= seq_len - 1:
        return empty_x, empty_y, empty_x, empty_y

    x_train, y_train = build_sequences(
        values, seq_len=seq_len, horizon=horizon, train_end=train_end_exclusive
    )

    # Build every window, then keep only those ending at or after `split`.
    x_val, y_val = build_sequences(
        values, seq_len=seq_len, horizon=horizon, train_end=last_end + 1
    )
    if x_val.shape[0] > 0:
        ends = np.arange(x_val.shape[0]) + (seq_len - 1)
        positions = np.flatnonzero(ends >= split)
        if positions.size:
            x_val = x_val[positions]
            y_val = y_val[positions]
        else:
            x_val = empty_x
            y_val = empty_y

    return x_train, y_train, x_val, y_val


def temporal_split(lookback: int, *, val_ratio: float = 0.2) -> int:
    """Return the index at which the validation era begins.

    Kept for callers that only need the cut point. The training/validation
    window assignment itself lives in `build_train_val_sequences`.
    """
    val_count = max(1, int(round(lookback * val_ratio)))
    return max(lookback // 2, lookback - val_count)


def seasonal_naive_predict(
    series: Sequence[MonthlySeriesPoint],
    *,
    horizon: int,
) -> tuple[list[int], list[int], list[int]]:
    """Fallback predictor for series with too little history.

    Seasonal naive: for horizon step h, predict the value observed
    12 months earlier when available; otherwise use the series mean.
    Returns (predictions, lower_bounds, upper_bounds).
    """
    values = np.array([p.quantity for p in series], dtype=np.float32)
    if values.size == 0:
        zeros = [0] * horizon
        return zeros, zeros, zeros

    # Average over the months that actually had demand. The dense window
    # is mostly zero months, and those are missing observations rather
    # than genuine zero demand — averaging them in would drag the
    # fallback down to a fraction of the real sales rate. (A branch that
    # sold 37 units across 2 active months is selling ~18/month, not
    # 37/24.)
    observed = values[values > 0]
    mean = float(observed.mean()) if observed.size else 0.0
    if mean <= 0:
        mean = 1.0

    predictions: list[int] = []
    lowers: list[int] = []
    uppers: list[int] = []

    for step in range(1, horizon + 1):
        # Index of the same calendar month one year earlier.
        candidate = values.size - 12 + (step - 1)
        if candidate >= 0:
            base = float(values[candidate])
        else:
            base = mean

        pred = base if base > 0 else mean
        sigma = 0.25 * mean  # coarse uncertainty band

        predictions.append(int(round(pred)))
        lowers.append(max(0, int(round(pred - 1.96 * sigma))))
        uppers.append(int(round(pred + 1.96 * sigma)))

    return predictions, lowers, uppers


def classify_trend(predictions: Sequence[int], *, tolerance_pct: float = 5.0) -> str:
    """Classify the direction of a forecast as up / down / stable."""
    if len(predictions) < 2:
        return "stable"

    first, last = float(predictions[0]), float(predictions[-1])
    if first <= 0:
        return "up" if last > 0 else "stable"

    change_pct = ((last - first) / first) * 100.0
    if change_pct > tolerance_pct:
        return "up"
    if change_pct < -tolerance_pct:
        return "down"
    return "stable"


def wape(actual: np.ndarray, predicted: np.ndarray) -> float:
    """Weighted absolute percentage error — the headline accuracy metric.

    Robust to zero-demand months, unlike MAPE.
    """
    denom = float(np.abs(actual).sum())
    if denom == 0:
        return float("nan")
    return float(np.abs(actual - predicted).sum() / denom)


def mae(actual: np.ndarray, predicted: np.ndarray) -> float:
    """Mean absolute error in scaled units."""
    if actual.size == 0:
        return float("nan")
    return float(np.abs(actual - predicted).mean())


def smape(actual: np.ndarray, predicted: np.ndarray) -> float:
    """Symmetric MAPE — percentage-style metric for reporting to stakeholders."""
    if actual.size == 0:
        return float("nan")
    denom = (np.abs(actual) + np.abs(predicted)) / 2.0
    mask = denom > 0
    if not mask.any():
        return float("nan")
    return float(np.mean(np.abs(actual[mask] - predicted[mask]) / denom[mask]) * 100.0)
