"""Ingestion, cleaning, and dense monthly series construction from CSV_for_LSTM.

This module processes:
1. `withdrawal_202611021228.csv` (item code, released quantity, price, created date)
2. `withdrawalsummary_202611021224.csv` (header, site code, document date, type, approved status)
3. `withdrawalreturn_202611021224.csv` & `withdrawalreturndetail_202611021224.csv` (returns)

It outputs clean, dense monthly demand series per (product, branch) from 2017 to 2026.
"""

from __future__ import annotations

import logging
import sqlite3
import time
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from uuid import UUID

import numpy as np
import pandas as pd

from src.data.repository import MonthlySeriesPoint, SeriesKey, add_months, month_floor

logger = logging.getLogger(__name__)

# Standard 4 SteelTrack branch UUIDs
BRANCH_DAVAO = UUID("11111111-1111-1111-1111-111111111101")
BRANCH_CAGAYAN = UUID("11111111-1111-1111-1111-111111111102")
BRANCH_CEBU = UUID("11111111-1111-1111-1111-111111111103")
BRANCH_MANDAUE = UUID("11111111-1111-1111-1111-111111111104")

ALL_BRANCH_IDS = [BRANCH_DAVAO, BRANCH_CAGAYAN, BRANCH_CEBU, BRANCH_MANDAUE]

BRANCH_NAMES = {
    BRANCH_DAVAO: "Davao",
    BRANCH_CAGAYAN: "Cagayan De Oro",
    BRANCH_CEBU: "Cebu",
    BRANCH_MANDAUE: "Mandaue",
}

BRANCH_CODES = {
    BRANCH_DAVAO: "BR1",
    BRANCH_CAGAYAN: "BR2",
    BRANCH_CEBU: "BR3",
    BRANCH_MANDAUE: "BR4",
}

# Mapping raw CSV site codes to the 4 SteelTrack branch locations
SITE_TO_BRANCH: dict[str, UUID] = {
    "WB": BRANCH_DAVAO,    # Davao Warehouse / Depot
    "TC": BRANCH_DAVAO,    # Tagum City / Davao
    "WM": BRANCH_DAVAO,    # Davao WM Depot
    "CA": BRANCH_CAGAYAN,  # Cagayan De Oro
    "CS": BRANCH_CEBU,     # Cebu South
    "SW": BRANCH_CEBU,     # South Warehouse (Cebu)
    "LB": BRANCH_CEBU,     # Labangon (Cebu)
    "MS": BRANCH_MANDAUE,  # Mandaue Subangdaku
    "MW": BRANCH_MANDAUE,  # Mandaue Warehouse
}


def find_csv_dir() -> Path:
    """Find CSV_for_LSTM directory."""
    candidates = [
        Path("CSV_for_LSTM"),
        Path(__file__).resolve().parents[3] / "CSV_for_LSTM",
        Path(__file__).resolve().parents[2] / "CSV_for_LSTM",
    ]
    for c in candidates:
        if c.exists() and (c / "withdrawal_202611021228.csv").exists():
            return c.resolve()
    raise FileNotFoundError("CSV_for_LSTM folder not found with required CSV files.")


def get_cache_db_path(csv_dir: Path) -> Path:
    return csv_dir / "monthly_series_cache.sqlite"


