"""SteelTrack Rule-Based Decision Support System (RBDSS).

A high-performance, auditable decision support platform for multi-branch steel
inventory balancing, inter-branch stock transfers, and procurement optimization.
"""

from __future__ import annotations

from rbdss.adapter import load_forecasts
from rbdss.calculations import (
    compute_es,
    compute_nir,
    compute_pas,
    compute_pq,
    compute_rs,
    compute_tq,
)
from rbdss.config import DonorStrategy, RBDSSConfig, RoundingMode
from rbdss.exporters import (
    allocation_to_dataframe,
    export_to_csv,
    export_to_json,
    procurement_to_dataframe,
    recommendations_to_dataframe,
    transfers_to_dataframe,
)
from rbdss.models import (
    ActionType,
    AllocationSummaryItem,
    BranchRecommendation,
    ConsolidatedProcurementItem,
    RBDSSResult,
    RuleId,
    TransferItem,
)
from rbdss.pipeline import run_rbdss
from rbdss.sample_data import generate_sample_forecasts, generate_sample_inventory

__version__ = "1.0.0"

__all__ = [
    # Primary entry points
    "run_rbdss",
    "load_forecasts",
    # Configuration
    "RBDSSConfig",
    "DonorStrategy",
    "RoundingMode",
    # Formulas
    "compute_pas",
    "compute_rs",
    "compute_nir",
    "compute_es",
    "compute_tq",
    "compute_pq",
    # Data Models
    "BranchRecommendation",
    "TransferItem",
    "ConsolidatedProcurementItem",
    "AllocationSummaryItem",
    "RBDSSResult",
    "ActionType",
    "RuleId",
    # Exporters
    "recommendations_to_dataframe",
    "transfers_to_dataframe",
    "procurement_to_dataframe",
    "allocation_to_dataframe",
    "export_to_csv",
    "export_to_json",
    # Sample Data
    "generate_sample_inventory",
    "generate_sample_forecasts",
]

