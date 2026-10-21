"""Tests for the repository's series aggregation (no database required)."""

from datetime import UTC, date, datetime
from uuid import uuid4

import pytest

from src.data.repository import (
    ForecastRepository,
    SaleItemRow,
    SeriesKey,
)

PRODUCT_A = uuid4()
PRODUCT_B = uuid4()
BRANCH_X = uuid4()
BRANCH_Y = uuid4()


def row(product_id, branch_id, when: datetime, qty: int) -> SaleItemRow:
    return SaleItemRow(
        product_id=product_id,
        branch_id=branch_id,
        sale_date=when,
        quantity=qty,
    )


@pytest.fixture
def repo() -> ForecastRepository:
    """A repository instance with no session — the aggregation is pure."""
    return ForecastRepository(session=None)  # type: ignore[arg-type]


class TestBuildMonthlySeries:
    def test_sums_quantities_within_a_month(self, repo):
        rows = [
            row(PRODUCT_A, BRANCH_X, datetime(2025, 1, 5, tzinfo=UTC), 3),
            row(PRODUCT_A, BRANCH_X, datetime(2025, 1, 20, tzinfo=UTC), 4),
        ]
        series = repo.build_monthly_series(
            rows, lookback_months=3, end_month=date(2025, 3, 1)
        )
        key = SeriesKey(product_id=PRODUCT_A, branch_id=BRANCH_X)
        points = series[key]
        assert points[0].quantity == 7  # January
        assert points[0].month == date(2025, 1, 1)

    def test_zero_fills_missing_months(self, repo):
        rows = [
            row(PRODUCT_A, BRANCH_X, datetime(2025, 1, 5, tzinfo=UTC), 3),
        ]
        series = repo.build_monthly_series(
            rows, lookback_months=3, end_month=date(2025, 3, 1)
        )
        key = SeriesKey(product_id=PRODUCT_A, branch_id=BRANCH_X)
        points = series[key]
        assert len(points) == 3
        assert [p.month for p in points] == [
            date(2025, 1, 1),
            date(2025, 2, 1),
            date(2025, 3, 1),
        ]
        assert points[1].quantity == 0
        assert points[2].quantity == 0

    def test_keeps_series_separate_per_branch(self, repo):
        rows = [
            row(PRODUCT_A, BRANCH_X, datetime(2025, 1, 5, tzinfo=UTC), 3),
            row(PRODUCT_A, BRANCH_Y, datetime(2025, 1, 5, tzinfo=UTC), 9),
        ]
        series = repo.build_monthly_series(
            rows, lookback_months=2, end_month=date(2025, 2, 1)
        )
        assert len(series) == 2
        x_points = series[SeriesKey(product_id=PRODUCT_A, branch_id=BRANCH_X)]
        y_points = series[SeriesKey(product_id=PRODUCT_A, branch_id=BRANCH_Y)]
        assert x_points[0].quantity == 3
        assert y_points[0].quantity == 9

    def test_excludes_rows_outside_the_window(self, repo):
        rows = [
            row(PRODUCT_A, BRANCH_X, datetime(2024, 1, 5, tzinfo=UTC), 100),
            row(PRODUCT_A, BRANCH_X, datetime(2025, 2, 5, tzinfo=UTC), 5),
        ]
        series = repo.build_monthly_series(
            rows, lookback_months=2, end_month=date(2025, 2, 1)
        )
        key = SeriesKey(product_id=PRODUCT_A, branch_id=BRANCH_X)
        points = series[key]
        assert len(points) == 2
        assert sum(p.quantity for p in points) == 5  # the 2024 row is outside

    def test_excludes_rows_with_no_branch(self, repo):
        rows = [
            row(PRODUCT_A, None, datetime(2025, 1, 5, tzinfo=UTC), 50),
        ]
        series = repo.build_monthly_series(
            rows, lookback_months=2, end_month=date(2025, 2, 1)
        )
        assert series == {}

    def test_window_length_matches_lookback(self, repo):
        rows = [
            row(PRODUCT_A, BRANCH_X, datetime(2025, 1, 5, tzinfo=UTC), 3),
        ]
        for lookback in (6, 12, 24):
            series = repo.build_monthly_series(
                rows, lookback_months=lookback, end_month=date(2025, 3, 1)
            )
            key = SeriesKey(product_id=PRODUCT_A, branch_id=BRANCH_X)
            assert len(series[key]) == lookback
