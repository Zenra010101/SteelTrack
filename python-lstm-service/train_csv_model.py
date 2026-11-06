"""Standalone production training script for the SteelTrack Python LSTM Model.

Feeds the historical withdrawal CSV files from CSV_for_LSTM (2017-2026, 680k+ transactions),
trains:
1. A Global Shared LSTM Model across all steel products and branches (saved as global__all.pt)
2. Per-series fine-tuned PyTorch LSTM models for all catalog products and active ItemCodes
Evaluates out-of-sample validation accuracy (WAPE / MAE / sMAPE) and persists versioned
model artifacts to python-lstm-service/models/.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

import numpy as np
import torch
from torch.utils.data import DataLoader, TensorDataset

# Ensure python-lstm-service is on path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from src.data.csv_dataset import (
    ALL_BRANCH_IDS,
    BRANCH_CODES,
    BRANCH_NAMES,
    build_dense_series_dict,
    find_csv_dir,
    get_product_to_item_mapping,
    load_and_preprocess_csv,
    load_catalog_products,
)
from src.data.preprocessing import (
    build_train_val_sequences,
    fit_scaler,
    mae,
    smape,
    wape,
)
from src.models.lstm_model import LSTMDemandModel, gaussian_nll_loss
from src.models.model_registry import ModelRegistry, SeriesArtifact

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("train_csv_model")


def train_single_series(
    raw_values: np.ndarray,
    *,
    seq_len: int = 12,
    horizon: int = 3,
    max_epochs: int = 25,
    learning_rate: float = 1e-3,
    patience: int = 8,
    init_state_dict: dict | None = None,
) -> tuple[LSTMDemandModel, dict, float, float] | None:
    """Train an LSTM on a single dense time series array."""
    log_vals = np.log1p(raw_values)
    scaler = fit_scaler(log_vals)

    scaled = (log_vals - scaler.center) / scaler.scale
    scaled = np.nan_to_num(scaled, nan=0.0).clip(-10.0, 10.0)

    # Build sequences with temporal train/val split (80% train, 20% val)
    x_tr, y_tr, x_val, y_val = build_train_val_sequences(
        scaled, seq_len=seq_len, horizon=horizon, val_ratio=0.2
    )

    if x_tr.shape[0] < 4:
        return None

    model = LSTMDemandModel(
        input_size=1, hidden_size=64, num_layers=2, dropout=0.1, horizon=horizon
    )
    if init_state_dict is not None:
        try:
            model.load_state_dict(init_state_dict)
        except Exception:
            pass

    optimizer = torch.optim.AdamW(
        model.parameters(), lr=learning_rate, weight_decay=1e-4
    )

    x_tr_t = torch.tensor(x_tr, dtype=torch.float32).unsqueeze(-1)
    y_tr_t = torch.tensor(y_tr, dtype=torch.float32)

    best_loss = float("inf")
    best_state = None
    no_improve = 0
    actual_epochs = 0

    has_val = x_val.shape[0] > 0
    if has_val:
        x_val_t = torch.tensor(x_val, dtype=torch.float32).unsqueeze(-1)
        y_val_t = torch.tensor(y_val, dtype=torch.float32)

    for epoch in range(max_epochs):
        actual_epochs = epoch + 1
        model.train()
        optimizer.zero_grad()
        mu, sigma = model(x_tr_t)
        loss = gaussian_nll_loss(mu, sigma, y_tr_t)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()

        # Validation check
        if has_val:
            model.eval()
            with torch.no_grad():
                mu_v, sig_v = model(x_val_t)
                v_loss = gaussian_nll_loss(mu_v, sig_v, y_val_t).item()

            if v_loss < best_loss - 1e-4:
                best_loss = v_loss
                best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}
                no_improve = 0
            else:
                no_improve += 1
                if no_improve >= patience:
                    break
        else:
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}
            best_loss = loss.item()

    if best_state is not None:
        model.load_state_dict(best_state)

    metrics = {
        "epochs": actual_epochs,
        "train_nll": float(loss.item()),
        "val_nll": float(best_loss),
        "train_samples": int(x_tr.shape[0]),
        "val_samples": int(x_val.shape[0]),
    }

    if has_val:
        model.eval()
        with torch.no_grad():
            mu_v, _ = model(x_val_t)
            pred_mu = mu_v.numpy()
            pred_units = np.clip(
                np.expm1(pred_mu * scaler.scale + scaler.center), 0, None
            )
            actual_units = np.clip(
                np.expm1(y_val * scaler.scale + scaler.center), 0, None
            )

            metrics["val_wape"] = float(wape(actual_units, pred_units))
            metrics["val_mae"] = float(mae(actual_units, pred_units))
            metrics["val_smape"] = float(smape(actual_units, pred_units))

    return model, metrics, scaler.center, scaler.scale


def train_global_model(
    all_series: dict,
    *,
    seq_len: int = 12,
    horizon: int = 3,
    max_epochs: int = 20,
) -> tuple[LSTMDemandModel, dict, float, float]:
    """Train a Global Shared LSTM on sequences pooled across all steel series."""
    logger.info("Training Global Shared LSTM Backbone across all steel items...")
    xs = []
    ys = []
    centers = []
    scales = []

    for pts in all_series.values():
        nonzero = sum(1 for p in pts if p.quantity > 0)
        if nonzero < 12:
            continue
        raw = np.array([p.quantity for p in pts], dtype=np.float32)
        log_v = np.log1p(raw)
        scaler = fit_scaler(log_v)
        scaled = (log_v - scaler.center) / scaler.scale
        scaled = np.nan_to_num(scaled, nan=0.0).clip(-10.0, 10.0)

        x_t, y_t, _, _ = build_train_val_sequences(scaled, seq_len=seq_len, horizon=horizon, val_ratio=0.1)
        if x_t.shape[0] > 0:
            xs.append(x_t)
            ys.append(y_t)
            centers.append(scaler.center)
            scales.append(scaler.scale)

    x_all = np.concatenate(xs, axis=0)
    y_all = np.concatenate(ys, axis=0)
    logger.info("Global training dataset: %d pooled sequence windows.", x_all.shape[0])

    dataset = TensorDataset(
        torch.tensor(x_all, dtype=torch.float32).unsqueeze(-1),
        torch.tensor(y_all, dtype=torch.float32),
    )
    loader = DataLoader(dataset, batch_size=64, shuffle=True)

    model = LSTMDemandModel(input_size=1, hidden_size=64, num_layers=2, dropout=0.15, horizon=horizon)
    optimizer = torch.optim.AdamW(model.parameters(), lr=2e-3, weight_decay=1e-4)

    for epoch in range(max_epochs):
        model.train()
        total_loss = 0.0
        for batch_x, batch_y in loader:
            optimizer.zero_grad()
            mu, sigma = model(batch_x)
            loss = gaussian_nll_loss(mu, sigma, batch_y)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            total_loss += loss.item()

        if (epoch + 1) % 5 == 0 or epoch == max_epochs - 1:
            logger.info("  Global LSTM Epoch [%d/%d] - Mean Loss: %.4f", epoch + 1, max_epochs, total_loss / len(loader))

    avg_center = float(np.median(centers)) if centers else 0.0
    avg_scale = float(np.median(scales)) if scales else 1.0
    metrics = {
        "epochs": max_epochs,
        "pooled_windows": int(x_all.shape[0]),
        "mean_loss": total_loss / len(loader),
    }
    return model, metrics, avg_center, avg_scale


def main() -> None:
    parser = argparse.ArgumentParser(description="Train LSTM models from CSV data")
    parser.add_argument("--epochs", type=int, default=25, help="Max training epochs per series")
    parser.add_argument("--limit", type=int, default=500, help="Max series to train (default: 500)")
    parser.add_argument("--min-history", type=int, default=12, help="Min nonzero months required")
    parser.add_argument("--lookback", type=int, default=24, help="Lookback window")
    parser.add_argument("--seq-len", type=int, default=12, help="Sequence window length")
    parser.add_argument("--horizon", type=int, default=3, help="Forecast horizon")
    parser.add_argument("--model-dir", type=str, default=str(BASE_DIR / "models"), help="Model storage directory")
    args = parser.parse_args()

    csv_dir = find_csv_dir()
    logger.info("=== SteelTrack Python LSTM Model Training ===")
    logger.info("CSV Source: %s", csv_dir)
    logger.info("Epochs: %d, SeqLen: %d, Horizon: %d, Limit: %s", args.epochs, args.seq_len, args.horizon, args.limit)

    t_start = time.time()

    # 1. Load and aggregate CSV dataset
    logger.info("Loading and aggregating CSV withdrawal data...")
    df = load_and_preprocess_csv(csv_dir)
    series_dict = build_dense_series_dict(df)
    logger.info("Total monthly points: %d across %d series.", len(df), len(series_dict))

    # 2. Load catalog products and create mapping
    catalog = load_catalog_products()
    prod_lookup = {p["Id"]: p for p in catalog if p.get("Id")}
    prod_to_item, item_to_prod = get_product_to_item_mapping(df)
    logger.info("Loaded %d catalog products, mapped %d to CSV items.", len(catalog), len(prod_to_item))

    # 3. Prepare registry and version
    registry = ModelRegistry(args.model_dir)
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    version = f"v0.2.0-csv-{stamp}"
    version_dir = registry.version_dir(version)
    version_dir.mkdir(parents=True, exist_ok=True)
    logger.info("Target model version: %s (in %s)", version, version_dir)

    # 4. Train Global Shared LSTM Backbone
    global_model, global_metrics, g_center, g_scale = train_global_model(
        series_dict, seq_len=args.seq_len, horizon=args.horizon, max_epochs=15
    )
    global_artifact = SeriesArtifact(
        product_id="global",
        branch_id="all",
        state_dict={k: v.detach().cpu() for k, v in global_model.state_dict().items()},
        scaler_center=g_center,
        scaler_scale=g_scale,
        lookback_months=args.lookback,
        horizon_months=args.horizon,
        seq_len=args.seq_len,
        last_trained_at=datetime.now(UTC).isoformat(),
        metrics=global_metrics,
    )
    registry.save_artifact(version, global_artifact)
    logger.info("Global Shared LSTM Model saved as global__all.pt")

    # 5. Build queue of per-series models
    training_queue = []

    # A. All catalog products mapped to CSV items
    for pid, item_code in prod_to_item.items():
        for bid in ALL_BRANCH_IDS:
            pts = series_dict.get((item_code, bid))
            if pts:
                nonzero = sum(1 for p in pts if p.quantity > 0)
                if nonzero >= args.min_history:
                    training_queue.append((pid, bid, item_code, pts, nonzero))

    # B. Top direct ItemCodes
    for (item_code, bid), pts in series_dict.items():
        nonzero = sum(1 for p in pts if p.quantity > 0)
        if nonzero >= args.min_history:
            training_queue.append((item_code, bid, item_code, pts, nonzero))

    # Deduplicate and sort by nonzero months descending
    seen = set()
    deduped_queue = []
    for pid, bid, item, pts, nz in training_queue:
        pair_key = (str(pid), str(bid))
        if pair_key not in seen:
            seen.add(pair_key)
            deduped_queue.append((pid, bid, item, pts, nz))

    deduped_queue.sort(key=lambda x: x[4], reverse=True)

    if args.limit and len(deduped_queue) > args.limit:
        logger.info("Limiting training run to top %d series (out of %d eligible).", args.limit, len(deduped_queue))
        deduped_queue = deduped_queue[: args.limit]
    else:
        logger.info("Training all %d eligible series.", len(deduped_queue))

    # 6. Train loop with transfer weights from Global Model
    global_weights = {k: v.detach().cpu().clone() for k, v in global_model.state_dict().items()}
    trained_count = 0
    skipped_count = 0
    failed_count = 0
    results = []
    wapes = []
    maes = []

    for idx, (pid, bid, item_code, pts, nonzero) in enumerate(deduped_queue):
        bname = BRANCH_NAMES.get(bid if isinstance(bid, UUID) else UUID(str(bid)), "Branch")
        raw_vals = np.array([p.quantity for p in pts], dtype=np.float32)

        try:
            res = train_single_series(
                raw_vals,
                seq_len=args.seq_len,
                horizon=args.horizon,
                max_epochs=args.epochs,
                init_state_dict=global_weights,
            )

            if res is None:
                skipped_count += 1
                continue

            model, metrics, s_center, s_scale = res

            artifact = SeriesArtifact(
                product_id=pid,
                branch_id=bid,
                state_dict={k: v.detach().cpu() for k, v in model.state_dict().items()},
                scaler_center=float(s_center),
                scaler_scale=float(s_scale),
                lookback_months=args.lookback,
                horizon_months=args.horizon,
                seq_len=args.seq_len,
                last_trained_at=datetime.now(UTC).isoformat(),
                metrics=metrics,
            )

            registry.save_artifact(version, artifact)
            trained_count += 1

            if "val_wape" in metrics:
                wapes.append(metrics["val_wape"])
            if "val_mae" in metrics:
                maes.append(metrics["val_mae"])

            results.append({
                "product_id": str(pid),
                "branch_id": str(bid),
                "item_code": item_code,
                "status": "trained",
                "metrics": metrics,
            })

            if (idx + 1) % 50 == 0 or idx == len(deduped_queue) - 1:
                cur_wape = np.mean(wapes) if wapes else 0.0
                cur_mae = np.mean(maes) if maes else 0.0
                logger.info(
                    "Progress [%d/%d]: Trained %d models. Avg WAPE: %.3f, Avg MAE: %.1f",
                    idx + 1,
                    len(deduped_queue),
                    trained_count,
                    cur_wape,
                    cur_mae,
                )

        except Exception as exc:
            failed_count += 1
            logger.warning("Failed training series %s @ %s: %s", pid, bid, exc)

    # 7. Write manifest and set latest
    manifest = {
        "version": version,
        "created_at": datetime.now(UTC).isoformat(),
        "lookback_months": args.lookback,
        "horizon_months": args.horizon,
        "dataset_source": "CSV_for_LSTM (withdrawal & withdrawalsummary 2017-2026, 680k+ transactions)",
        "global_model": True,
        "trained": trained_count,
        "skipped": skipped_count,
        "failed": failed_count,
        "mean_val_wape": float(np.mean(wapes)) if wapes else 0.0,
        "mean_val_mae": float(np.mean(maes)) if maes else 0.0,
        "results": results,
    }

    registry.write_manifest(version, manifest)
    registry.set_latest(version)

    elapsed = time.time() - t_start
    logger.info("============================================================")
    logger.info("TRAINING COMPLETE in %.1fs!", elapsed)
    logger.info("Model Version: %s", version)
    logger.info("Trained: %d series + 1 Global Backbone Model", trained_count)
    logger.info("Mean Validation WAPE: %.3f", manifest["mean_val_wape"])
    logger.info("Mean Validation MAE: %.1f units", manifest["mean_val_mae"])
    logger.info("Registry updated: %s is now latest!", version)
    logger.info("============================================================")


if __name__ == "__main__":
    main()
