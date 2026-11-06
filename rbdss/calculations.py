"""Mathematical formulas and inventory calculations for the SteelTrack RBDSS.

All calculations strictly adhere to the domain definitions:
1. PAS = Current Stock + Incoming Stock - Reserved/Allocated Stock
2. RS  = Forecasted Demand + Safety Stock
3. NIR = max(0, RS - PAS)
4. ES  = max(0, PAS - RS)
5. TQ  = min(ES_donor, NIR_recipient)
6. PQ  = max(0, NIR - TQ)
"""

from __future__ import annotations

import math


def compute_pas(
    current_stock: float,
    incoming_stock: float,
    reserved_stock: float,
) -> float:
    """Compute Projected Available Stock (PAS).

    Formula:
        PAS = Current Stock + Incoming Stock - Reserved/Allocated Stock

    Args:
        current_stock: Physical stock on hand in the branch warehouse.
        incoming_stock: Stock currently in transit or on confirmed purchase orders.
        reserved_stock: Stock earmarked for approved customer orders / POS holds.

    Returns:
        Projected available stock (can be negative if over-reserved).
    """
    return float(current_stock + incoming_stock - reserved_stock)


def compute_rs(
    forecasted_demand: float,
    safety_stock: float,
) -> float:
    """Compute Required Stock (RS).

    Formula:
        RS = Forecasted Demand + Safety Stock

    Args:
        forecasted_demand: Expected demand for the planning period (from LSTM).
        safety_stock: Buffer stock required to protect against volatility.

    Returns:
        Required stock for the period.
    """
    return float(max(0.0, forecasted_demand) + max(0.0, safety_stock))


def compute_nir(rs: float, pas: float) -> float:
    """Compute Net Inventory Requirement (NIR) for a shortage branch.

    Formula:
        NIR = max(0, RS - PAS)

    Args:
        rs: Required stock.
        pas: Projected available stock.

    Returns:
        Quantity needed to satisfy demand and maintain safety stock (>= 0).
    """
    val = rs - pas
    return float(max(0.0, val))


def compute_es(pas: float, rs: float) -> float:
    """Compute Excess Stock (ES) for a surplus branch.

    Formula:
        ES = max(0, PAS - RS)

    Args:
        pas: Projected available stock.
        rs: Required stock.

    Returns:
        Quantity available for donation to other branches without jeopardizing
        local safety stock or forecast (>= 0).
    """
    val = pas - rs
    return float(max(0.0, val))


def compute_tq(es_donor: float, nir_recipient: float) -> float:
    """Compute Transfer Quantity (TQ) between a donor branch and a recipient branch.

    Formula:
        TQ = min(ES of donor branch, NIR of recipient branch)

    Args:
        es_donor: Unallocated excess stock remaining at the donor branch.
        nir_recipient: Unfulfilled net inventory requirement at recipient branch.

    Returns:
        Quantity to transfer from donor to recipient (>= 0).
    """
    if es_donor <= 0.0 or nir_recipient <= 0.0:
        return 0.0
    return float(min(es_donor, nir_recipient))


def compute_pq(nir_recipient: float, tq_total: float) -> float:
    """Compute Procurement Quantity (PQ) to be purchased from external mills/suppliers.

    Formula:
        PQ = max(0, NIR - TQ)

    Args:
        nir_recipient: Total net inventory requirement.
        tq_total: Total transfer quantity fulfilled across all donor branches.

    Returns:
        Residual shortfall that must be procured externally (>= 0).
    """
    val = nir_recipient - tq_total
    return float(max(0.0, val))


def check_nir_es_invariant(nir: float, es: float, tol: float = 1e-6) -> bool:
    """Verify the fundamental invariant: a branch cannot have both NIR > 0 and ES > 0.

    Mathematical Invariant:
        NIR * ES == 0
    """
    return (nir <= tol) or (es <= tol)

