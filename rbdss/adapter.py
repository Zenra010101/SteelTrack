"""Adapter module for loading and standardizing demand forecasts from upstream LSTM models.

Treats the PyTorch LSTM demand model as an upstream component. Ingests forecasts
from DataFrames, CSV/JSON files, or a custom model prediction callable, validates
columns, clips negative values at zero, and applies the configured rounding policy.
"""

from __future__ import annotations

import json
import math
from collections.abc import Callable
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from rbdss.config import RBDSSConfig, RoundingMode

REQUIRED_FORECAST_COLUMNS = ["branch_id", "product_id", "period", "forecasted_demand"]


# =========================================================================
# PLACEHOLDER: Pluggable PyTorch LSTM Demand Forecast Model Adapter
# =========================================================================
def example_pytorch_lstm_model_predict_hook(
    model_or_predictor: Any = None,
    product_ids: list[str] | None = None,
    branch_ids: list[str] | None = None,
    horizon_months: int = 3,
) -> pd.DataFrame:
    """USER PLACEHOLDER: Hook to call your PyTorch model's predict method directly.

    Replace or customize the body of this function to plug in your custom
    PyTorch `model(x)` inference, your FastAPI `POST /predict` client, or
    `Predictor.predict(...)`.

    Example integration:
    >>> # from src.inference.predictor import Predictor
    >>> # raw_preds = predictor.predict(product_ids=product_ids, branch_ids=branch_ids)
    >>> # return pd.DataFrame([{
    >>> #     "branch_id": str(p.branch_id),
    >>> #     "product_id": str(p.product_id),
    >>> #     "period": p.forecast_month.strftime("%Y-%m"),
    >>> #     "forecasted_demand": p.predicted_quantity,
    >>> # } for p in raw_preds])
    """
    raise NotImplementedError(
        "Connect your PyTorch LSTM model or predictor instance here, or pass "
        "your model's DataFrame / CSV / JSON output directly to load_forecasts()."
    )


def apply_forecast_rounding(values: np.ndarray | pd.Series, mode: RoundingMode) -> np.ndarray:
    """Apply the configured rounding policy to continuous forecast demand values."""
    arr = np.asarray(values, dtype=np.float64)
    # 1. Non-negativity constraint: clip all values at 0.0
    arr = np.clip(arr, 0.0, None)

    # 2. Rounding policy
    if mode == RoundingMode.CEIL:
        # Conservative inventory policy: round up to avoid stockouts in discrete steel units
        return np.ceil(arr)
    elif mode == RoundingMode.ROUND:
        # Standard half-up round
        return np.round(arr)
    elif mode == RoundingMode.FLOOR:
        return np.floor(arr)
    elif mode == RoundingMode.NONE:
        return arr
    else:
        return np.ceil(arr)


def load_forecasts(
    source: pd.DataFrame | str | Path | list[dict[str, Any]] | Callable[[], pd.DataFrame],
    config: RBDSSConfig | None = None,
    column_mapping: dict[str, str] | None = None,
) -> pd.DataFrame:
    """Load, validate, clip, and format forecasted demand from any upstream source.

    Args:
        source: A pandas DataFrame, a CSV or JSON file path, a list of dictionaries,
                or a callable hook that returns predictions.
        config: RBDSS configuration controlling rounding and thresholds.
        column_mapping: Optional dict to remap custom column names, e.g.:
                        {"BranchCode": "branch_id", "SKU": "product_id", ...}

    Returns:
        Standardized DataFrame with columns:
        ['branch_id', 'product_id', 'period', 'forecasted_demand']

    Raises:
        ValueError: If required columns are missing, contain null values, or duplicates exist.
    """
    cfg = config or RBDSSConfig()

    # 1. Resolve source to a DataFrame
    if callable(source):
        df = source()
        if not isinstance(df, pd.DataFrame):
            df = pd.DataFrame(df)
    elif isinstance(source, pd.DataFrame):
        df = source.copy()
    elif isinstance(source, (str, Path)):
        path = Path(source)
        if not path.exists():
            raise FileNotFoundError(f"Forecast source file not found: {path}")
        if path.suffix.lower() == ".csv":
            df = pd.read_csv(path)
        elif path.suffix.lower() in (".json", ".js"):
            df = pd.read_json(path)
        else:
            # Try CSV then JSON
            try:
                df = pd.read_csv(path)
            except Exception:
                df = pd.read_json(path)
    elif isinstance(source, list):
        df = pd.DataFrame(source)
    else:
        raise TypeError(f"Unsupported forecast source type: {type(source).__name__}")

    # 2. Apply column mapping if provided
    if column_mapping:
        df = df.rename(columns=column_mapping)

    # 3. Validate presence of required columns
    missing = [col for col in REQUIRED_FORECAST_COLUMNS if col not in df.columns]
    if missing:
        raise ValueError(
            f"Forecast data missing required columns: {missing}. "
            f"Expected: {REQUIRED_FORECAST_COLUMNS}. Available: {list(df.columns)}"
        )

    # 4. Standardize column types
    df = df[REQUIRED_FORECAST_COLUMNS].copy()
    df["branch_id"] = df["branch_id"].astype(str).str.strip()
    df["product_id"] = df["product_id"].astype(str).str.strip()
    df["period"] = df["period"].astype(str).str.strip()

    # 5. Check for null or invalid keys
    for col in ["branch_id", "product_id", "period"]:
        if df[col].isnull().any() or (df[col] == "").any() or (df[col] == "nan").any():
            raise ValueError(f"Forecast column '{col}' contains null or empty values.")

    # 6. Check for duplicate branch-product-period rows
    dup_mask = df.duplicated(subset=["branch_id", "product_id", "period"], keep=False)
    if dup_mask.any():
        dups = df[dup_mask].head(4).to_dict(orient="records")
        raise ValueError(
            f"Duplicate forecast entries detected for (branch_id, product_id, period): {dups}"
        )

    # 7. Coerce forecasted_demand to numeric float
    try:
        df["forecasted_demand"] = pd.to_numeric(df["forecasted_demand"], errors="coerce")
    except Exception as exc:
        raise ValueError(f"Could not convert 'forecasted_demand' to numeric values: {exc}") from exc

    if df["forecasted_demand"].isnull().any():
        raise ValueError("Forecast column 'forecasted_demand' contains non-numeric or NaN values.")

    # 8. Non-negativity clipping & rounding
    df["forecasted_demand"] = apply_forecast_rounding(df["forecasted_demand"].to_numpy(), cfg.rounding_mode)

    return df.reset_index(drop=True)

