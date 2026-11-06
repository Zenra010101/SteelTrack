"""Multi-branch transfer matching engine for the SteelTrack RBDSS.

Matches recipient branches (NIR > 0) with donor branches (ES > 0) according to
configurable prioritization strategies while guaranteeing that no donor is
ever over-allocated and no branch acts as both donor and recipient.
"""

from __future__ import annotations

import logging
from typing import Any

from rbdss.calculations import compute_tq
from rbdss.config import DonorStrategy, RBDSSConfig
from rbdss.models import TransferItem

logger = logging.getLogger("rbdss.transfer_matcher")


class TransferMatcher:
    """Greedy multi-branch inventory matching engine."""

    def __init__(self, config: RBDSSConfig | None = None) -> None:
        self.config = config or RBDSSConfig()

    def sort_donors_for_recipient(
        self,
        recipient_branch_id: str,
        available_donors: list[str],
        donor_es: dict[str, float],
    ) -> list[str]:
        """Order donor branches according to the configured selection strategy.

        Strategies:
        - LARGEST_ES_FIRST: Maximize shipment consolidation by pulling from branches with largest ES.
        - NEAREST_BRANCH: Minimize freight costs and transit times using the distance matrix.
        - PRIORITY_LIST: Respect fixed enterprise logistics hierarchy (e.g. main distribution hub).
        """
        strategy = self.config.donor_strategy

        if strategy == DonorStrategy.LARGEST_ES_FIRST:
            # Sort by available ES descending; tie-break alphabetically by branch_id
            return sorted(available_donors, key=lambda b: (-donor_es[b], b))

        elif strategy == DonorStrategy.NEAREST_BRANCH:
            # Sort by distance ascending; tie-break by largest ES descending
            return sorted(
                available_donors,
                key=lambda b: (
                    self.config.get_distance(b, recipient_branch_id),
                    -donor_es[b],
                    b,
                ),
            )

        elif strategy == DonorStrategy.PRIORITY_LIST:
            # Sort by index in config.branch_priority (unlisted branches go to the end)
            priority_map = {b: idx for idx, b in enumerate(self.config.branch_priority)}
            inf_idx = len(priority_map) + 100
            return sorted(
                available_donors,
                key=lambda b: (priority_map.get(b, inf_idx), -donor_es[b], b),
            )

        # Fallback default
        return sorted(available_donors, key=lambda b: (-donor_es[b], b))

    def match_transfers_for_product(
        self,
        product_id: str,
        period: str,
        initial_nir: dict[str, float],
        initial_es: dict[str, float],
    ) -> tuple[list[TransferItem], dict[str, float], dict[str, float]]:
        """Balance surplus and deficit branches for a single product in a given period.

        Args:
            product_id: Target product identifier.
            period: Planning period (e.g. "2026-12").
            initial_nir: Mapping of {branch_id: nir} for recipient branches (NIR > 0).
            initial_es: Mapping of {branch_id: es} for donor branches (ES > 0).

        Returns:
            (transfer_items, remaining_nir, remaining_es)
        """
        # Copy pools to track live state
        remaining_nir = {b: float(val) for b, val in initial_nir.items() if val > 0.0}
        remaining_es = {b: float(val) for b, val in initial_es.items() if val > 0.0}

        # Invariant safety check: Disjoint donor and recipient sets
        overlap = set(remaining_nir.keys()).intersection(set(remaining_es.keys()))
        if overlap:
            raise ValueError(
                f"Invariant violation: Branches {overlap} cannot be both donor (ES > 0) "
                f"and recipient (NIR > 0) for product '{product_id}' in period '{period}'."
            )

        transfers: list[TransferItem] = []

        # Sort recipients by largest NIR first (replenish most critical shortages first)
        recipients_ordered = sorted(remaining_nir.keys(), key=lambda b: (-remaining_nir[b], b))

        for rec_branch in recipients_ordered:
            needed = remaining_nir[rec_branch]
            if needed <= 0.0:
                continue

            # Identify candidate donors who still have ES > 0
            candidate_donors = [b for b, es in remaining_es.items() if es >= self.config.min_transfer_quantity]
            sorted_donors = self.sort_donors_for_recipient(rec_branch, candidate_donors, remaining_es)

            for donor_branch in sorted_donors:
                if needed <= 0.0:
                    break

                avail_es = remaining_es[donor_branch]
                if avail_es <= 0.0:
                    continue

                # Compute TQ = min(ES, NIR)
                tq = compute_tq(es_donor=avail_es, nir_recipient=needed)

                if tq < self.config.min_transfer_quantity:
                    continue

                # Execute transfer allocation
                transfer_item = TransferItem(
                    donor_branch_id=donor_branch,
                    recipient_branch_id=rec_branch,
                    product_id=product_id,
                    period=period,
                    transfer_quantity=tq,
                )
                transfers.append(transfer_item)

                # Decrement both pools to strictly prevent over-allocation
                remaining_es[donor_branch] = float(avail_es - tq)
                needed = float(needed - tq)
                remaining_nir[rec_branch] = needed

                logger.debug(
                    "Matched Transfer: Product %s: %s -> %s | Qty: %.2f | Donor Rem ES: %.2f | Rec Rem NIR: %.2f",
                    product_id,
                    donor_branch,
                    rec_branch,
                    tq,
                    remaining_es[donor_branch],
                    needed,
                )

        return transfers, remaining_nir, remaining_es

