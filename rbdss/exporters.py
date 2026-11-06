"""Export utilities for the SteelTrack RBDSS result structures.

Supports conversion to pandas DataFrames, formatted CSV files, and JSON payloads.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd

from rbdss.models import RBDSSResult


def recommendations_to_dataframe(result: RBDSSResult) -> pd.DataFrame:
    """Flatten branch recommendations into an analytical pandas DataFrame."""
    rows = []
    for r in result.recommendations:
        donor_recipients = [
            f"{t.donor_branch_id}->{t.recipient_branch_id}:{t.transfer_quantity:.1f}"
            for t in r.transfers
        ]
        rows.append({
            "branch_id": r.branch_id,
            "product_id": r.product_id,
            "period": r.period,
            "current_stock": r.current_stock,
            "incoming_stock": r.incoming_stock,
            "reserved_stock": r.reserved_stock,
            "safety_stock": r.safety_stock,
            "forecasted_demand": r.forecasted_demand,
            "pas": r.pas,
            "rs": r.rs,
            "nir": r.nir,
            "es": r.es,
            "rule_triggered": r.rule_triggered,
            "action": r.action,
            "transfer_quantity": r.transfer_quantity,
            "procurement_quantity": r.procurement_quantity,
            "transfers_manifest": ", ".join(donor_recipients) if donor_recipients else "None",
            "explanation": r.explanation,
            "status": r.status,
        })
    return pd.DataFrame(rows)


def transfers_to_dataframe(result: RBDSSResult) -> pd.DataFrame:
    """Format inter-branch transfer recommendations into a logistics manifest DataFrame."""
    rows = [t.to_dict() for t in result.transfers]
    if not rows:
        return pd.DataFrame(columns=[
            "donor_branch_id",
            "recipient_branch_id",
            "product_id",
            "period",
            "transfer_quantity",
        ])
    return pd.DataFrame(rows)


def procurement_to_dataframe(result: RBDSSResult) -> pd.DataFrame:
    """Format consolidated procurement list into a purchasing purchase order DataFrame."""
    rows = []
    for p in result.procurement_summary:
        branches_str = ", ".join(
            f"{b['branch_id']} ({b['procurement_quantity']:.1f})"
            for b in p.branch_breakdown
        )
        rows.append({
            "product_id": p.product_id,
            "period": p.period,
            "total_procurement_quantity": p.total_procurement_quantity,
            "requesting_branches": branches_str,
        })
    if not rows:
        return pd.DataFrame(columns=[
            "product_id",
            "period",
            "total_procurement_quantity",
            "requesting_branches",
        ])
    return pd.DataFrame(rows)


def allocation_to_dataframe(result: RBDSSResult) -> pd.DataFrame:
    """Format inventory allocation posture into a summary DataFrame."""
    rows = [a.to_dict() for a in result.allocation_summary]
    if not rows:
        return pd.DataFrame(columns=[
            "branch_id",
            "product_id",
            "period",
            "pas",
            "rs",
            "net_transfers",
            "procurement",
            "projected_closing_stock",
            "inventory_posture",
        ])
    return pd.DataFrame(rows)


def export_to_json(
    result: RBDSSResult,
    filepath: str | Path | None = None,
    indent: int = 2,
) -> str:
    """Export complete RBDSS execution results as JSON."""
    payload = result.to_dict()
    json_text = json.dumps(payload, indent=indent, ensure_ascii=False)
    if filepath is not None:
        out_path = Path(filepath)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json_text, encoding="utf-8")
    return json_text


def export_to_csv(
    result: RBDSSResult,
    output_dir: str | Path,
    prefix: str = "rbdss",
) -> dict[str, Path]:
    """Export all tables as individual CSV files in the destination directory."""
    dir_path = Path(output_dir)
    dir_path.mkdir(parents=True, exist_ok=True)

    paths = {
        "recommendations": dir_path / f"{prefix}_recommendations.csv",
        "transfers": dir_path / f"{prefix}_transfers.csv",
        "procurement": dir_path / f"{prefix}_procurement_summary.csv",
        "allocations": dir_path / f"{prefix}_allocation_summary.csv",
    }

    recommendations_to_dataframe(result).to_csv(paths["recommendations"], index=False)
    transfers_to_dataframe(result).to_csv(paths["transfers"], index=False)
    procurement_to_dataframe(result).to_csv(paths["procurement"], index=False)
    allocation_to_dataframe(result).to_csv(paths["allocations"], index=False)

    return paths

