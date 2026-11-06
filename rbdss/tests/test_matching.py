"""Unit tests for the multi-branch transfer matching engine."""

import pytest
from rbdss.config import DonorStrategy, RBDSSConfig
from rbdss.transfer_matcher import TransferMatcher


class TestTransferMatchingEngine:
    """Tests verifying multi-branch balance, multi-donor/recipient allocations, and invariants."""

    def test_single_donor_single_recipient_partial_fulfillment(self):
        matcher = TransferMatcher()
        initial_nir = {"BR-CDO": 50.0}
        initial_es = {"BR-DVO": 30.0}

        transfers, rem_nir, rem_es = matcher.match_transfers_for_product(
            product_id="STEEL-P1",
            period="2026-12",
            initial_nir=initial_nir,
            initial_es=initial_es,
        )

        assert len(transfers) == 1
        t = transfers[0]
        assert t.donor_branch_id == "BR-DVO"
        assert t.recipient_branch_id == "BR-CDO"
        assert t.transfer_quantity == 30.0
        assert rem_nir["BR-CDO"] == 20.0
        assert rem_es["BR-DVO"] == 0.0

    def test_multiple_donors_satisfy_single_recipient(self):
        """A single recipient needing 100 units is fulfilled across 3 donors."""
        matcher = TransferMatcher(RBDSSConfig(donor_strategy=DonorStrategy.LARGEST_ES_FIRST))
        initial_nir = {"BR-CDO": 100.0}
        # Donors: DVO (50), CEB (30), MND (40)
        initial_es = {"BR-DVO": 50.0, "BR-CEB": 30.0, "BR-MND": 40.0}

        transfers, rem_nir, rem_es = matcher.match_transfers_for_product(
            product_id="STEEL-P1",
            period="2026-12",
            initial_nir=initial_nir,
            initial_es=initial_es,
        )

        # Largest ES first: DVO (50) -> MND (40) -> CEB (takes 10 out of 30)
        assert len(transfers) == 3
        assert transfers[0].donor_branch_id == "BR-DVO"
        assert transfers[0].transfer_quantity == 50.0

        assert transfers[1].donor_branch_id == "BR-MND"
        assert transfers[1].transfer_quantity == 40.0

        assert transfers[2].donor_branch_id == "BR-CEB"
        assert transfers[2].transfer_quantity == 10.0

        # Recipient is fully satisfied
        assert rem_nir["BR-CDO"] == 0.0
        # Check remaining pools
        assert rem_es["BR-DVO"] == 0.0
        assert rem_es["BR-MND"] == 0.0
        assert rem_es["BR-CEB"] == 20.0  # 30 - 10 = 20 remaining

    def test_single_donor_satisfies_multiple_recipients(self):
        """A large central hub supplies several branches with shortages."""
        matcher = TransferMatcher()
        initial_es = {"BR-DVO": 100.0}
        initial_nir = {"BR-CDO": 40.0, "BR-CEB": 35.0, "BR-MND": 15.0}

        transfers, rem_nir, rem_es = matcher.match_transfers_for_product(
            product_id="STEEL-P1",
            period="2026-12",
            initial_nir=initial_nir,
            initial_es=initial_es,
        )

        total_transferred = sum(t.transfer_quantity for t in transfers)
        assert total_transferred == 90.0  # 40 + 35 + 15
        assert rem_es["BR-DVO"] == 10.0   # 100 - 90 = 10
        assert all(rem == 0.0 for rem in rem_nir.values())

    def test_no_over_allocation_under_any_condition(self):
        """Sum of transfers from any donor must NEVER exceed that donor's initial ES."""
        matcher = TransferMatcher()
        initial_es = {"BR-DVO": 45.0, "BR-CEB": 25.0}
        initial_nir = {"BR-CDO": 150.0}  # Demand far exceeds available surplus

        transfers, rem_nir, rem_es = matcher.match_transfers_for_product(
            product_id="STEEL-P1",
            period="2026-12",
            initial_nir=initial_nir,
            initial_es=initial_es,
        )

        dvo_transferred = sum(t.transfer_quantity for t in transfers if t.donor_branch_id == "BR-DVO")
        ceb_transferred = sum(t.transfer_quantity for t in transfers if t.donor_branch_id == "BR-CEB")

        assert dvo_transferred == 45.0
        assert ceb_transferred == 25.0
        assert rem_es["BR-DVO"] == 0.0
        assert rem_es["BR-CEB"] == 0.0
        assert rem_nir["BR-CDO"] == 80.0  # 150 - (45 + 25) = 80 remaining for procurement

    def test_disjoint_donor_and_recipient_invariant_violation_raises(self):
        """A branch cannot be listed as both donor and recipient for the same product."""
        matcher = TransferMatcher()
        initial_nir = {"BR-DVO": 20.0}
        initial_es = {"BR-DVO": 50.0}  # Same branch in both!

        with pytest.raises(ValueError, match="Invariant violation: Branches .* cannot be both donor"):
            matcher.match_transfers_for_product(
                product_id="STEEL-P1",
                period="2026-12",
                initial_nir=initial_nir,
                initial_es=initial_es,
            )

    def test_donor_strategy_nearest_branch(self):
        """Nearest branch strategy prioritizes closest donor with surplus."""
        dist_matrix = {
            ("BR-DVO", "BR-CDO"): 250.0,
            ("BR-CEB", "BR-CDO"): 450.0,
        }
        cfg = RBDSSConfig(
            donor_strategy=DonorStrategy.NEAREST_BRANCH,
            distance_matrix=dist_matrix,
        )
        matcher = TransferMatcher(cfg)

        initial_nir = {"BR-CDO": 20.0}
        # Even though Cebu has more stock (80 vs 30), Davao is closer (250km vs 450km)
        initial_es = {"BR-CEB": 80.0, "BR-DVO": 30.0}

        transfers, _, _ = matcher.match_transfers_for_product(
            product_id="STEEL-P1",
            period="2026-12",
            initial_nir=initial_nir,
            initial_es=initial_es,
        )

        assert len(transfers) == 1
        assert transfers[0].donor_branch_id == "BR-DVO"  # Closer donor chosen first!
        assert transfers[0].transfer_quantity == 20.0

    def test_donor_strategy_priority_list(self):
        """Priority list strategy respects fixed enterprise supply chain hierarchy."""
        cfg = RBDSSConfig(
            donor_strategy=DonorStrategy.PRIORITY_LIST,
            branch_priority=["BR-MND", "BR-CEB", "BR-DVO"],
        )
        matcher = TransferMatcher(cfg)

        initial_nir = {"BR-CDO": 20.0}
        initial_es = {"BR-DVO": 100.0, "BR-MND": 50.0}

        transfers, _, _ = matcher.match_transfers_for_product(
            product_id="STEEL-P1",
            period="2026-12",
            initial_nir=initial_nir,
            initial_es=initial_es,
        )

        assert len(transfers) == 1
        assert transfers[0].donor_branch_id == "BR-MND"  # Prioritized hub chosen first!