def load_and_preprocess_csv(
    csv_dir: Path | None = None, force_recompute: bool = False
) -> pd.DataFrame:
    """Load and aggregate monthly demand points from CSVs, using SQLite cache if fresh."""
    if csv_dir is None:
        csv_dir = find_csv_dir()

    cache_db = get_cache_db_path(csv_dir)
    w_file = csv_dir / "withdrawal_202611021228.csv"

    # Check cache freshness
    if (
        not force_recompute
        and cache_db.exists()
        and cache_db.stat().st_mtime > w_file.stat().st_mtime
    ):
        try:
            logger.info("Loading aggregated monthly series from SQLite cache: %s", cache_db)
            conn = sqlite3.connect(cache_db)
            df = pd.read_sql_query(
                "SELECT item_code, branch_id, year, month, net_quantity, trans_count FROM monthly_points",
                conn,
            )
            conn.close()
            if not df.empty:
                logger.info("Loaded %d monthly records from cache.", len(df))
                return df
        except Exception as exc:
            logger.warning("Failed reading cache (%s), recomputing from CSVs.", exc)

    logger.info("Parsing CSV files from %s...", csv_dir)
    t0 = time.time()

    # 1. Read Returns detail
    wrd_path = csv_dir / "withdrawalreturndetail_202611021224.csv"
    returns = pd.DataFrame(columns=["WithdrawalID", "ReturnedQty"])
    if wrd_path.exists():
        wrd = pd.read_csv(
            wrd_path, usecols=["WithdrawalID", "Quantity"], low_memory=False
        )
        returns = (
            wrd.groupby("WithdrawalID")["Quantity"]
            .sum()
            .reset_index()
            .rename(columns={"Quantity": "ReturnedQty"})
        )

    # 2. Read Withdrawal detail
    w_cols = [
        "WithdrawalID",
        "WithdrawalNo",
        "SiteCodeDetail",
        "ItemCode",
        "ReleasedQuantity",
        "CreatedDate",
    ]
    w = pd.read_csv(w_file, usecols=w_cols, low_memory=False)

    # Join returns & compute net quantity
    w = pd.merge(w, returns, on="WithdrawalID", how="left")
    w["ReturnedQty"] = w["ReturnedQty"].fillna(0)
    w["NetQuantity"] = (
        pd.to_numeric(w["ReleasedQuantity"], errors="coerce").fillna(0) - w["ReturnedQty"]
    ).clip(lower=0)

    # 3. Read Withdrawal Summary
    ws_file = csv_dir / "withdrawalsummary_202611021224.csv"
    ws_cols = ["WithdrawalNo", "SiteCode", "DocumentDate", "Status"]
    ws = pd.read_csv(ws_file, usecols=ws_cols, low_memory=False)

    # Filter for approved transactions only
    ws_approved = ws[ws["Status"] == "A"]

    # 4. Merge details and summary
    merged = pd.merge(w, ws_approved, on="WithdrawalNo", how="inner")

    # 5. Dates
    merged["Date"] = pd.to_datetime(
        merged["DocumentDate"].fillna(merged["CreatedDate"]), errors="coerce"
    )
    merged = merged.dropna(subset=["Date", "ItemCode"])

    # 6. Branch mapping
    raw_site = merged["SiteCodeDetail"].fillna(merged["SiteCode"]).str.strip().str.upper()
    merged["BranchId"] = raw_site.map(
        lambda s: str(SITE_TO_BRANCH.get(s, BRANCH_DAVAO))
    )

    # Filter out empty item codes
    merged["ItemCode"] = merged["ItemCode"].astype(str).str.strip()
    merged = merged[merged["ItemCode"] != ""]

    merged["Year"] = merged["Date"].dt.year
    merged["Month"] = merged["Date"].dt.month

    # Group by (ItemCode, BranchId, Year, Month)
    monthly = (
        merged.groupby(["ItemCode", "BranchId", "Year", "Month"])
        .agg(net_quantity=("NetQuantity", "sum"), trans_count=("WithdrawalID", "count"))
        .reset_index()
    )
    monthly.rename(
        columns={"ItemCode": "item_code", "BranchId": "branch_id", "Year": "year", "Month": "month"},
        inplace=True,
    )

    # Save to SQLite cache
    try:
        conn = sqlite3.connect(cache_db)
        cursor = conn.cursor()
        cursor.execute("DROP TABLE IF EXISTS monthly_points")
        cursor.execute(
            """
            CREATE TABLE monthly_points (
                item_code TEXT,
                branch_id TEXT,
                year INTEGER,
                month INTEGER,
                net_quantity REAL,
                trans_count INTEGER
            )
            """
        )
        cursor.execute("CREATE INDEX idx_item_branch ON monthly_points(item_code, branch_id)")
        monthly.to_sql("monthly_points", conn, if_exists="append", index=False)
        conn.commit()
        conn.close()
        logger.info("Saved monthly series to cache in %.2fs", time.time() - t0)
    except Exception as exc:
        logger.warning("Could not write cache: %s", exc)

    return monthly


def build_dense_series_dict(
    df: pd.DataFrame,
    min_year: int = 2017,
    max_year: int = 2026,
    max_month: int = 10,
) -> dict[tuple[str, UUID], list[MonthlySeriesPoint]]:
    """Convert monthly aggregated table into dense consecutive monthly series.

    Every series spans all months between (min_year, 1) and (max_year, max_month).
    Missing months are filled with 0 quantity.
    """
    months: list[tuple[int, int, date]] = []
    for y in range(min_year, max_year + 1):
        m_end = max_month if y == max_year else 12
        for m in range(1, m_end + 1):
            months.append((y, m, date(y, m, 1)))

    out: dict[tuple[str, UUID], list[MonthlySeriesPoint]] = {}
    grouped = df.groupby(["item_code", "branch_id"])

    for (item_code, branch_id_str), group in grouped:
        branch_id = UUID(str(branch_id_str))
        branch_code = BRANCH_CODES.get(branch_id, "BR1")

        obs = {
            (int(row["year"]), int(row["month"])): int(round(float(row["net_quantity"])))
            for _, row in group.iterrows()
        }

        points: list[MonthlySeriesPoint] = []
        for y, m, d in months:
            qty = obs.get((y, m), 0)
            points.append(
                MonthlySeriesPoint(
                    product_id=UUID("00000000-0000-0000-0000-000000000000"),
                    product_sku=str(item_code),
                    product_name=f"Steel Product ({item_code})",
                    branch_id=branch_id,
                    branch_code=branch_code,
                    month=d,
                    quantity=max(0, qty),
                )
            )

        out[(str(item_code), branch_id)] = points

    return out


_CATALOG_PRODUCTS_CACHE: list[dict] | None = None


