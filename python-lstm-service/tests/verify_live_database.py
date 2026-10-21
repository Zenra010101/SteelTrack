"""Live-database verification for the forecast repository.

Unlike the rest of the test suite, this script talks to a real PostgreSQL
instance. It is intentionally NOT named `test_*` so pytest does not
auto-collect it — running it requires a database to be present.

    python tests/verify_live_database.py

It checks the three things that unit tests cannot:

    1. The repository's SQL actually executes against the real schema.
    2. The columns the repository selects really exist.
    3. The monthly series builder produces sane output.
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import get_settings  # noqa: E402
from src.data.db import get_session  # noqa: E402
from src.data.repository import ForecastRepository  # noqa: E402


async def main() -> int:
    settings = get_settings()
    print("=" * 70)
    print("LIVE DATABASE VERIFICATION")
    print("=" * 70)
    # The URL is printed with the password stripped — never echo credentials.
    safe_url = settings.database_url.split("@")[-1]
    print(f"database host/db : {safe_url}")
    print(f"model dir        : {settings.model_dir}")
    print()

    failures: list[str] = []

    try:
        async with get_session() as session:
            repo = ForecastRepository(session)

            # --- 1. Products / branches ---------------------------------
            print("[1] get_products()")
            products = await repo.get_products()
            print(f"    OK — {len(products)} active products")
            if not products:
                failures.append("no active products found")

            print("[2] get_branches()")
            branches = await repo.get_branches()
            print(f"    OK — {len(branches)} active branches")
            for b in branches:
                print(f"      {b.id}  {b.code}  {b.name}")
            if not branches:
                failures.append("no active branches found")

            # --- 3. Sale items (the main demand query) -------------------
            print("[3] get_sale_items() — the query with expanding bindparams")
            rows = await repo.get_sale_items()
            print(f"    OK — {len(rows)} completed sale line items")
            if rows:
                sample = rows[0]
                print(f"    sample: product={sample.product_id}")
                print(f"            branch={sample.branch_id}")
                print(f"            date={sample.sale_date} qty={sample.quantity}")

            # --- 4. Filtered variants ------------------------------------
            if products and branches:
                print("[4] get_sale_items() with product + branch filters")
                filtered = await repo.get_sale_items(
                    product_ids=[products[0].id],
                    branch_ids=[branches[0].id],
                )
                print(f"    OK — {len(filtered)} rows for the filtered scope")
                for row in filtered[:3]:
                    print(f"      {row.product_id} {row.branch_id} {row.quantity}")

                # --- 5. Monthly series ------------------------------------
                print("[5] get_monthly_series()")
                series = await repo.get_monthly_series(lookback_months=24)
                print(f"    OK — {len(series)} (product, branch) series")
                for key, points in list(series.items())[:5]:
                    nonzero = sum(1 for p in points if p.quantity > 0)
                    total = sum(p.quantity for p in points)
                    print(
                        f"      {key.product_id} @ {key.branch_id}: "
                        f"{len(points)} months, {nonzero} non-zero, {total} units"
                    )
                if not series:
                    failures.append("no monthly series produced")

                # --- 6. Current stock -------------------------------------
                print("[6] get_current_stock()")
                stock = await repo.get_current_stock()
                print(f"    OK — {len(stock)} (product, branch) stock rows")

    except Exception as exc:  # noqa: BLE001
        print(f"\nFAILED: {type(exc).__name__}: {exc}")
        import traceback

        traceback.print_exc()
        failures.append(f"exception: {exc}")

    print()
    print("=" * 70)
    if failures:
        print(f"RESULT: FAILED ({len(failures)} problem(s))")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("RESULT: ALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
