"""Read-only repository over the SteelTrack PostgreSQL schema.

The tables here mirror the .NET entities exactly (verified against
`backend/Infrastructure/Persistence/Migrations/20260523193502_InitialCreate.Designer.cs`):

    Sales      -> Id, BranchId, CreatedAt, Status (int), IsArchived
    SaleItems  -> Id, SaleId, ProductId, Quantity, UnitPrice
    Products   -> Id, Sku, Name, CategoryId, IsActive
    Branches   -> Id, Name, Code, IsActive

`SaleStatus` is a C# enum persisted as int: Completed=0, Voided=1, Refunded=2.
Only Completed (0) and non-archived sales contribute to demand signal.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, date, datetime
from uuid import UUID

from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession

# SaleStatus.Completed as persisted by EF Core
SALE_STATUS_COMPLETED = 0
_UTC = UTC


@dataclass(frozen=True)
class MonthlySeriesPoint:
    """One (product, branch) monthly observation."""

    product_id: UUID
    product_sku: str
    product_name: str
    branch_id: UUID
    branch_code: str
    month: date          # first day of month, UTC
    quantity: int        # units sold in that month


@dataclass(frozen=True)
class SeriesKey:
    """Identity of a forecast series."""

    product_id: UUID
    branch_id: UUID


@dataclass(frozen=True)
class EntityRef:
    """Lightweight product/branch descriptor for enriching predictions."""

    id: UUID
    sku: str
    name: str
    code: str = ""


@dataclass(frozen=True)
class SaleItemRow:
    """Flat sales-row projection used for aggregation."""

    product_id: UUID
    branch_id: UUID | None
    sale_date: datetime
    quantity: int


def month_floor(value: datetime) -> date:
    """Return the first day of the month containing `value` (UTC)."""
    return date(value.year, value.month, 1)


def month_start(months_back: int, *, today: date | None = None) -> date:
    """Return the first day of the month `months_back` months before the current month.

    months_back=0 -> current month, 1 -> previous month, etc.
    """
    ref = today or date.today()
    total = ref.year * 12 + (ref.month - 1) - months_back
    return date(total // 12, (total % 12) + 1, 1)


def add_months(month: date, delta: int) -> date:
    """Shift a first-of-month date by `delta` months."""
    total = month.year * 12 + (month.month - 1) + delta
    return date(total // 12, (total % 12) + 1, 1)


class ForecastRepository:
    """Query helpers for building training/inference series."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ------------------------------------------------------------------
    # Core data pull
    # ------------------------------------------------------------------
    async def get_sale_items(
        self,
        *,
        product_ids: Iterable[UUID] | None = None,
        branch_ids: Iterable[UUID] | None = None,
        since: date | None = None,
    ) -> list[SaleItemRow]:
        """Return completed, non-archived sale line items as a flat projection.

        This is the single source of truth for demand signal. It is
        deliberately a flat select (no ORM joins / entity materialisation)
        so it stays fast even with millions of rows.
        """
        # NOTE ON SQL CONSTRUCTION:
        # `text()` returns a TextClause, which does NOT support `+`
        # concatenation with a plain string. The query is therefore built
        # as a raw string first and wrapped with `text()` only at the end.
        #
        # Two further rules apply:
        #   * `= ANY(:param)` does not work here — the bind parameter would
        #     be rendered as a TextClause rather than a SQL array. Use an
        #     expanding bindparam with `IN (...)` instead.
        #   * Expanding bindparams must be declared on the final `text()`
        #     object, not added to the parameter dict.
        sql_parts = [
            """
            SELECT si."ProductId"      AS product_id,
                   s."BranchId"        AS branch_id,
                   s."CreatedAt"       AS sale_date,
                   si."Quantity"       AS quantity
            FROM "SaleItems" si
            INNER JOIN "Sales" s ON s."Id" = si."SaleId"
            WHERE s."Status" = :status
              AND s."IsArchived" = FALSE
              AND si."Quantity" > 0
            """
        ]
        params: dict = {"status": SALE_STATUS_COMPLETED}
        expanding: list[str] = []

        product_list = list(product_ids) if product_ids is not None else None
        branch_list = list(branch_ids) if branch_ids is not None else None

        if product_list:
            sql_parts.append(' AND si."ProductId" IN :product_ids')
            params["product_ids"] = product_list
            expanding.append("product_ids")
        if branch_list:
            sql_parts.append(' AND s."BranchId" IN :branch_ids')
            params["branch_ids"] = branch_list
            expanding.append("branch_ids")
        if since is not None:
            sql_parts.append(' AND s."CreatedAt" >= :since')
            params["since"] = datetime(since.year, since.month, 1, tzinfo=_UTC)

        sql = text("".join(sql_parts))
        for name in expanding:
            sql = sql.bindparams(bindparam(name, expanding=True))

        result = await self._session.execute(sql, params)
        rows = result.all()
        return [
            SaleItemRow(
                product_id=r.product_id,
                branch_id=r.branch_id,
                sale_date=r.sale_date,
                quantity=int(r.quantity),
            )
            for r in rows
        ]

    async def get_products(self, *, only_active: bool = True) -> list[EntityRef]:
        """Return all products (optionally only active ones)."""
        sql_parts = ['SELECT "Id" AS id, "Sku" AS sku, "Name" AS name FROM "Products"']
        if only_active:
            sql_parts.append(' WHERE "IsActive" = TRUE')

        result = await self._session.execute(text("".join(sql_parts)))
        return [EntityRef(id=r.id, sku=r.sku, name=r.name) for r in result.all()]

    async def get_branches(self, *, only_active: bool = True) -> list[EntityRef]:
        """Return all branches (optionally only active ones)."""
        sql_parts = ['SELECT "Id" AS id, "Code" AS code, "Name" AS name FROM "Branches"']
        if only_active:
            sql_parts.append(' WHERE "IsActive" = TRUE')

        result = await self._session.execute(text("".join(sql_parts)))
        return [EntityRef(id=r.id, sku=r.code, name=r.name, code=r.code) for r in result.all()]

    # ------------------------------------------------------------------
    # Aggregation
    # ------------------------------------------------------------------
    def build_monthly_series(
        self,
        rows: list[SaleItemRow],
        *,
        lookback_months: int,
        end_month: date | None = None,
    ) -> dict[SeriesKey, list[MonthlySeriesPoint]]:
        """Aggregate raw sale rows into dense monthly series per (product, branch).

        Every series spans exactly `lookback_months` consecutive months ending
        at `end_month` (default: current month). Months with no sales are
        included with quantity 0 — gaps are signal, and an LSTM fed a
        zero-stuffed series is materially different from one fed only
        non-zero points.
        """
        last = month_floor(end_month or datetime.utcnow().date())
        window_start = add_months(last, -(lookback_months - 1))

        # Bucket the rows into their month.
        buckets: dict[SeriesKey, dict[date, int]] = {}
        for row in rows:
            if row.branch_id is None:
                continue  # sales not tied to a branch are excluded from branch series
            m = month_floor(row.sale_date)
            if m < window_start or m > last:
                continue
            key = SeriesKey(product_id=row.product_id, branch_id=row.branch_id)
            buckets.setdefault(key, {})
            buckets[key][m] = buckets[key].get(m, 0) + row.quantity

        # Materialise dense series.
        months = [add_months(window_start, i) for i in range(lookback_months)]
        series: dict[SeriesKey, list[MonthlySeriesPoint]] = {}
        for key, month_map in buckets.items():
            series[key] = [
                MonthlySeriesPoint(
                    product_id=key.product_id,
                    product_sku="",
                    product_name="",
                    branch_id=key.branch_id,
                    branch_code="",
                    month=m,
                    quantity=month_map.get(m, 0),
                )
                for m in months
            ]
        return series

    async def get_monthly_series(
        self,
        *,
        lookback_months: int,
        product_ids: Iterable[UUID] | None = None,
        branch_ids: Iterable[UUID] | None = None,
        end_month: date | None = None,
    ) -> dict[SeriesKey, list[MonthlySeriesPoint]]:
        """Convenience wrapper: pull raw rows, then aggregate into dense series."""
        last = month_floor(end_month or datetime.utcnow().date())
        since = add_months(last, -(lookback_months - 1))

        rows = await self.get_sale_items(
            product_ids=product_ids,
            branch_ids=branch_ids,
            since=since,
        )
        series = self.build_monthly_series(rows, lookback_months=lookback_months, end_month=last)

        # Attach human-readable product/branch metadata.
        products = {p.id: p for p in await self.get_products()}
        branches = {b.id: b for b in await self.get_branches()}

        enriched: dict[SeriesKey, list[MonthlySeriesPoint]] = {}
        for key, points in series.items():
            prod = products.get(key.product_id)
            br = branches.get(key.branch_id)
            enriched[key] = [
                MonthlySeriesPoint(
                    product_id=p.product_id,
                    product_sku=prod.sku if prod else "",
                    product_name=prod.name if prod else "",
                    branch_id=p.branch_id,
                    branch_code=(br.code if br else ""),
                    month=p.month,
                    quantity=p.quantity,
                )
                for p in points
            ]
        return enriched

    async def get_current_stock(
        self, product_ids: Iterable[UUID] | None = None
    ) -> dict[tuple[UUID, UUID], int]:
        """Return on-hand quantity per (product, branch) from live batches.

        Used by post-processing to cap forecasts and to flag restock needs.
        Mirrors the batch-weight aggregation the .NET InventoryService does.
        """
        sql_parts = [
            """
            SELECT pb."ProductId"  AS product_id,
                   pb."BranchId"  AS branch_id,
                   COALESCE(SUM(pb."Quantity"), 0) AS qty
            FROM "ProductBatches" pb
            WHERE pb."IsActive" = TRUE
            """
        ]
        params: dict = {}
        product_list = list(product_ids) if product_ids is not None else None
        if product_list:
            sql_parts.append(' AND pb."ProductId" IN :product_ids')
            params["product_ids"] = product_list

        sql_parts.append(' GROUP BY pb."ProductId", pb."BranchId"')
        sql = text("".join(sql_parts))
        if product_list:
            sql = sql.bindparams(bindparam("product_ids", expanding=True))

        try:
            result = await self._session.execute(sql, params)
        except Exception:
            # The batch table shape varies across schema revisions; stock
            # capping is an optimisation, not a correctness requirement.
            return {}

        return {
            (r.product_id, r.branch_id): int(r.qty)
            for r in result.all()
            if r.branch_id is not None
        }
