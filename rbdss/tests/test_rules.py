"""Unit tests for the 5 inventory decision rules."""

import pytest
from rbdss.models import ActionType, RuleId, TransferItem
from rbdss.rules import (
    determine_recipient_rule,
    evaluate_shortage_condition,
    generate_donor_explanation,
)


class TestShortageEvaluationRules:
    """Tests evaluating Rule 1 (Sufficient) vs Rule 2 (Shortage)."""

    def test_rule_1_sufficient_inventory_strictly_greater(self):
        is_shortage, nir, es = evaluate_shortage_condition(pas=120.0, rs=70.0)
        assert not is_shortage
        assert nir == 0.0
        assert es == 50.0

    def test_rule_1_sufficient_inventory_exact_equality(self):
        is_shortage, nir, es = evaluate_shortage_condition(pas=80.0, rs=80.0)
        assert not is_shortage
        assert nir == 0.0
        assert es == 0.0

    def test_rule_2_inventory_shortage_detected(self):
        is_shortage, nir, es = evaluate_shortage_condition(pas=30.0, rs=75.0)
        assert is_shortage
        assert nir == 45.0
        assert es == 0.0


class TestRecipientDecisionRules:
    """Tests evaluating Rules 3, 4, and 5 for deficit branches."""

    def test_rule_3_inter_branch_transfer_full_satisfaction(self):
        transfers = [
            TransferItem("BR-DVO", "BR-CDO", "STEEL-DB", "2026-12", 50.0)
        ]
        rule_id, action, expl = determine_recipient_rule(
            nir=50.0,
            total_tq=50.0,
            network_es_available=80.0,
            transfers=transfers,
        )
        assert rule_id == RuleId.RULE_3
        assert action == ActionType.TRANSFER
        assert "Rule 3: Rebalanced internally via inter-branch transfer" in expl
        assert "BR-DVO (50.0 units)" in expl

    def test_rule_4_partial_transfer_plus_procurement(self):
        transfers = [
            TransferItem("BR-DVO", "BR-CDO", "STEEL-DB", "2026-12", 20.0)
        ]
        rule_id, action, expl = determine_recipient_rule(
            nir=50.0,
            total_tq=20.0,
            network_es_available=20.0,
            transfers=transfers,
        )
        assert rule_id == RuleId.RULE_4
        assert action == ActionType.TRANSFER_AND_PROCURE
        assert "Rule 4: Transfer all available excess stock" in expl
        assert "procure remaining deficit of 30.0 units" in expl

    def test_rule_5_pure_procurement_when_no_donor_has_excess(self):
        rule_id, action, expl = determine_recipient_rule(
            nir=40.0,
            total_tq=0.0,
            network_es_available=0.0,
            transfers=[],
        )
        assert rule_id == RuleId.RULE_5
        assert action == ActionType.PROCURE
        assert "Total network ES = 0.0" in expl
        assert "Procure full requirement of 40.0 units" in expl

    def test_zero_nir_edge_case(self):
        rule_id, action, expl = determine_recipient_rule(
            nir=0.0,
            total_tq=0.0,
            network_es_available=50.0,
            transfers=[],
        )
        assert rule_id == RuleId.RULE_1
        assert action == ActionType.KEEP


class TestDonorExplanationRules:
    """Tests formatting explanations for donor or balanced branches."""

    def test_donor_branch_with_dispatched_transfers(self):
        rule_id, action, expl = generate_donor_explanation(
            branch_id="BR-DVO",
            pas=160.0,
            rs=80.0,
            initial_es=80.0,
            dispatched_tq=50.0,
            remaining_es=30.0,
            recipients=["BR-CDO"],
        )
        assert rule_id == RuleId.RULE_1
        assert action == ActionType.KEEP
        assert "Dispatched 50.0 units to BR-CDO" in expl
        assert "Retained 30.0 units of excess stock" in expl

    def test_donor_branch_with_no_dispatched_transfers(self):
        rule_id, action, expl = generate_donor_explanation(
            branch_id="BR-CEB",
            pas=90.0,
            rs=80.0,
            initial_es=10.0,
            dispatched_tq=0.0,
            remaining_es=10.0,
            recipients=[],
        )
        assert rule_id == RuleId.RULE_1
        assert action == ActionType.KEEP
        assert "Excess stock (ES = 10.0) retained at branch" in expl

