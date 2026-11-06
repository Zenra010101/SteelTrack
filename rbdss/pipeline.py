"""Pipeline orchestration engine for the SteelTrack Rule-Based Decision Support System.

Validates input datasets, executes calculations, applies multi-branch matching,
fires IF-THEN rules, and produces structured recommendations and summaries.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import asdict
from typing import Any

import numpy as np
import pandas as pd

from rbdss.adapter import load_forecasts
from rbdss.calculations import (
    check_nir_es_invariant,
    compute_es,
    compute_nir,
    compute_pas,
    compute_pq,
    compute_rs,
)
from rbdss.config import RBDSSConfig
from rbdss.models import (
    ActionType,
    AllocationSummaryItem,
    BranchRecommendation,
    ConsolidatedProcurementItem,
    RBDSSResult,
    RuleId,
    TransferItem,
)
from rbdss.rules import (
    determine_recipient_rule,
    evaluate_shortage_condition,
    generate_donor_explanation,
)
from rbdss.transfer_matcher import TransferMatcher

logger = logging.getLogger("rbdss.pipeline")

REQUIRED_INVENTORY_COLUMNS = [
    "branch_id",
    "product_id",
    "period",
    "current_stock",
    "incoming_stock",
    "reserved_stock",
    "safety_stock",
]


def validate_inventory_data(df_inv: pd.DataFrame) -> pd.DataFrame:
    """Validate inventory DataFrame schema, datatypes, and physical constraints."""
    if not isinstance(df_inv, pd.DataFrame):
        df_inv = pd.DataFrame(df_inv)

    missing = [c for c in REQUIRED_INVENTORY_COLUMNS if c not in df_inv.columns]
    if missing:
        raise ValueError(
            f"Inventory data missing required columns: {missing}. "
            f"Expected: {REQUIRED_INVENTORY_COLUMNS}. Available: {list(df_inv.columns)}"
        )

    df = df_inv[REQUIRED_INVENTORY_COLUMNS].copy()
    df["branch_id"] = df["branch_id"].astype(str).str.strip()
    df["product_id"] = df["product_id"].astype(str).str.strip()
    df["period"] = df["period"].astype(str).str.strip()

    # Null checks on keys
    for col in ["branch_id", "product_id", "period"]:
        if df[col].isnull().any() or (df[col] == "").any() or (df[col] == "nan").any():
            raise ValueError(f"Inventory column '{col}' contains null or blank values.")

    # Duplicate check on (branch_id, product_id, period)
    dup_mask = df.duplicated(subset=["branch_id", "product_id", "period"], keep=False)
    if dup_mask.any():
        dups = df[dup_mask].head(4).to_dict(orient="records")
        raise ValueError(
            f"Duplicate inventory entries detected for (branch_id, product_id, period): {dups}"
        )

    # Numeric coercion and non-negativity validation
    numeric_cols = ["current_stock", "incoming_stock", "reserved_stock", "safety_stock"]
    for col in numeric_cols:
        try:
            df[col] = pd.to_numeric(df[col], errors="coerce")
        except Exception as exc:
            raise ValueError(f"Failed converting inventory column '{col}' to numeric: {exc}") from exc

        if df[col].isnull().any():
            raise ValueError(f"Inventory column '{col}' contains non-numeric or NaN values.")

        # Physical stock values cannot be negative
        negatives = df[df[col] < 0.0]
        if not negatives.empty:
            sample = negatives.head(2).to_dict(orient="records")
            raise ValueError(
                f"Negative stock values found in column '{col}' (violates physical inventory constraints): {sample}"
            )

    return df.reset_index(drop=True)


def run_rbdss(
    forecast_df: pd.DataFrame | str | Any,
    inventory_df: pd.DataFrame | str | Any,
    config: RBDSSConfig | None = None,
) -> RBDSSResult:
    """Execute the SteelTrack Rule-Based Decision Support System.

    Args:
        forecast_df: DataFrame, file path, or source of forecasted demand.
        inventory_df: DataFrame, file path, or source of physical inventory levels.
        config: Operational thresholds and matching configuration.

    Returns:
        RBDSSResult containing recommendations, transfers, procurement list, and allocation summary.
    """
    cfg = config or RBDSSConfig()
    audit_logs: list[dict[str, Any]] = []

    # 1. Load and validate inputs
    logger.info("Ingesting and validating forecast demand and inventory datasets...")
    fc_clean = load_forecasts(forecast_df, config=cfg)
    inv_clean = validate_inventory_data(inventory_df)

    # 2. Join datasets on (branch_id, product_id, period)
    merged = pd.merge(
        inv_clean,
        fc_clean,
        on=["branch_id", "product_id", "period"],
        how="inner",
    )

    if merged.empty:
        raise ValueError(
            "Inner join between inventory and forecast produced 0 matching records. "
            "Please ensure branch_id, product_id, and period values match between datasets."
        )

    # Check for unaligned records if lengths differ
    if len(merged) < len(inv_clean):
        missing_count = len(inv_clean) - len(merged)
        logger.warning(
            "%d inventory records did not have a matching forecast for (branch_id, product_id, period).",
            missing_count,
        )

    # 3. Process by (product_id, period) groups across all branches
    matcher = TransferMatcher(config=cfg)
    all_recommendations: list[BranchRecommendation] = []
    all_transfers: list[TransferItem] = []

    grouped = merged.groupby(["product_id", "period"])

    for (product_id, period), group in grouped:
        group_rows = group.to_dict(orient="records")

        # Step A: Compute PAS, RS, NIR, ES per branch
        initial_nir: dict[str, float] = {}
        initial_es: dict[str, float] = {}
        computed_metrics: dict[str, dict[str, float]] = {}

        for row in group_rows:
            branch_id = row["branch_id"]
            c_stock = float(row["current_stock"])
            i_stock = float(row["incoming_stock"])
            r_stock = float(row["reserved_stock"])
            s_stock = float(row["safety_stock"])
            demand = float(row["forecasted_demand"])

            pas = compute_pas(c_stock, i_stock, r_stock)
            rs = compute_rs(demand, s_stock)
            nir = compute_nir(rs, pas)
            es = compute_es(pas, rs)

            # Invariant check: NIR * ES == 0
            if not check_nir_es_invariant(nir, es):
                raise RuntimeError(
                    f"Invariant violated for branch '{branch_id}', product '{product_id}': "
                    f"NIR ({nir}) and ES ({es}) cannot both be positive."
                )

            computed_metrics[branch_id] = {
                "pas": pas,
                "rs": rs,
                "nir": nir,
                "es": es,
                "current_stock": c_stock,
                "incoming_stock": i_stock,
                "reserved_stock": r_stock,
                "safety_stock": s_stock,
                "forecasted_demand": demand,
            }

            if nir > 0.0:
                initial_nir[branch_id] = nir
            if es > 0.0:
                initial_es[branch_id] = es

            # Audit trace log
            audit_logs.append({
                "phase": "metrics_computed",
                "branch_id": branch_id,
                "product_id": product_id,
                "period": period,
                "inputs": {
                    "current_stock": c_stock,
                    "incoming_stock": i_stock,
                    "reserved_stock": r_stock,
                    "safety_stock": s_stock,
                    "forecasted_demand": demand,
                },
                "computed": {
                    "pas": pas,
                    "rs": rs,
                    "nir": nir,
                    "es": es,
                },
            })

        # Step B: Inter-Branch Matching
        total_network_es = sum(initial_es.values())
        matched_transfers, rem_nir, rem_es = matcher.match_transfers_for_product(
            product_id=product_id,
            period=period,
            initial_nir=initial_nir,
            initial_es=initial_es,
        )
        all_transfers.extend(matched_transfers)

        # Index transfers by recipient and donor for rapid lookup
        transfers_by_recipient: dict[str, list[TransferItem]] = defaultdict(list)
        transfers_by_donor: dict[str, list[TransferItem]] = defaultdict(list)
        for t in matched_transfers:
            transfers_by_recipient[t.recipient_branch_id].append(t)
            transfers_by_donor[t.donor_branch_id].append(t)

        # Step C: Evaluate Rules and build final recommendations per branch
        for row in group_rows:
            branch_id = row["branch_id"]
            metrics = computed_metrics[branch_id]
            pas = metrics["pas"]
            rs = metrics["rs"]
            init_nir = metrics["nir"]
            init_es = metrics["es"]

            if init_nir > 0.0:
                # Recipient Branch (PAS < RS)
                rec_transfers = transfers_by_recipient.get(branch_id, [])
                total_tq = sum(t.transfer_quantity for t in rec_transfers)
                pq = compute_pq(nir_recipient=init_nir, tq_total=total_tq)

                rule_id, action, explanation = determine_recipient_rule(
                    nir=init_nir,
                    total_tq=total_tq,
                    network_es_available=total_network_es,
                    transfers=rec_transfers,
                )

                rec = BranchRecommendation(
                    branch_id=branch_id,
                    product_id=product_id,
                    period=period,
                    current_stock=metrics["current_stock"],
                    incoming_stock=metrics["incoming_stock"],
                    reserved_stock=metrics["reserved_stock"],
                    safety_stock=metrics["safety_stock"],
                    forecasted_demand=metrics["forecasted_demand"],
                    pas=pas,
                    rs=rs,
                    nir=init_nir,
                    es=0.0,
                    rule_triggered=rule_id.value,
                    action=action.value,
                    transfer_quantity=total_tq,
                    procurement_quantity=pq,
                    explanation=explanation,
                    status=cfg.default_status,
                    transfers=rec_transfers,
                )
                all_recommendations.append(rec)

                audit_logs.append({
                    "phase": "rule_fired",
                    "branch_id": branch_id,
                    "product_id": product_id,
                    "period": period,
                    "rule": rule_id.value,
                    "action": action.value,
                    "transfer_quantity": total_tq,
                    "procurement_quantity": pq,
                })

            else:
                # Donor or Balanced Branch (PAS >= RS)
                donor_transfers = transfers_by_donor.get(branch_id, [])
                dispatched_tq = sum(t.transfer_quantity for t in donor_transfers)
                recipients = [t.recipient_branch_id for t in donor_transfers]
                remaining_surplus = rem_es.get(branch_id, init_es)

                rule_id, action, explanation = generate_donor_explanation(
                    branch_id=branch_id,
                    pas=pas,
                    rs=rs,
                    initial_es=init_es,
                    dispatched_tq=dispatched_tq,
                    remaining_es=remaining_surplus,
                    recipients=recipients,
                )

                rec = BranchRecommendation(
                    branch_id=branch_id,
                    product_id=product_id,
                    period=period,
                    current_stock=metrics["current_stock"],
                    incoming_stock=metrics["incoming_stock"],
                    reserved_stock=metrics["reserved_stock"],
                    safety_stock=metrics["safety_stock"],
                    forecasted_demand=metrics["forecasted_demand"],
                    pas=pas,
                    rs=rs,
                    nir=0.0,
                    es=init_es,
                    rule_triggered=rule_id.value,
                    action=action.value,
                    transfer_quantity=dispatched_tq,
                    procurement_quantity=0.0,
                    explanation=explanation,
                    status=cfg.default_status,
                    transfers=donor_transfers,
                )
                all_recommendations.append(rec)

                audit_logs.append({
                    "phase": "rule_fired",
                    "branch_id": branch_id,
                    "product_id": product_id,
                    "period": period,
                    "rule": rule_id.value,
                    "action": action.value,
                    "dispatched_transfer_quantity": dispatched_tq,
                    "retained_excess": remaining_surplus,
                })

    # Step D: Build Consolidated Procurement Summary
    procurement_groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for rec in all_recommendations:
        if rec.procurement_quantity > 0.0:
            procurement_groups[(rec.product_id, rec.period)].append({
                "branch_id": rec.branch_id,
                "procurement_quantity": rec.procurement_quantity,
                "current_pas": rec.pas,
                "required_rs": rec.rs,
            })

    procurement_summary: list[ConsolidatedProcurementItem] = []
    for (p_id, per), b_list in sorted(procurement_groups.items()):
        total_pq = sum(item["procurement_quantity"] for item in b_list)
        procurement_summary.append(
            ConsolidatedProcurementItem(
                product_id=p_id,
                period=per,
                total_procurement_quantity=total_pq,
                branch_breakdown=b_list,
            )
        )

    # Step E: Build Inventory Allocation Summary
    allocation_summary: list[AllocationSummaryItem] = []
    for rec in all_recommendations:
        # Net transfer = incoming TQ (if recipient) - outgoing TQ (if donor)
        if rec.nir > 0.0:
            net_t = rec.transfer_quantity
        else:
            net_t = -rec.transfer_quantity

        # Projected closing stock = PAS + net_t + PQ - Demand
        # Note: PAS = Current + Incoming - Reserved.
        # Closing physical stock after period sales = (Current + Incoming - Reserved) + Net_Transfers + Procurement - Demand
        proj_stock = rec.pas + net_t + rec.procurement_quantity - rec.forecasted_demand

        # Posture classification
        if rec.procurement_quantity > 0.0:
            posture = "Procuring"
        elif rec.transfer_quantity > 0.0 and rec.nir > 0.0:
            posture = "Replenished by Transfer"
        elif rec.transfer_quantity > 0.0 and rec.es > 0.0:
            posture = "Surplus Donor"
        else:
            posture = "Sufficient"

        allocation_summary.append(
            AllocationSummaryItem(
                branch_id=rec.branch_id,
                product_id=rec.product_id,
                period=rec.period,
                pas=rec.pas,
                rs=rec.rs,
                net_transfers=net_t,
                procurement=rec.procurement_quantity,
                projected_closing_stock=proj_stock,
                inventory_posture=posture,
            )
        )

    return RBDSSResult(
        recommendations=all_recommendations,
        transfers=all_transfers,
        procurement_summary=procurement_summary,
        allocation_summary=allocation_summary,
        audit_logs=audit_logs,
    )

