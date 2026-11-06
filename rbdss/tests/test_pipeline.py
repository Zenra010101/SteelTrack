"""End-to-end integration and pipeline tests for the SteelTrack RBDSS."""

import json
from pathlib import Path

import pandas as pd
import pytest

from rbdss.adapter import load_forecasts
from rbdss.config import RBDSSConfig, RoundingMode
from rbdss.exporters import (
    allocation_to_dataframe,
    export_to_csv,
    export_to_json,
    procurement_to_dataframe,
    recommendations_to_dataframe,
    transfers_to_dataframe,
)
from rbdss.models import ActionType, RuleId
from rbdss.pipeline import run_rbdss, validate_inventory_data
from rbdss.sample_data import generate_sample_forecasts, generate_sample_inventory


class TestSampleDataTriggersAllRules:
    """Verifies that the reference sample dataset executes cleanly and triggers all rules."""

    def test_sample_dataset_triggers_all_canonical_rules(self):
        inv_df = generate_sample_inventory()
        fc_df = generate_sample_forecasts()

        result = run_rbdss(fc_df, inv_df)

        assert len(result.recommendations) == 13
        assert len(result.transfers) > 0
        assert len(result.procurement_summary) > 0
        assert len(result.allocation_summary) == 13

        # Extract set of rules fired across all branch recommendations
        rules_fired = {r.rule_triggered for r in result.recommendations}
        actions_fired = {r.action for r in result.recommendations}

        # Rule 1: Sufficient inventory (KEEP)
        assert RuleId.RULE_1.value in rules_fired
        assert ActionType.KEEP.value in actions_fired

        # Rule 3: Inter-Branch Transfer (TRANSFER)
        assert RuleId.RULE_3.value in rules_fired
        assert ActionType.TRANSFER.value in actions_fired

        # Rule 4: Partial Transfer + Procurement (TRANSFER + PROCURE)
        assert RuleId.RULE_4.value in rules_fired
        assert ActionType.TRANSFER_AND_PROCURE.value in actions_fired

        # Rule 5: Pure Procurement (PROCURE)
        assert RuleId.RULE_5.value in rules_fired
        assert ActionType.PROCURE.value in actions_fired

        # Rule 2 (Inventory Shortage) is logged in the audit trace for all deficit evaluations
        rule_2_traces = [
            t for t in result.audit_logs
            if t.get("phase") == "metrics_computed" and t.get("computed", {}).get("nir", 0) > 0
        ]
        assert len(rule_2_traces) > 0

        # Verify all recommendations have status "Pending Management Approval"
        assert all(r.status == "Pending Management Approval" for r in result.recommendations)


class TestForecastAdapter:
    """Tests loading, standardizing, negative clipping, and configurable rounding."""

    def test_negative_demand_is_clipped_at_zero(self):
        raw_data = pd.DataFrame([
            {"branch_id": "B1", "product_id": "P1", "period": "2026-12", "forecasted_demand": -25.4},
        ])
        df = load_forecasts(raw_data)
        assert df["forecasted_demand"].iloc[0] == 0.0

    def test_rounding_modes(self):
        raw_data = pd.DataFrame([
            {"branch_id": "B1", "product_id": "P1", "period": "2026-12", "forecasted_demand": 14.2},
            {"branch_id": "B2", "product_id": "P1", "period": "2026-12", "forecasted_demand": 14.8},
        ])

        # CEIL (Default)
        df_ceil = load_forecasts(raw_data, RBDSSConfig(rounding_mode=RoundingMode.CEIL))
        assert df_ceil["forecasted_demand"].tolist() == [15.0, 15.0]

        # ROUND
        df_round = load_forecasts(raw_data, RBDSSConfig(rounding_mode=RoundingMode.ROUND))
        assert df_round["forecasted_demand"].tolist() == [14.0, 15.0]

        # FLOOR
        df_floor = load_forecasts(raw_data, RBDSSConfig(rounding_mode=RoundingMode.FLOOR))
        assert df_floor["forecasted_demand"].tolist() == [14.0, 14.0]

        # NONE
        df_none = load_forecasts(raw_data, RBDSSConfig(rounding_mode=RoundingMode.NONE))
        assert df_none["forecasted_demand"].tolist() == [14.2, 14.8]

    def test_load_from_json_string_and_file(self, tmp_path: Path):
        json_file = tmp_path / "test_forecasts.json"
        data = [
            {"branch_id": "B1", "product_id": "P1", "period": "2026-12", "forecasted_demand": 20.0}
        ]
        json_file.write_text(json.dumps(data), encoding="utf-8")

        df = load_forecasts(json_file)
        assert len(df) == 1
        assert df["branch_id"].iloc[0] == "B1"
        assert df["forecasted_demand"].iloc[0] == 20.0


