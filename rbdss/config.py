"""Configuration module for the SteelTrack Rule-Based Decision Support System (RBDSS).

Keeps thresholds, strategies, and operational parameters separate from business logic.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class DonorStrategy(str, Enum):
    """Strategy used to prioritize donor branches when multiple branches have Excess Stock (ES)."""

    LARGEST_ES_FIRST = "largest_es_first"  # Default: consolidate shipments from largest surplus
    NEAREST_BRANCH = "nearest_branch"      # Minimize transit distance using distance matrix
    PRIORITY_LIST = "priority_list"        # Custom priority order (e.g. central hub first)


class RoundingMode(str, Enum):
    """Rounding strategy for converting raw continuous forecast demand into units."""

    CEIL = "ceil"    # Round up to whole units (conservative, avoids stockout)
    ROUND = "round"  # Standard round half-up
    FLOOR = "floor"  # Round down
    NONE = "none"    # Keep raw continuous float


@dataclass
class RBDSSConfig:
    """Operational parameters and business rule thresholds for the RBDSS engine."""

    donor_strategy: DonorStrategy = DonorStrategy.LARGEST_ES_FIRST
    rounding_mode: RoundingMode = RoundingMode.CEIL
    allow_partial_transfers: bool = True
    min_transfer_quantity: float = 1.0
    default_status: str = "Pending Management Approval"
    branch_priority: list[str] = field(default_factory=list)
    # Map of (branch_a, branch_b) -> distance in kilometers (or transit cost)
    distance_matrix: dict[tuple[str, str], float] = field(default_factory=dict)
    # Logging / trace level
    enable_detailed_trace: bool = True

    def get_distance(self, branch_a: str, branch_b: str) -> float:
        """Return the distance between two branches, defaulting to infinity if unconfigured."""
        if branch_a == branch_b:
            return 0.0
        dist = self.distance_matrix.get((branch_a, branch_b))
        if dist is not None:
            return dist
        dist_rev = self.distance_matrix.get((branch_b, branch_a))
        if dist_rev is not None:
            return dist_rev
        return float("inf")

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> RBDSSConfig:
        """Create a config instance from a dictionary (e.g. loaded from JSON or YAML)."""
        strategy = data.get("donor_strategy", DonorStrategy.LARGEST_ES_FIRST)
        if isinstance(strategy, str):
            strategy = DonorStrategy(strategy)

        rounding = data.get("rounding_mode", RoundingMode.CEIL)
        if isinstance(rounding, str):
            rounding = RoundingMode(rounding)

        # Convert distance matrix keys if loaded from JSON format: {"Davao:Cebu": 400.0}
        raw_dist = data.get("distance_matrix", {})
        cleaned_dist: dict[tuple[str, str], float] = {}
        for k, v in raw_dist.items():
            if isinstance(k, tuple):
                cleaned_dist[k] = float(v)
            elif isinstance(k, str) and (":" in k or "__" in k or "-" in k):
                sep = ":" if ":" in k else ("__" if "__" in k else "-")
                parts = k.split(sep, 1)
                cleaned_dist[(parts[0].strip(), parts[1].strip())] = float(v)

        return cls(
            donor_strategy=strategy,
            rounding_mode=rounding,
            allow_partial_transfers=bool(data.get("allow_partial_transfers", True)),
            min_transfer_quantity=float(data.get("min_transfer_quantity", 1.0)),
            default_status=str(data.get("default_status", "Pending Management Approval")),
            branch_priority=list(data.get("branch_priority", [])),
            distance_matrix=cleaned_dist,
            enable_detailed_trace=bool(data.get("enable_detailed_trace", True)),
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialize config into a plain dictionary."""
        return {
            "donor_strategy": self.donor_strategy.value,
            "rounding_mode": self.rounding_mode.value,
            "allow_partial_transfers": self.allow_partial_transfers,
            "min_transfer_quantity": self.min_transfer_quantity,
            "default_status": self.default_status,
            "branch_priority": self.branch_priority,
            "distance_matrix": {f"{k[0]}:{k[1]}": v for k, v in self.distance_matrix.items()},
            "enable_detailed_trace": self.enable_detailed_trace,
        }

