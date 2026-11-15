"""Training script for SteelTrack TensorFlow/Keras LSTM Demand Forecasting Model."""

from __future__ import annotations

import json
import logging
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import keras
import numpy as np

from ml.dataset import (
    ScalerMeta,
    build_dense_series,
    create_training_sequences,
    load_products_catalog,
    load_raw_monthly_points,
    map_products_to_series,
)
from ml.model import build_lstm_model

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("TrainKerasLSTM")


def train():
    logger.info("=== Starting TensorFlow / Keras 3 LSTM Training Pipeline ===")
    t0 = time.time()

    # 1. Load data
    logger.info("1. Loading products catalog and monthly sales cache...")
    products = load_products_catalog("ml/products_catalog.json")
    raw_points = load_raw_monthly_points("CSV_for_LSTM/monthly_series_cache.sqlite")
    logger.info("Loaded %d products and %d raw monthly points.", len(products), len(raw_points))

    # 2. Build dense monthly series
    logger.info("2. Constructing dense monthly series...")
    raw_series = build_dense_series(raw_points)
    product_series = map_products_to_series(products, raw_series)
    logger.info("Aligned %d (product, branch) series.", len(product_series))

    # 3. Create sequences
    logger.info("3. Generating sliding sequences (lookback=12, horizon=3)...")
    X_train, y_train, X_val, y_val, scaler = create_training_sequences(
        product_series, lookback=12, horizon=3, val_ratio=0.2
    )
    logger.info("X_train shape: %s, y_train shape: %s", X_train.shape, y_train.shape)
    logger.info("X_val shape: %s, y_val shape: %s", X_val.shape, y_val.shape)

    # 4. Build Model
    logger.info("4. Instantiating Keras LSTM model (keras.layers.LSTM)...")
    model = build_lstm_model(lookback=12, horizon=3, hidden_units=(64, 32), dropout=0.1)
    model.summary(print_fn=logger.info)

    # 5. Callbacks
    callbacks = [
        keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=8,
            restore_best_weights=True,
            verbose=1,
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=4,
            min_lr=1e-5,
            verbose=1,
        ),
    ]

    # 6. Fit
    logger.info("5. Training Keras LSTM model...")
    history = model.fit(
        X_train,
        y_train,
        validation_data=(X_val, y_val),
        epochs=40,
        batch_size=64,
        callbacks=callbacks,
        verbose=1,
    )

    # 7. Evaluate on validation set
    logger.info("6. Evaluating accuracy on validation windows...")
    val_preds_scaled = model.predict(X_val, verbose=0)

    # Invert scaling to real steel unit quantities
    actual_units = scaler.inverse(y_val)
    pred_units = scaler.inverse(val_preds_scaled)

    val_mae = float(np.mean(np.abs(actual_units - pred_units)))
    val_rmse = float(np.sqrt(np.mean((actual_units - pred_units) ** 2)))
    denom = float(np.sum(actual_units))
    val_wape = float(np.sum(np.abs(actual_units - pred_units)) / (denom if denom > 0 else 1.0))

    logger.info("Validation Results -> MAE: %.2f units | RMSE: %.2f units | WAPE: %.2f%%", val_mae, val_rmse, val_wape * 100)

    # 8. Save Artifacts
    models_dir = Path("models")
    models_dir.mkdir(parents=True, exist_ok=True)

    model_path = models_dir / "steeltrack_keras_lstm.keras"
    model.save(model_path)
    logger.info("Saved trained Keras model to: %s", model_path)

    # Save scaler
    scaler_path = models_dir / "scaler.json"
    with open(scaler_path, "w", encoding="utf-8") as f:
        json.dump({"mean": scaler.mean, "std": scaler.std}, f, indent=2)
    logger.info("Saved scaler parameters to: %s", scaler_path)

    # Save pre-computed recent windows for all products & branches (for fast sub-millisecond inference)
    recent_history: dict[str, list[float]] = {}
    for (pid, bid), arr in product_series.items():
        # Keep the latest 12 months
        recent = arr[-12:].tolist() if len(arr) >= 12 else np.pad(arr, (12 - len(arr), 0)).tolist()
        recent_history[f"{pid}__{bid}"] = recent

    history_path = models_dir / "recent_history.json"
    with open(history_path, "w", encoding="utf-8") as f:
        json.dump(recent_history, f)
    logger.info("Saved recent series history for all %d series to: %s", len(recent_history), history_path)

    # Save manifest
    version = f"v1.0.0-keras-lstm-{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}"
    manifest = {
        "version": version,
        "framework": "TensorFlow 2.21 / Keras 3.15",
        "created_at": datetime.now(UTC).isoformat(),
        "total_series": len(product_series),
        "total_products": len(products),
        "epochs_trained": len(history.history["loss"]),
        "train_loss": float(history.history["loss"][-1]),
        "val_loss": float(history.history["val_loss"][-1]),
        "metrics": {
            "val_mae_units": round(val_mae, 2),
            "val_rmse_units": round(val_rmse, 2),
            "val_wape_percent": round(val_wape * 100, 2),
        },
        "training_time_seconds": round(time.time() - t0, 2),
    }

    manifest_path = models_dir / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    logger.info("Saved training manifest to: %s", manifest_path)

    logger.info("=== Training Complete in %.2fs! Version: %s ===", time.time() - t0, version)
    return manifest


if __name__ == "__main__":
    train()