class TestValidationAndErrorHandling:
    """Tests schema validation, duplicate detection, and non-negativity checks."""

    def test_missing_inventory_columns_raises_error(self):
        invalid_inv = pd.DataFrame([{"branch_id": "B1", "product_id": "P1"}])
        with pytest.raises(ValueError, match="Inventory data missing required columns"):
            validate_inventory_data(invalid_inv)

    def test_negative_physical_stock_raises_error(self):
        invalid_inv = pd.DataFrame([{
            "branch_id": "B1",
            "product_id": "P1",
            "period": "2026-12",
            "current_stock": -10.0,  # Negative physical stock!
            "incoming_stock": 0.0,
            "reserved_stock": 0.0,
            "safety_stock": 5.0,
        }])
        with pytest.raises(ValueError, match="Negative stock values found in column 'current_stock'"):
            validate_inventory_data(invalid_inv)

    def test_duplicate_inventory_rows_raises_error(self):
        dups = pd.DataFrame([
            {"branch_id": "B1", "product_id": "P1", "period": "2026-12", "current_stock": 10.0, "incoming_stock": 0.0, "reserved_stock": 0.0, "safety_stock": 5.0},
            {"branch_id": "B1", "product_id": "P1", "period": "2026-12", "current_stock": 20.0, "incoming_stock": 0.0, "reserved_stock": 0.0, "safety_stock": 5.0},
        ])
        with pytest.raises(ValueError, match="Duplicate inventory entries detected"):
            validate_inventory_data(dups)

    def test_non_numeric_inventory_values_raises_error(self):
        bad_val = pd.DataFrame([{
            "branch_id": "B1",
            "product_id": "P1",
            "period": "2026-12",
            "current_stock": "five_hundred",
            "incoming_stock": 0.0,
            "reserved_stock": 0.0,
            "safety_stock": 5.0,
        }])
        with pytest.raises(ValueError, match="contains non-numeric or NaN values"):
            validate_inventory_data(bad_val)


class TestExporters:
    """Tests conversion to DataFrame, CSV, and JSON."""

    def test_exporters_and_file_serialization(self, tmp_path: Path):
        inv_df = generate_sample_inventory()
        fc_df = generate_sample_forecasts()
        result = run_rbdss(fc_df, inv_df)

        # DataFrame exports
        df_rec = recommendations_to_dataframe(result)
        df_trans = transfers_to_dataframe(result)
        df_proc = procurement_to_dataframe(result)
        df_alloc = allocation_to_dataframe(result)

        assert not df_rec.empty
        assert not df_trans.empty
        assert not df_proc.empty
        assert not df_alloc.empty

        # JSON export
        json_file = tmp_path / "result.json"
        json_str = export_to_json(result, filepath=json_file)
        assert json_file.exists()
        parsed = json.loads(json_str)
        assert "recommendations" in parsed
        assert "transfers" in parsed
        assert "procurement_summary" in parsed
        assert "allocation_summary" in parsed

        # CSV export
        csv_dir = tmp_path / "csv_exports"
        paths = export_to_csv(result, output_dir=csv_dir)
        for name, path in paths.items():
            assert path.exists()
            assert path.stat().st_size > 0


class TestEdgeCases:
    """Tests edge conditions: zero forecast demand, PAS == RS exact match."""

    def test_zero_forecast_demand(self):
        inv_df = pd.DataFrame([{
            "branch_id": "B1",
            "product_id": "P_ZERO",
            "period": "2026-12",
            "current_stock": 20.0,
            "incoming_stock": 0.0,
            "reserved_stock": 0.0,
            "safety_stock": 10.0,
        }])
        fc_df = pd.DataFrame([{
            "branch_id": "B1",
            "product_id": "P_ZERO",
            "period": "2026-12",
            "forecasted_demand": 0.0,  # Zero demand
        }])

        result = run_rbdss(fc_df, inv_df)
        rec = result.recommendations[0]
        # PAS = 20, RS = 0 + 10 = 10 -> PAS >= RS -> Rule 1 KEEP, ES = 10
        assert rec.pas == 20.0
        assert rec.rs == 10.0
        assert rec.es == 10.0
        assert rec.nir == 0.0
        assert rec.action == ActionType.KEEP.value
        assert rec.rule_triggered == RuleId.RULE_1.value

    def test_pas_equals_rs_exact_balance(self):
        inv_df = pd.DataFrame([{
            "branch_id": "B1",
            "product_id": "P_EXACT",
            "period": "2026-12",
            "current_stock": 50.0,
            "incoming_stock": 10.0,
            "reserved_stock": 10.0,
            "safety_stock": 10.0,
        }])
        fc_df = pd.DataFrame([{
            "branch_id": "B1",
            "product_id": "P_EXACT",
            "period": "2026-12",
            "forecasted_demand": 40.0,
        }])

        result = run_rbdss(fc_df, inv_df)
        rec = result.recommendations[0]
        # PAS = 50, RS = 50 -> PAS == RS -> ES = 0, NIR = 0 -> Rule 1 KEEP
        assert rec.pas == 50.0
        assert rec.rs == 50.0
        assert rec.nir == 0.0
        assert rec.es == 0.0
        assert rec.action == ActionType.KEEP.value
        assert rec.rule_triggered == RuleId.RULE_1.value

