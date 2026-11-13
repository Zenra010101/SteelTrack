"""Tests for the training pipeline's series-eligibility gate.

The pipeline decides which (product, branch) series get an LSTM. That
decision is driven by the `min_history_months` setting, so it needs to
be covered directly — a silently-ignored setting here means every series
in production quietly trains on garbage or silently never trains.
"""

from datetime import date
from uuid import uuid4

import pytest

from src.data.repository import MonthlySeriesPoint, SeriesKey, add_months
from src.models.model_registry import ModelRegistry
from src.training.pipeline import train_series

PRODUCT_ID = uuid4()
BRANCH_ID = uuid4()
START = date(2024, 1, 1)


def make_series(quantities: list[int]) -> list[MonthlySeriesPoint]:
    """Build a dense monthly series."""
    return [
        MonthlySeriesPoint(
            product_id=PRODUCT_ID,
            product_sku="SKU-1",
            product_name="Test Product",
            branch_id=BRANCH_ID,
            branch_code="DAV",
            month=add_months(START, i),
            quantity=q,
        )
        for i, q in enumerate(quantities)
    ]


@pytest.fixture
def registry(tmp_path) -> ModelRegistry:
    return ModelRegistry(tmp_path)


class TestSeriesEligibility:
    async def test_series_below_min_history_is_skipped(self, registry):
        """Too little demand history -> skipped, not trained, not failed."""
        series = {
            SeriesKey(product_id=PRODUCT_ID, branch_id=BRANCH_ID): make_series([5, 0, 0, 0])
        }

        summary = await train_series(
            series,
            lookback=24,
            horizon=3,
            version="v0.1.0-test",
            registry=registry,
        )

        assert summary.trained == 0
        assert summary.failed == 0
        assert summary.skipped == 1

        result = summary.results[0]
        assert result.status == "skipped_insufficient_history"
        # The skip reason must say how much history was needed, so an
        # operator can tell "no data yet" from "not enough months".
        from src.config import get_settings
        assert result.metrics["required_months"] == get_settings().min_history_months
        assert result.metrics["nonzero_months"] == 1

    async def test_empty_series_is_skipped(self, registry):
        series = {
            SeriesKey(product_id=PRODUCT_ID, branch_id=BRANCH_ID): make_series([0, 0, 0, 0])
        }

        summary = await train_series(
            series,
            lookback=24,
            horizon=3,
            version="v0.1.0-test",
            registry=registry,
        )

        assert summary.skipped == 1
        assert summary.results[0].status == "skipped_insufficient_history"

    async def test_one_bad_series_does_not_abort_the_run(self, registry):
        """A single failing series must not take the whole run down."""
        good = SeriesKey(product_id=uuid4(), branch_id=uuid4())
        bad = SeriesKey(product_id=uuid4(), branch_id=uuid4())

        series = {
            good: make_series([10] * 24),
            bad: make_series([1, 0, 0, 0]),
        }

        summary = await train_series(
            series,
            lookback=24,
            horizon=3,
            version="v0.1.0-test",
            registry=registry,
        )

        # The good series trains; the sparse one is skipped.
        assert summary.trained == 1
        assert summary.skipped == 1
        assert summary.failed == 0
        assert summary.results[0].status == "trained"

    async def test_scope_filtering_excludes_unrequested_series(self, registry):
        """product_ids / branch_ids must actually restrict the run."""
        wanted_product = uuid4()
        other_product = uuid4()

        series = {
            SeriesKey(product_id=wanted_product, branch_id=BRANCH_ID): make_series([10] * 24),
            SeriesKey(product_id=other_product, branch_id=BRANCH_ID): make_series([10] * 24),
        }

        summary = await train_series(
            series,
            lookback=24,
            horizon=3,
            version="v0.1.0-test",
            registry=registry,
            product_ids=[wanted_product],
        )

        assert summary.trained == 1
        assert summary.results[0].key.product_id == wanted_product


class TestArtifactKeyLookup:
    """Regression cover for the trained-model lookup in the predictor.

    The registry keys its artifacts by a plain ``(product_id, branch_id)``
    tuple, while the series collection is keyed by the ``SeriesKey``
    dataclass. The two hash identically but compare unequal, so a lookup
    made with the wrong one silently misses and every series falls back
    to seasonal-naive — the trained model is never actually served.

    The test drives the real ``Predictor.predict`` path and asserts on the
    ``source`` field, because that is the only place the distinction
    between "served the trained LSTM" and "fell back" is observable.
    """

    def test_series_key_does_not_match_tuple_key(self):
        """Guard the premise: the two key forms must not be interchangeable."""
        key = SeriesKey(product_id=PRODUCT_ID, branch_id=BRANCH_ID)
        assert key != (PRODUCT_ID, BRANCH_ID)

    async def test_predictor_serves_trained_model_not_fallback(self, registry):
        """A series with a trained artifact must be served by the LSTM."""
        from src.inference.predictor import Predictor

        series = {
            SeriesKey(product_id=PRODUCT_ID, branch_id=BRANCH_ID): make_series([10] * 24),
        }

        summary = await train_series(
            series,
            lookback=24,
            horizon=3,
            version="v0.1.0-keylookup",
            registry=registry,
        )
        assert summary.trained == 1, "fixture must actually train a model"

        class _StubRepository:
            """Returns the trained series regardless of the requested scope."""

            async def get_monthly_series(self, **_kwargs):
                return series

        predictor = Predictor(registry, _StubRepository())
        predictions = await predictor.predict(model_version="v0.1.0-keylookup")

        assert predictions, "predictor must return predictions"
        sources = {p.source for p in predictions}
        assert sources == {"lstm"}, (
            "expected the trained LSTM to serve every prediction, "
            f"got sources={sources}"
        )
