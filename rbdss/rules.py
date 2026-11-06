"""IF-THEN business rules and decision logic for the SteelTrack RBDSS.

Canonical Rules:
- Rule 1 (Sufficient Inventory):
    IF PAS >= RS THEN keep inventory as is.
- Rule 2 (Inventory Shortage):
    IF PAS < RS THEN compute NIR and check other branches for surplus.
- Rule 3 (Inter-Branch Transfer):
    IF NIR > 0 AND another branch has ES > 0 (and available ES >= NIR)
    THEN recommend transfer with TQ = min(ES, NIR). Transfers take priority over procurement.
- Rule 4 (Partial Transfer + Procurement):
    IF NIR > 0 AND 0 < available ES < NIR
    THEN transfer all available ES and procure PQ = NIR - TQ.
- Rule 5 (Procurement):
    IF NIR > 0 AND no branch has excess stock (available ES == 0)
    THEN procure the full NIR (PQ = NIR).
"""

from __future__ import annotations

from typing import Any

from rbdss.models import ActionType, RuleId, TransferItem


def evaluate_shortage_condition(pas: float, rs: float) -> tuple[bool, float, float]:
    """Evaluate whether Rule 1 (Sufficient) or Rule 2 (Shortage) applies.

    Returns:
        (is_shortage, nir, es)
    """
    if pas >= rs:
        # Rule 1 applies: Sufficient inventory
        es = max(0.0, pas - rs)
        return False, 0.0, es
    else:
        # Rule 2 applies: Shortage detected, NIR > 0
        nir = max(0.0, rs - pas)
        return True, nir, 0.0


def determine_recipient_rule(
    nir: float,
    total_tq: float,
    network_es_available: float,
    transfers: list[TransferItem],
) -> tuple[RuleId, ActionType, str]:
    """Determine the final operational rule triggered for a recipient branch.

    Args:
        nir: Net inventory requirement (> 0).
        total_tq: Total transfer quantity allocated to this branch.
        network_es_available: Total excess stock available across all potential donors prior to matching.
        transfers: List of transfer items assigned to this recipient.

    Returns:
        (rule_id, action, plain_language_explanation)
    """
    # Tolerance for float comparison
    eps = 1e-6

    if nir <= eps:
        # Edge case: No requirement
        return (
            RuleId.RULE_1,
            ActionType.KEEP,
            "Inventory is sufficient to cover forecasted demand and safety stock. No action required.",
        )

    # Format donor breakdown string
    donor_summary = ", ".join(
        f"{t.donor_branch_id} ({t.transfer_quantity:.1f} units)" for t in transfers
    ) if transfers else "None"

    # Case A: Network has no excess stock whatsoever
    if network_es_available <= eps or total_tq <= eps:
        rule_id = RuleId.RULE_5
        action = ActionType.PROCURE
        explanation = (
            f"Rule 2 detected shortage (NIR = {nir:.1f}). No other branch has excess stock "
            f"(Total network ES = 0.0). Triggered Rule 5: Procure full requirement of {nir:.1f} units externally."
        )
        return rule_id, action, explanation

    # Case B: Total transfer satisfies the entire NIR
    if total_tq >= (nir - eps):
        rule_id = RuleId.RULE_3
        action = ActionType.TRANSFER
        explanation = (
            f"Rule 2 detected shortage (NIR = {nir:.1f}). Donor branches hold sufficient excess stock. "
            f"Triggered Rule 3: Rebalanced internally via inter-branch transfer of {total_tq:.1f} units "
            f"from {donor_summary}. No external procurement needed."
        )
        return rule_id, action, explanation

    # Case C: Partial transfer + residual procurement
    residual_pq = max(0.0, nir - total_tq)
    rule_id = RuleId.RULE_4
    action = ActionType.TRANSFER_AND_PROCURE
    explanation = (
        f"Rule 2 detected shortage (NIR = {nir:.1f}). Internal surplus partially satisfies demand. "
        f"Triggered Rule 4: Transfer all available excess stock ({total_tq:.1f} units from {donor_summary}) "
        f"and procure remaining deficit of {residual_pq:.1f} units externally."
    )
    return rule_id, action, explanation


def generate_donor_explanation(
    branch_id: str,
    pas: float,
    rs: float,
    initial_es: float,
    dispatched_tq: float,
    remaining_es: float,
    recipients: list[str],
) -> tuple[RuleId, ActionType, str]:
    """Generate explanation for a donor or balanced branch (PAS >= RS)."""
    if dispatched_tq > 0.0:
        recip_str = ", ".join(recipients) if recipients else "other branches"
        return (
            RuleId.RULE_1,
            ActionType.KEEP,
            f"Sufficient inventory (PAS = {pas:.1f} >= RS = {rs:.1f}, initial ES = {initial_es:.1f}). "
            f"Dispatched {dispatched_tq:.1f} units to {recip_str} as inter-branch donor. "
            f"Retained {remaining_es:.1f} units of excess stock above required buffer.",
        )
    else:
        return (
            RuleId.RULE_1,
            ActionType.KEEP,
            f"Sufficient inventory (PAS = {pas:.1f} >= RS = {rs:.1f}). "
            f"Excess stock (ES = {initial_es:.1f}) retained at branch. No transfers required.",
        )

