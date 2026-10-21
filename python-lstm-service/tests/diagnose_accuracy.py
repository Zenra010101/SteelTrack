"""Diagnostic: compare LSTM against the seasonal-naive baseline in real units.

The metrics reported by the training pipeline are computed in the scaled
(log1p) space. This script un-scales them so the numbers are directly
interpretable as units sold, and compares the LSTM head-to-head with the
seasonal-naive baseline on the *same* validation window.
"""

import sys
from pathlib import Path
from types import SimpleNamespace

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.data.preprocessing import (  # noqa: E402
    build_train_val_sequences,
    fit_scaler,
    seasonal_naive_predict,
)
from src.training.pipeline import train_single_series  # noqa: E402


def make_values(n: int, seed: int = 42) -> np.ndarray:
    """n months of trend + yearly seasonality + noise."""
    rng = np.random.default_rng(seed)
    idx = np.arange(n)
    trend = 40 + idx * 1.5
    seasonal = 12 * np.sin(2 * np.pi * idx / 12)
    noise = rng.normal(0, 3)
    return np.maximum(0, np.round(trend + seasonal + noise))


def wape(actual: np.ndarray, predicted: np.ndarray) -> float:
    denom = np.abs(actual).sum()
    return float(np.abs(actual - predicted).sum() / denom) if denom else float("nan")


def run(history_months: int, seq_len: int, horizon: int = 3) -> dict:
    """Train and evaluate on one configuration."""
    raw = make_values(history_months)

    # Scale exactly as the pipeline does.
    masked = np.where(raw > 0, raw, np.nan).astype(np.float32)
    log_values = np.log1p(masked)
    scaler = fit_scaler(log_values)
    scaled = np.nan_to_num((log_values - scaler.center) / scaler.scale, nan=0.0)
    scaled = np.clip(scaled, -10, 10).astype(np.float32)

    model, metrics = train_single_series(
        scaled,
        lookback=history_months,
        horizon=horizon,
        max_epochs=80,
        learning_rate=1e-3,
        batch_size=32,
        seq_len=seq_len,
    )

    # Rebuild the exact same train/val split to evaluate in real units.
    x_tr, y_tr, x_va, y_va = build_train_val_sequences(
        scaled, seq_len=seq_len, horizon=horizon, val_ratio=0.2
    )

    import torch

    x_mean = x_tr.mean()
    x_std = x_tr.std() or 1.0
    x_va_n = (x_va - x_mean) / x_std

    model.eval()
    with torch.no_grad():
        pred_scaled = model(
            torch.tensor(x_va_n, dtype=torch.float32).unsqueeze(-1)
        )[0].numpy()

    # Un-scale predictions and targets back to units.
    def unscale(v):
        return np.expm1(v * scaler.scale + scaler.center)

    actual_units = unscale(y_va)
    pred_units = np.clip(unscale(pred_scaled), 0, None)

    # Seasonal-naive on the same validation targets.
    naive_preds = []
    for i in range(x_va.shape[0]):
        window = raw[i : i + seq_len]
        if window.size == 0:
            naive_preds.append(np.zeros(horizon))
            continue
        p, _, _ = seasonal_naive_predict(
            [
                SimpleNamespace(quantity=int(q))
                for q in window
            ],
            horizon=horizon,
        )
        naive_preds.append(p)
    naive_units = np.array(naive_preds, dtype=np.float32)

    return {
        "history": history_months,
        "seq_len": seq_len,
        "train_windows": int(x_tr.shape[0]),
        "val_windows": int(x_va.shape[0]),
        "epochs": metrics["epochs"],
        "lstm_wape": wape(actual_units, pred_units),
        "naive_wape": wape(actual_units, naive_units),
        "lstm_mae": float(np.abs(actual_units - pred_units).mean()),
        "naive_mae": float(np.abs(actual_units - naive_units).mean()),
        "val_loss": metrics["val_loss"],
    }


def main() -> None:
    print("=" * 78)
    print("LSTM vs SEASONAL-NAIVE  (metrics in real units)")
    print("=" * 78)
    print(
        f"{'hist':>5} {'seq':>4} {'tr_win':>7} {'va_win':>7} "
        f"{'LSTM WAPE':>10} {'naive WAPE':>11} {'winner':>8}"
    )
    print("-" * 78)

    for history in (24, 30, 36, 48):
        for seq in (6, 12):
            if seq >= history - 4:
                continue
            r = run(history, seq)
            winner = "LSTM" if r["lstm_wape"] < r["naive_wape"] else "naive"
            print(
                f"{r['history']:>5} {r['seq_len']:>4} {r['train_windows']:>7} "
                f"{r['val_windows']:>7} {r['lstm_wape']:>10.3f} "
                f"{r['naive_wape']:>11.3f} {winner:>8}"
            )

    print("\n" + "=" * 78)


if __name__ == "__main__":
    main()
