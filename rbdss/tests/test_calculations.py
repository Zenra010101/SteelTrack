"""Unit tests for the mathematical formulas of the SteelTrack RBDSS."""

import pytest
from rbdss.calculations import (
    check_nir_es_invariant,
    compute_es,
    compute_nir,
    compute_pas,
    compute_pq,
    compute_rs,
    compute_tq,
)


class TestProjectedAvailableStock:
    """Formula 1: PAS = Current Stock + Incoming Stock - Reserved/Allocated Stock."""

    def test_standard_pas(self):
        # Current: 100, Incoming: 30, Reserved: 15 -> PAS = 115
        assert compute_pas(100.0, 30.0, 15.0) == 115.0

    def test_zero_incoming_and_reserved(self):
        assert compute_pas(50.0, 0.0, 0.0) == 50.0

    def test_over_reserved_stock_yields_negative_pas(self):
        # Current: 10, Incoming: 0, Reserved: 25 -> PAS = -15
        assert compute_pas(10.0, 0.0, 25.0) == -15.0


class TestRequiredStock:
    """Formula 2: RS = Forecasted Demand + Safety Stock."""

    def test_standard_rs(self):
        assert compute_rs(50.0, 20.0) == 70.0

    def test_zero_safety_stock(self):
        assert compute_rs(45.0, 0.0) == 45.0

    def test_zero_forecast_demand(self):
        assert compute_rs(0.0, 15.0) == 15.0

    def test_negative_forecast_demand_is_clipped_at_zero(self):
        assert compute_rs(-10.0, 20.0) == 20.0


class TestNetInventoryRequirement:
    """Formula 3: NIR = max(0, RS - PAS)."""

    def test_shortage_condition(self):
        # RS = 100, PAS = 60 -> NIR = 40
        assert compute_nir(rs=100.0, pas=60.0) == 40.0

    def test_sufficient_condition_yields_zero_nir(self):
        # RS = 80, PAS = 100 -> NIR = 0
        assert compute_nir(rs=80.0, pas=100.0) == 0.0

    def test_exact_equality_pas_equals_rs(self):
        # RS = 50, PAS = 50 -> NIR = 0
        assert compute_nir(rs=50.0, pas=50.0) == 0.0

    def test_negative_pas_amplifies_nir(self):
        # RS = 50, PAS = -10 -> NIR = 60
        assert compute_nir(rs=50.0, pas=-10.0) == 60.0


class TestExcessStock:
    """Formula 4: ES = max(0, PAS - RS)."""

    def test_surplus_condition(self):
        # PAS = 120, RS = 70 -> ES = 50
        assert compute_es(pas=120.0, rs=70.0) == 50.0

    def test_shortage_condition_yields_zero_es(self):
        # PAS = 40, RS = 90 -> ES = 0
        assert compute_es(pas=40.0, rs=90.0) == 0.0

    def test_exact_equality_pas_equals_rs(self):
        # PAS = 50, RS = 50 -> ES = 0
        assert compute_es(pas=50.0, rs=50.0) == 0.0


class TestTransferQuantity:
    """Formula 5: TQ = min(ES of donor, NIR of recipient)."""

    def test_donor_surplus_greater_than_requirement(self):
        # Donor ES: 80, Recipient NIR: 30 -> TQ = 30
        assert compute_tq(es_donor=80.0, nir_recipient=30.0) == 30.0

    def test_donor_surplus_less_than_requirement(self):
        # Donor ES: 25, Recipient NIR: 60 -> TQ = 25
        assert compute_tq(es_donor=25.0, nir_recipient=60.0) == 25.0

    def test_exact_match(self):
        assert compute_tq(es_donor=40.0, nir_recipient=40.0) == 40.0

    def test_zero_donor_excess(self):
        assert compute_tq(es_donor=0.0, nir_recipient=50.0) == 0.0

    def test_zero_recipient_requirement(self):
        assert compute_tq(es_donor=50.0, nir_recipient=0.0) == 0.0


class TestProcurementQuantity:
    """Formula 6: PQ = max(0, NIR - TQ)."""

    def test_fully_transferred_yields_zero_procurement(self):
        # NIR: 50, TQ: 50 -> PQ = 0
        assert compute_pq(nir_recipient=50.0, tq_total=50.0) == 0.0

    def test_partially_transferred_requires_procurement(self):
        # NIR: 50, TQ: 20 -> PQ = 30
        assert compute_pq(nir_recipient=50.0, tq_total=20.0) == 30.0

    def test_no_transfer_procures_full_nir(self):
        # NIR: 40, TQ: 0 -> PQ = 40
        assert compute_pq(nir_recipient=40.0, tq_total=0.0) == 40.0

    def test_over_transfer_yields_zero_procurement(self):
        # Defensive check
        assert compute_pq(nir_recipient=30.0, tq_total=35.0) == 0.0


class TestInvariants:
    """Mathematical invariant: NIR * ES == 0 (a branch cannot have both)."""

    @pytest.mark.parametrize(
        "pas, rs",
        [
            (100.0, 50.0),   # PAS > RS: ES = 50, NIR = 0
            (50.0, 100.0),   # PAS < RS: ES = 0, NIR = 50
            (50.0, 50.0),    # PAS == RS: ES = 0, NIR = 0
            (0.0, 20.0),     # PAS = 0, RS = 20: ES = 0, NIR = 20
            (-10.0, 20.0),   # Over-reserved PAS: ES = 0, NIR = 30
        ],
    )
    def test_nir_es_mutual_exclusion(self, pas, rs):
        nir = compute_nir(rs, pas)
        es = compute_es(pas, rs)
        assert check_nir_es_invariant(nir, es)
        assert (nir * es) == 0.0