def load_catalog_products(db_url: str | None = None) -> list[dict]:
    """Load the 646 SteelTrack products from local DB or client catalog."""
    global _CATALOG_PRODUCTS_CACHE
    if _CATALOG_PRODUCTS_CACHE is not None:
        return _CATALOG_PRODUCTS_CACHE

    products: list[dict] = []
    try:
        import concurrent.futures
        import asyncio
        import asyncpg

        url = db_url or "postgresql://postgres:12345@localhost:5432/gensanpos_restore_clean"

        async def _fetch():
            conn = await asyncpg.connect(url)
            rows = await conn.fetch(
                'SELECT "Id", "Sku", "Name", "CategoryId", "UnitPrice" FROM "Products" ORDER BY "Sku"'
            )
            await conn.close()
            return [dict(r) for r in rows]

        def _run_in_new_loop():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                return loop.run_until_complete(_fetch())
            finally:
                loop.close()

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            products = executor.submit(_run_in_new_loop).result()
    except Exception as exc:
        logger.debug("Could not query DB for products (%s), using catalog file fallback.", exc)

    if not products:
        csv_file = Path("D:/It_Project/Capstone/POS-sa-Gensan/backend/data/client-production-catalog.csv")
        if csv_file.exists():
            df = pd.read_csv(csv_file)
            for _, r in df.iterrows():
                products.append({
                    "Id": None,
                    "Sku": r["SKU"],
                    "Name": r["Name"],
                    "UnitPrice": r.get("UnitPrice", 0),
                })

    if products:
        _CATALOG_PRODUCTS_CACHE = products
    return products


_PRODUCT_ITEM_MAPPING: dict[UUID, str] | None = None
_ITEM_PRODUCT_MAPPING: dict[str, dict] | None = None


def get_product_to_item_mapping(df: pd.DataFrame | None = None) -> tuple[dict[UUID, str], dict[str, dict]]:
    """Build deterministic mapping between 646 SteelTrack products and top CSV items."""
    global _PRODUCT_ITEM_MAPPING, _ITEM_PRODUCT_MAPPING
    if _PRODUCT_ITEM_MAPPING is not None and _ITEM_PRODUCT_MAPPING is not None:
        return _PRODUCT_ITEM_MAPPING, _ITEM_PRODUCT_MAPPING

    if df is None:
        df = load_and_preprocess_csv()

    item_vols = df.groupby("item_code")["net_quantity"].sum().sort_values(ascending=False)
    top_items = item_vols.index.tolist()

    products = load_catalog_products()

    prod_to_item: dict[UUID, str] = {}
    item_to_prod: dict[str, dict] = {}

    for idx, prod in enumerate(products):
        pid = prod["Id"]
        if pid is not None and idx < len(top_items):
            item = top_items[idx]
            prod_to_item[pid] = item
            item_to_prod[item] = prod

    _PRODUCT_ITEM_MAPPING = prod_to_item
    _ITEM_PRODUCT_MAPPING = item_to_prod
    return prod_to_item, item_to_prod


def get_csv_series_for_scope(
    *,
    lookback_months: int = 24,
    product_ids: list[UUID] | None = None,
    branch_ids: list[UUID] | None = None,
    end_month: date | None = None,
) -> dict[SeriesKey, list[MonthlySeriesPoint]]:
    """Retrieve dense monthly series directly from CSV data for the requested scope."""
    df = load_and_preprocess_csv()
    series_dict = build_dense_series_dict(df)
    prod_to_item, item_to_prod = get_product_to_item_mapping(df)

    last = month_floor(end_month or date(2026, 10, 1))
    window_start = add_months(last, -(lookback_months - 1))

    target_branches = branch_ids or ALL_BRANCH_IDS

    products = load_catalog_products()
    prod_lookup = {p["Id"]: p for p in products if p.get("Id")}

    out: dict[SeriesKey, list[MonthlySeriesPoint]] = {}

    # 1. Resolve for product UUIDs
    target_prods = product_ids or list(prod_lookup.keys())

    for pid in target_prods:
        item_code = prod_to_item.get(pid)
        prod_meta = prod_lookup.get(pid, {})
        sku = prod_meta.get("Sku", str(item_code or pid))
        name = prod_meta.get("Name", f"Product {sku}")

        for bid in target_branches:
            bcode = BRANCH_CODES.get(bid, "BR1")
            key = SeriesKey(product_id=pid, branch_id=bid)

            # Look up CSV series
            raw_pts = series_dict.get((str(item_code), bid), []) if item_code else []
            obs_map = {p.month: p.quantity for p in raw_pts}

            pts: list[MonthlySeriesPoint] = []
            for i in range(lookback_months):
                m = add_months(window_start, i)
                qty = obs_map.get(m, 0)
                pts.append(
                    MonthlySeriesPoint(
                        product_id=pid,
                        product_sku=sku,
                        product_name=name,
                        branch_id=bid,
                        branch_code=bcode,
                        month=m,
                        quantity=qty,
                    )
                )

            out[key] = pts

    return out
