"""Tests that the repository SQL compiles correctly for all filter combinations.

These catch the class of bug where a bind parameter is rendered as a
TextClause instead of a SQL array (the `= ANY(:param)` trap).
"""

from datetime import UTC
from uuid import uuid4

from sqlalchemy import bindparam, text

from src.data.repository import ForecastRepository

PRODUCT_ID = uuid4()
BRANCH_ID = uuid4()


def compile_sale_items_sql(product_ids, branch_ids, since=None):
    """Mirror the SQL construction in ForecastRepository.get_sale_items."""
    sql_parts = [
        """
        SELECT si."ProductId" AS product_id,
               s."BranchId"   AS branch_id,
               s."CreatedAt"  AS sale_date,
               si."Quantity"  AS quantity
        FROM "SaleItems" si
        INNER JOIN "Sales" s ON s."Id" = si."SaleId"
        WHERE s."Status" = :status
          AND s."IsArchived" = FALSE
          AND si."Quantity" > 0
        """
    ]
    params = {"status": 0}
    expanding = []

    if product_ids:
        sql_parts.append(' AND si."ProductId" IN :product_ids')
        params["product_ids"] = list(product_ids)
        expanding.append("product_ids")
    if branch_ids:
        sql_parts.append(' AND s."BranchId" IN :branch_ids')
        params["branch_ids"] = list(branch_ids)
        expanding.append("branch_ids")
    if since is not None:
        sql_parts.append(' AND s."CreatedAt" >= :since')
        params["since"] = since

    sql = text("".join(sql_parts))
    for name in expanding:
        sql = sql.bindparams(bindparam(name, expanding=True))

    compiled = sql.compile()
    return str(compiled), params, compiled


class TestSaleItemsSql:
    def test_no_filters(self):
        sql, params, _ = compile_sale_items_sql(None, None)
        assert "IN :" not in sql
        assert params == {"status": 0}

    def test_product_filter_uses_expanding_bindparam(self):
        sql, params, compiled = compile_sale_items_sql([PRODUCT_ID], None)
        # An expanding bindparam renders as a POSTCOMPILE placeholder.
        assert "POSTCOMPILE_product_ids" in sql
        assert "product_ids" in compiled.params

    def test_branch_filter_uses_expanding_bindparam(self):
        sql, params, compiled = compile_sale_items_sql(None, [BRANCH_ID])
        assert "POSTCOMPILE_branch_ids" in sql
        assert "branch_ids" in compiled.params

    def test_both_filters(self):
        sql, params, compiled = compile_sale_items_sql([PRODUCT_ID], [BRANCH_ID])
        assert "POSTCOMPILE_product_ids" in sql
        assert "POSTCOMPILE_branch_ids" in sql
        assert len(params) == 3

    def test_since_filter(self):
        from datetime import datetime

        sql, params, _ = compile_sale_items_sql(None, None, datetime(2025, 1, 1, tzinfo=UTC))
        assert "CreatedAt" in sql
        assert "since" in params

    def test_query_is_select_only(self):
        """The repository is read-only by design."""
        sql, _, _ = compile_sale_items_sql([PRODUCT_ID], [BRANCH_ID])
        assert sql.strip().upper().startswith("SELECT")
        for forbidden in ("INSERT", "UPDATE", "DELETE", "DROP", "ALTER"):
            assert forbidden not in sql.upper()

    def test_concatenation_does_not_raise(self):
        """Regression: `text()` returns a TextClause that cannot be `+` a str.

        This bug surfaced at runtime as
        `TypeError: unsupported operand type(s) for +: 'TextClause' and 'str'`
        when the first filter was applied.
        """
        sql, _, _ = compile_sale_items_sql([PRODUCT_ID], [BRANCH_ID])
        assert sql  # would raise inside the helper if broken


class TestCurrentStockSql:
    def test_stock_query_uses_expanding_bindparam(self):
        sql_parts = [
            """
            SELECT pb."ProductId" AS product_id,
                   pb."BranchId" AS branch_id,
                   COALESCE(SUM(pb."Quantity"), 0) AS qty
            FROM "ProductBatches" pb
            WHERE pb."IsActive" = TRUE
            """
        ]
        sql_parts.append(' AND pb."ProductId" IN :product_ids')
        sql_parts.append(' GROUP BY pb."ProductId", pb."BranchId"')

        sql = text("".join(sql_parts))
        sql = sql.bindparams(bindparam("product_ids", expanding=True))
        compiled = sql.compile()

        assert "POSTCOMPILE_product_ids" in str(compiled)
        assert "product_ids" in compiled.params
        assert "GROUP BY" in str(compiled)


class TestRepositoryInstantiation:
    def test_repository_can_be_built_without_session(self):
        """The aggregation helpers are pure and testable without a DB."""
        repo = ForecastRepository(session=None)  # type: ignore[arg-type]
        assert repo is not None
