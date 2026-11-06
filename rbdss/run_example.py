"""Example runner script demonstrating the SteelTrack RBDSS execution.

Runs the pipeline on the sample multi-branch dataset, prints the recommendation
table, transfer schedule, procurement list, and outputs JSON.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Ensure root directory is on sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from rbdss.exporters import (
    allocation_to_dataframe,
    export_to_json,
    procurement_to_dataframe,
    recommendations_to_dataframe,
    transfers_to_dataframe,
)
from rbdss.pipeline import run_rbdss
from rbdss.sample_data import generate_sample_forecasts, generate_sample_inventory


def main() -> None:
    print("=" * 80)
    print(" SteelTrack Rule-Based Decision Support System (RBDSS)")
    print(" Multi-Branch Inventory Balancing & Procurement Optimization")
    print("=" * 80)

    # 1. Load sample inputs
    inv_df = generate_sample_inventory()
    fc_df = generate_sample_forecasts()

    print(f"\n[1] Ingested {len(inv_df)} inventory records and {len(fc_df)} forecasted demand records.")

    # 2. Execute RBDSS
    result = run_rbdss(forecast_df=fc_df, inventory_df=inv_df)

    # 3. Recommendations Table
    df_rec = recommendations_to_dataframe(result)
    print("\n[2] DECISION RECOMMENDATIONS PER BRANCH & PRODUCT:")
    cols_display = [
        "branch_id",
        "product_id",
        "pas",
        "rs",
        "nir",
        "es",
        "action",
        "transfer_quantity",
        "procurement_quantity",
        "rule_triggered",
    ]
    print(df_rec[cols_display].to_string(index=False))

    # 4. Inter-Branch Transfer Schedule
    df_trans = transfers_to_dataframe(result)
    print("\n[3] RECOMMENDED INTER-BRANCH TRANSFERS:")
    if not df_trans.empty:
        print(df_trans.to_string(index=False))
    else:
        print("  No inter-branch transfers needed.")

    # 5. Consolidated Procurement List
    df_proc = procurement_to_dataframe(result)
    print("\n[4] CONSOLIDATED PROCUREMENT ORDER LIST:")
    if not df_proc.empty:
        print(df_proc.to_string(index=False))
    else:
        print("  No external procurement needed.")

    # 6. Allocation Summary
    df_alloc = allocation_to_dataframe(result)
    print("\n[5] PROJECTED INVENTORY POSTURE:")
    print(df_alloc[["branch_id", "product_id", "pas", "net_transfers", "procurement", "projected_closing_stock", "inventory_posture"]].to_string(index=False))

    # 7. Export JSON
    out_json = Path(__file__).parent / "example_output.json"
    export_to_json(result, filepath=out_json, indent=2)
    print(f"\n[6] Detailed JSON payload exported to: {out_json}")


if __name__ == "__main__":
    main()
