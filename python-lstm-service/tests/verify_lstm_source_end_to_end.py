"""Verify the full train -> predict path serves trained models, over HTTP.

The local dataset only spans two months of sales, so the default
`min_history_months` gate of 12 skips every series. Start the service with
`LSTM_MIN_HISTORY_MONTHS=1` to exercise the real training and inference
path end-to-end.

The API key is read through the application's own settings object — it is
never echoed to stdout.

    LSTM_MIN_HISTORY_MONTHS=1 LSTM_ENABLE_SCHEDULER=false python tests/verify_lstm_source_end_to_end.py
"""

import asyncio
import os
import sys
from collections import Counter
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import get_settings  # noqa: E402

PORT = os.environ.get("LSTM_VERIFY_PORT", "8044")
BASE = f"http://127.0.0.1:{PORT}"


async def main() -> int:
    settings = get_settings()
    headers = {"X-LSTM-API-KEY": settings.api_key}
    failures: list[str] = []

    async with httpx.AsyncClient(base_url=BASE, timeout=300.0) as client:
        r = await client.get("/health", headers=headers)
        print(f"[1] health: HTTP {r.status_code}")
        if r.status_code != 200:
            failures.append(f"/health returned {r.status_code}")

        # The training endpoint needs a non-empty scope, so pull the real
        # branch IDs from the database rather than hardcoding them.
        from src.data.db import get_session
        from src.data.repository import ForecastRepository

        async with get_session() as session:
            repo = ForecastRepository(session)
            branch_ids = [str(b.id) for b in await repo.get_branches()]

        print(f"[2] scope: {len(branch_ids)} branch(es)")

        r = await client.post(
            "/train",
            headers=headers,
            json={
                "product_ids": [],
                "branch_ids": branch_ids,
                "lookback_months": settings.lookback_months,
                "horizon_months": settings.horizon_months,
            },
        )
        print(f"[3] POST /train: HTTP {r.status_code}")
        if r.status_code != 202:
            print(f"    body: {r.text[:300]}")
            return 1

        job_id = r.json()["job_id"]

        print("[4] polling GET /train/status/{job_id}")
        final = None
        for _ in range(150):
            await asyncio.sleep(2)
            r = await client.get(f"/train/status/{job_id}", headers=headers)
            status = r.json().get("status")
            if status in {"completed", "failed"}:
                final = status
                break
        print(f"    final status: {final}")
        if final != "completed":
            failures.append(f"training ended with status {final!r}")

        # POST /predict — the form the .NET API uses. A scope of several
        # hundred product UUIDs is a ~30 KB query string, so the scope
        # belongs in a body.
        r = await client.post(
            "/predict",
            headers=headers,
            json={
                "product_ids": [],
                "branch_ids": branch_ids,
                "horizon_months": settings.horizon_months,
            },
        )
        print(f"[5] POST /predict: HTTP {r.status_code}")
        if r.status_code != 200:
            print(f"    body: {r.text[:300]}")
            failures.append(f"POST /predict returned {r.status_code}")
        else:
            body = r.json()
            predictions = body["predictions"]
            print(f"    {len(predictions)} predictions, model_version={body['model_version']}")

            # Every prediction must state which engine produced it. A row
            # served by the seasonal-naive fallback carries
            # source="seasonal_naive"; a row served by the trained model
            # carries source="lstm". This is the only field that
            # distinguishes the two, so the check asserts on it directly
            # rather than inferring from model_version.
            sources = Counter(p.get("source") for p in predictions)
            print(f"    sources: {dict(sources)}")

            if not predictions:
                failures.append("POST /predict returned no predictions")
            if None in sources:
                failures.append(f"{sources[None]} predictions carry no source field")
            if sources.get("lstm", 0) == 0:
                failures.append(
                    "no prediction was served by the trained LSTM "
                    f"(sources={dict(sources)}) — the trained model is "
                    "still being bypassed"
                )

    print()
    if failures:
        for failure in failures:
            print(f"FAIL: {failure}")
        print("RESULT: FAILED")
        return 1

    print("RESULT: ALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
