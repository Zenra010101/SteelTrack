"""Domain entities and data structures for the SteelTrack RBDSS."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any


class ActionType(str, Enum):
    """High-level action prescribed by the rule engine."""

    KEEP = "KEEP"
    TRANSFER = "TRANSFER"
    TRANSFER_AND_PROCURE = "TRANSFER + PROCURE"
    PROCURE = "PROCURE"


class RuleId(str, Enum):
    """Identities of the 5 canonical inventory rules."""

    RULE_1 = "Rule 1 (Sufficient Inventory)"
    RULE_2 = "Rule 2 (Inventory Shortage)"
    RULE_3 = "Rule 3 (Inter-Branch Transfer)"
    RULE_4 = "Rule 4 (Partial Transfer + Procurement)"
    RULE_5 = "Rule 5 (Procurement)"


@dataclass(frozen=True)
class BranchProductKey:
    """Composite primary key for a branch-product observation within a planning period."""

    branch_id: str
    product_id: str
    period: str


@dataclass
class TransferItem:
    """An individual stock movement recommendation between two branches."""

    donor_branch_id: str
    recipient_branch_id: str
    product_id: str
    period: str
    transfer_quantity: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "donor_branch_id": self.donor_branch_id,
            "recipient_branch_id": self.recipient_branch_id,
            "product_id": self.product_id,
            "period": self.period,
            "transfer_quantity": self.transfer_quantity,
        }


@dataclass
class BranchRecommendation:
    """Final decision recommendation for a specific branch, product, and period."""

    branch_id: str
    product_id: str
    period: str
    current_stock: float
    incoming_stock: float
    reserved_stock: float
    safety_stock: float
    forecasted_demand: float
    pas: float
    rs: float
    nir: float
    es: float
    rule_triggered: str
    action: str
    transfer_quantity: float
    procurement_quantity: float
    explanation: str
    status: str = "Pending Management Approval"
    transfers: list[TransferItem] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["transfers"] = [t.to_dict() if isinstance(t, TransferItem) else t for t in self.transfers]
        return data


@dataclass
class ConsolidatedProcurementItem:
    """Enterprise-level aggregated purchase recommendation for a product and period."""

    product_id: str
    period: str
    total_procurement_quantity: float
    branch_breakdown: list[dict[str, Any]]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class AllocationSummaryItem:
    """Overview of inventory balance before and after RBDSS decisions."""

    branch_id: str
    product_id: str
    period: str
    pas: float
    rs: float
    net_transfers: float  # + incoming transfers - outgoing transfers
    procurement: float
    projected_closing_stock: float
    inventory_posture: str  # "Sufficient", "Replenished by Transfer", "Procuring", "Surplus Donor"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class RBDSSResult:
    """Consolidated execution output of the SteelTrack RBDSS pipeline."""

    recommendations: list[BranchRecommendation]
    transfers: list[TransferItem]
    procurement_summary: list[ConsolidatedProcurementItem]
    allocation_summary: list[AllocationSummaryItem]
    audit_logs: list[dict[str, Any]]

    def to_dict(self) -> dict[str, Any]:
        return {
            "recommendations": [r.to_dict() for r in self.recommendations],
            "transfers": [t.to_dict() for t in self.transfers],
            "procurement_summary": [p.to_dict() for p in self.procurement_summary],
            "allocation_summary": [a.to_dict() for a in self.allocation_summary],
            "audit_logs": self.audit_logs,
        }

