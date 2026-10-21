"""Post-processing rules applied to raw model output.

These are the business constraints that a raw neural-network output
should not be trusted to satisfy on its own:

  * Quantities must be non-negative whole units.
  * The confidence band must contain the point forecast.
  * A forecast should not wildly exceed the branch's recent run rate
    (a sanity cap that catches a diverged model).
  * Reorder recommendations are derived from forecast vs. on-hand stock.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# A single month forecast exceeding this multiple of the trailing 6-month
# average is treated as a model failure and replaced by the average.
OUTLIER_MULTIPLE = 4.0


@dataclass
class ReorderAdvice:
    """Restock guidance derived from a forecast and current stock."""

    product_id: str
    branch_id: str
    on_hand: int
    forecast_quantity: int
    safety_stock: int
    recommended_restock: int
    status: str  # "Restock Needed" | "Optimal" | "Overstocked"


def clamp_prediction(
    value: float,
    *,
    lower: float,
    upper: float,
) -> int:
    """Clamp a raw prediction into [lower, upper] and round to whole units."""
    bounded = max(lower, min(upper, value))
    return int(round(bounded))


def enforce_containment(
    point: int,
    lower: int,
    upper: int,
) -> tuple[int, int]:
    """Guarantee the confidence band brackets the point forecast."""
    lower = min(lower, point)
    upper = max(upper, point)
    return lower, upper


def guard_against_outliers(
    predicted: int,
    trailing_average: float | None,
    *,
    multiple: float = OUTLIER_MULTIPLE,
) -> int:
    """Cap a prediction that diverges wildly from the recent run rate.

    This is a safety net, not a modelling choice: a model that suddenly
    predicts 10x the trailing average is almost always broken, and letting
    that number drive a purchase order would be expensive.
    """
    if not trailing_average or trailing_average <= 0:
        return predicted

    cap = int(round(trailing_average * multiple))
    if predicted > cap:
        logger.warning(
            "Prediction %s exceeds %.1fx the trailing average (%.1f) — capping at %s",
            predicted,
            multiple,
            trailing_average,
            cap,
        )
        return cap
    return predicted


def compute_reorder_advice(
    *,
    product_id: str,
    branch_id: str,
    on_hand: int,
    forecast_quantity: int,
    reorder_level: int,
    safety_factor: float = 1.15,
) -> ReorderAdvice:
    """Derive restock guidance from forecast demand versus stock on hand.

    The safety stock is the forecast multiplied by a buffer factor, which
    protects against forecast error and supplier lead time.
    """
    safety_stock = int(round(forecast_quantity * safety_factor))
    required = max(safety_stock, reorder_level)
    recommended = max(0, required - on_hand)

    if on_hand < required:
        status = "Restock Needed"
    elif on_hand > required * 2:
        status = "Overstocked"
    else:
        status = "Optimal"

    return ReorderAdvice(
        product_id=product_id,
        branch_id=branch_id,
        on_hand=on_hand,
        forecast_quantity=forecast_quantity,
        safety_stock=safety_stock,
        recommended_restock=recommended,
        status=status,
    )
