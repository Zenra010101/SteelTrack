"""Data loading, series alignment, scaling, and sequence generation for Keras LSTM."""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from uuid import UUID

import numpy as np

BRANCH_DAVAO = "11111111-1111-1111-1111-111111111101"
BRANCH_CAGAYAN = "11111111-1111-1111-1111-111111111102"
BRANCH_CEBU = "11111111-1111-1111-1111-111111111103"
BRANCH_MANDAUE = "11111111-1111-1111-1111-111111111104"

ALL_BRANCH_IDS = [BRANCH_DAVAO, BRANCH_CAGAYAN, BRANCH_CEBU, BRANCH_MANDAUE]

BRANCH_INFO = {
    BRANCH_DAVAO: {"code": "BR1", "name": "Davao"},
    BRANCH_CAGAYAN: {"code": "BR2", "name": "Cagayan De Oro"},
    BRANCH_CEBU: {"code": "BR3", "name": "Cebu"},
    BRANCH_MANDAUE: {"code": "BR4", "name": "Mandaue"},
}


@dataclass
class ScalerMeta:
    mean: float
    std: float

    def transform(self, values: np.ndarray) -> np.ndarray:
        log_v = np.log1p(np.maximum(0.0, values))
        return (log_v - self.mean) / self.std

    def inverse(self, scaled: np.ndarray) -> np.ndarray:
        log_v = scaled * self.std + self.mean
        log_v = np.clip(log_v, 0.0, 50.0)
        return np.expm1(log_v)


def load_products_catalog(catalog_path: str | Path = "ml/products_catalog.json") -> list[dict]:
    """Load the 646 SteelTrack product catalog definitions."""
    path = Path(catalog_path)
    if not path.exists():
        # Fallback to searching nearby
        candidates = [
            Path("ml/products_catalog.json"),
            Path("../ml/products_catalog.json"),
        ]
        for c in candidates:
            if c.exists():
                path = c
                break

    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_raw_monthly_points(db_path: str | Path = "CSV_for_LSTM/monthly_series_cache.sqlite") -> list[dict]:
    """Load pre-aggregated monthly observations from SQLite cache."""
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("SELECT item_code, branch_id, year, month, net_quantity FROM monthly_points")
    rows = c.fetchall()
    conn.close()

    return [
        {
            "item_code": r[0],
            "branch_id": str(r[1]),
            "year": int(r[2]),
            "month": int(r[3]),
            "net_quantity": float(r[4]),
        }
        for r in rows
    ]


def build_dense_series(
    raw_points: list[dict],
    start_year: int = 2017,
    end_year: int = 2026,
    end_month: int = 10,
) -> dict[tuple[str, str], np.ndarray]:
    """Build dense monthly quantity arrays for each (item_code, branch_id)."""
    # Create month index
    months: list[tuple[int, int]] = []
    for y in range(start_year, end_year + 1):
        max_m = end_month if y == end_year else 12
        for m in range(1, max_m + 1):
            months.append((y, m))

    month_to_idx = {m: i for i, m in enumerate(months)}
    n_months = len(months)

    # Accumulate into dense arrays
    series: dict[tuple[str, str], np.ndarray] = {}
    for pt in raw_points:
        key = (pt["item_code"], pt["branch_id"])
        ym = (pt["year"], pt["month"])
        if ym in month_to_idx:
            if key not in series:
                series[key] = np.zeros(n_months, dtype=np.float32)
            series[key][month_to_idx[ym]] += max(0.0, pt["net_quantity"])

    return series


def map_products_to_series(
    products: list[dict],
    series: dict[tuple[str, str], np.ndarray],
) -> dict[tuple[str, str], np.ndarray]:
    """Map each SteelTrack product in the catalog to a sales series.

    Ranks CSV items by total volume and assigns top items to catalog products,
    guaranteeing all 646 products have a realistic series.
    """
    # Calculate volume per item across all branches
    item_vols: dict[str, float] = {}
    for (item, _), arr in series.items():
        item_vols[item] = item_vols.get(item, 0.0) + float(arr.sum())

    sorted_items = sorted(item_vols.keys(), key=lambda it: item_vols[it], reverse=True)

    product_series: dict[tuple[str, str], np.ndarray] = {}

    for idx, prod in enumerate(products):
        pid = prod["id"]
        # Map to an item series deterministically
        mapped_item = sorted_items[idx % len(sorted_items)] if sorted_items else None

        for bid in ALL_BRANCH_IDS:
            key = (pid, bid)
            if mapped_item and (mapped_item, bid) in series:
                product_series[key] = series[(mapped_item, bid)]
            else:
                # Default baseline
                product_series[key] = np.zeros(118, dtype=np.float32)

    return product_series


def create_training_sequences(
    product_series: dict[tuple[str, str], np.ndarray],
    lookback: int = 12,
    horizon: int = 3,
    val_ratio: float = 0.2,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, ScalerMeta]:
    """Generate sliding window training and validation sequences.

    Input shape:  (N, lookback, 1)
    Target shape: (N, horizon)
    """
    # 1. Compute global scaler over all non-zero log values
    all_vals: list[float] = []
    for arr in product_series.values():
        nonzero = arr[arr > 0]
        if nonzero.size > 0:
            all_vals.extend(np.log1p(nonzero).tolist())

    if all_vals:
        mean = float(np.mean(all_vals))
        std = float(np.std(all_vals)) or 1.0
    else:
        mean, std = 2.0, 1.0

    scaler = ScalerMeta(mean=mean, std=std)

    xs_train, ys_train = [], []
    xs_val, ys_val = [], []

    for arr in product_series.values():
        if arr.sum() <= 0:
            continue

        scaled = scaler.transform(arr)
        total_len = len(scaled)

        # Sliding windows
        split_idx = int(total_len * (1.0 - val_ratio))

        for end_idx in range(lookback, total_len - horizon + 1):
            window_x = scaled[end_idx - lookback : end_idx]
            target_y = scaled[end_idx : end_idx + horizon]

            if end_idx < split_idx:
                xs_train.append(window_x)
                ys_train.append(target_y)
            else:
                xs_val.append(window_x)
                ys_val.append(target_y)

    x_tr = np.array(xs_train, dtype=np.float32)[:, :, np.newaxis]
    y_tr = np.array(ys_train, dtype=np.float32)
    x_v = np.array(xs_val, dtype=np.float32)[:, :, np.newaxis]
    y_v = np.array(ys_val, dtype=np.float32)

    return x_tr, y_tr, x_v, y_v, scaler

