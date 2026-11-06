"""Post-processing rules applied to raw model output.

These are the business constraints that a raw neural-network output
should not be trusted to satisfy on its own:

  * Quantities must be non-negative whole units.
  * The confidence band must contain the point forecast.
  * A forecast should not wildly exceed the branch's recent run rate
    (a sanity cap that catches a diverged model).
  * Reorder recommendations are derived from Section 2.3.2.2
    Proposed Inventory Decision Formulas and IF-THEN Rules.
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
    """Restock guidance derived from Section 2.3.2.2 Proposed Inventory Decision Formulas."""

    product_id: str
    branch_id: str
    on_hand: int
    forecast_quantity: int
    safety_stock: int
    recommended_restock: int
    status: str  # "Restock Needed" | "Optimal" | "Overstocked"
    # Section 2.3.2.2 Proposed Inventory Decision Formulas & Rules
    projected_available_stock: int = 0  # Formula 1: PAS = Current Stock + Incoming Stock - Reserved Stock
    required_stock: int = 0  # Formula 2: RS = Forecasted Demand + Safety Stock
    net_inventory_requirement: int = 0  # Formula 3: NIR = max(0, RS - PAS)
    excess_stock: int = 0  # Formula 4: ES = max(0, PAS - RS)
    transfer_quantity: int = 0  # Formula 5: TQ = min(ES of Donor, NIR of Recipient)
    procurement_quantity: int = 0  # Formula 6: PQ = max(0, NIR - TQ)
    decision_rule: str = "Rule 1 - Sufficient Inventory"  # Rules 1 to 5


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
    incoming_stock: int = 0,
    reserved_stock: int = 0,
) -> ReorderAdvice:
    """Derive restock guidance using Section 2.3.2.2 Proposed Inventory Decision Formulas.

    Formula 1: Projected Available Stock (PAS) = Current Stock + Incoming Stock - Reserved Stock
    Formula 2: Required Stock (RS) = Forecasted Demand + Safety Stock
    Formula 3: Net Inventory Requirement (NIR) = max(0, RS - PAS)
    Formula 4: Excess Stock (ES) = max(0, PAS - RS)
    Formula 5: Transfer Quantity (TQ) = min(ES of Donor, NIR of Recipient)
    Formula 6: Procurement Quantity (PQ) = max(0, NIR - TQ)
    """
    safety_stock = reorder_level if reorder_level > 0 else int(round(forecast_quantity * safety_factor))

    # Formula 1: Projected Available Stock (PAS)
    pas = max(0, on_hand + incoming_stock - reserved_stock)

    # Formula 2: Required Stock (RS)
    rs = forecast_quantity + safety_stock

    # Formula 3: Net Inventory Requirement (NIR)
    nir = max(0, rs - pas)

    # Formula 4: Excess Stock (ES)
    es = max(0, pas - rs)

    # Proposed IF-THEN Decision Rules (Rules 1 to 5)
    if pas >= rs:
        decision_rule = "Rule 1 - Sufficient Inventory"
        status = "Overstocked" if es > (rs * 1.5) else "Optimal"
        pq = 0
    else:
        decision_rule = "Rule 2 - Inventory Shortage"
        status = "Restock Needed"
        pq = nir

    return ReorderAdvice(
        product_id=product_id,
        branch_id=branch_id,
        on_hand=on_hand,
        forecast_quantity=forecast_quantity,
        safety_stock=safety_stock,
        recommended_restock=nir,
        status=status,
        projected_available_stock=pas,
        required_stock=rs,
        net_inventory_requirement=nir,
        excess_stock=es,
        transfer_quantity=0,
        procurement_quantity=pq,
        decision_rule=decision_rule,
    )
