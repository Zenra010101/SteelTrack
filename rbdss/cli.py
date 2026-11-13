"""Command Line Interface (CLI) adapter for the SteelTrack RBDSS.

Bridges external callers (including the C# ASP.NET Core backend) with the
Rule-Based Decision Support System. Reads input JSON from stdin or file,
executes the full pipeline, and writes the resulting recommendations as JSON.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

# Ensure project root is on sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import pandas as pd

from rbdss.config import DonorStrategy, RBDSSConfig
from rbdss.pipeline import run_rbdss
from rbdss.sample_data import generate_sample_forecasts, generate_sample_inventory


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Execute SteelTrack Rule-Based Decision Support System (RBDSS)."
    )
    parser.add_argument(
        "--input",
        type=str,
        default=None,
        help="Path to input JSON file.",
    )
    parser.add_argument(
        "--stdin",
        action="store_true",
        help="Read input JSON payload from standard input.",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Path to output JSON file. If omitted, output is printed to stdout.",
    )
    parser.add_argument(
        "--strategy",
        type=str,
        default="LARGEST_ES_FIRST",
        choices=["LARGEST_ES_FIRST", "NEAREST_BRANCH", "PRIORITY_LIST"],
        help="Donor selection strategy for inter-branch transfer matching.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    # 1. Read input payload
    payload: dict[str, Any] = {}
    if args.input:
        in_path = Path(args.input)
        if not in_path.exists():
            err_msg = json.dumps({"error": f"Input file not found: {args.input}", "success": False})
            print(err_msg, file=sys.stderr)
            return 1
        with open(in_path, "r", encoding="utf-8") as f:
            payload = json.load(f)
    elif args.stdin:
        raw_text = sys.stdin.read().strip()
        if raw_text:
            try:
                payload = json.loads(raw_text)
            except Exception as ex:
                err_msg = json.dumps({"error": f"Invalid JSON on stdin: {ex}", "success": False})
                print(err_msg, file=sys.stderr)
                return 1

    # 2. Extract DataFrames or fallback to reference sample data
    forecast_data = payload.get("forecasts") or payload.get("forecast_df")
    inventory_data = payload.get("inventory") or payload.get("inventory_df")

    if forecast_data:
        fc_df = pd.DataFrame(forecast_data)
    else:
        fc_df = generate_sample_forecasts()

    if inventory_data:
        inv_df = pd.DataFrame(inventory_data)
    else:
        inv_df = generate_sample_inventory()

    # 3. Configure matching policy
    strategy_str = payload.get("config", {}).get("donor_strategy") or args.strategy
    try:
        strategy_enum = DonorStrategy(strategy_str)
    except Exception:
        strategy_enum = DonorStrategy.LARGEST_ES_FIRST

    config = RBDSSConfig(donor_strategy=strategy_enum)

    # 4. Execute RBDSS engine
    try:
        result = run_rbdss(forecast_df=fc_df, inventory_df=inv_df, config=config)
        output_payload = result.to_dict()
        output_payload["success"] = True
        output_payload["engine"] = "python_rbdss"

        json_out = json.dumps(output_payload, ensure_ascii=False, indent=2)

        if args.output:
            out_path = Path(args.output)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_text(json_out, encoding="utf-8")
        else:
            print(json_out)

        return 0

    except Exception as ex:
        err_dict = {
            "success": False,
            "error": str(ex),
            "engine": "python_rbdss",
        }
        err_json = json.dumps(err_dict, ensure_ascii=False, indent=2)
        print(err_json, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
