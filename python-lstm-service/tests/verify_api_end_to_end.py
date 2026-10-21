"""End-to-end verification of the HTTP API against a live database.

Unlike the pytest suite, this starts a real uvicorn server, triggers a
training run over HTTP, polls for completion, and checks the prediction
response. It is the only test that exercises the full stack the way the
.NET backend will.

    python tests/verify_api_end_to_end.py

The API key is read through the application's own settings object — it is
never echoed to stdout.
"""

import asyncio
import json
import os
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import get_settings  # noqa: E402

# The port is configurable so this can run against a freshly started server
# without colliding with one that is already listening.
PORT = os.environ.get("LSTM_VERIFY_PORT", "8022")
BASE = f"http://127.0.0.1:{PORT}"


async def main() -> int:
    settings = get_settings()
    headers = {"X-LSTM-API-KEY": settings.api_key}
    failures: list[str] = []

    # The training endpoint requires a non-empty scope, so pull real
    # branch IDs straight from the database rather than hardcoding them.
    from src.data.db import get_session
    from src.data.repository import ForecastRepository

    async with get_session() as session:
        repo = ForecastRepository(session)
        branches = await repo.get_branches()
        branch_ids = [str(b.id) for b in branches]

    print(f"scope: {len(branch_ids)} branch(es)")
    print()

    async with httpx.AsyncClient(base_url=BASE, timeout=60.0) as client:
        # --- Auth is enforced ------------------------------------------
        print("[1] auth: request without a key must be rejected")
        r = await client.get("/predict")
        print(f"    HTTP {r.status_code}")
        if r.status_code != 401:
            failures.append(f"unauthenticated /predict returned {r.status_code}, expected 401")

        print("[2] auth: request with a wrong key must be rejected")
        r = await client.get("/predict", headers={"X-LSTM-API-KEY": "not-the-key"})
        print(f"    HTTP {r.status_code}")
        if r.status_code != 401:
            failures.append(f"wrong-key /predict returned {r.status_code}, expected 401")

        print("[3] health: must be reachable without a key")
        r = await client.get("/health")
        print(f"    HTTP {r.status_code} — {json.dumps(r.json())[:160]}")
        if r.status_code != 200:
            failures.append(f"/health returned {r.status_code}")

        # --- Trigger a training run ------------------------------------
        print("[4] POST /train — triggering a full retraining run")
        r = await client.post(
            "/train",
            headers=headers,
            json={
                "product_ids": [],
                "branch_ids": branch_ids,
                "lookback_months": 24,
                "horizon_months": 3,
            },
        )
        print(f"    HTTP {r.status_code}")
        if r.status_code != 202:
            failures.append(f"POST /train returned {r.status_code}: {r.text[:300]}")
            print(f"    body: {r.text[:300]}")
            return report(failures)

        job = r.json()
        job_id = job["job_id"]
        print(f"    job_id = {job_id}")

        # --- Poll for completion ----------------------------------------
        print("[5] polling GET /train/status/{job_id}")
        final = None
        for attempt in range(60):
            await asyncio.sleep(2)
            r = await client.get(f"/train/status/{job_id}", headers=headers)
            status = r.json().get("status")
            if attempt % 5 == 0:
                print(f"    [{attempt * 2:>3}s] {status}")
            if status in ("completed", "failed"):
                final = status
                break

        print(f"    final status: {final}")
        if final != "completed":
            failures.append(f"training job ended with status {final!r}")

        # --- Job details ------------------------------------------------
        r = await client.get("/train/jobs", headers=headers)
        jobs = r.json().get("jobs", [])
        if jobs:
            j = jobs[0]
            summary = j.get("summary") or {}
            error = j.get("error")
            print(f"[6] job summary: {summary}")
            if error:
                print(f"    error: {error}")
                failures.append(f"training job reported an error: {error}")
            if summary.get("failed"):
                failures.append(f"{summary['failed']} series failed to train")

        # --- Versions ---------------------------------------------------
        print("[7] GET /predict/versions")
        r = await client.get("/predict/versions", headers=headers)
        data = r.json()
        print(f"    HTTP {r.status_code} — {data.get('count')} version(s), latest={data.get('latest')}")

        # --- Predictions ------------------------------------------------
        print("[8] GET /predict")
        r = await client.get("/predict", headers=headers)
        print(f"    HTTP {r.status_code}")
        if r.status_code != 200:
            failures.append(f"GET /predict returned {r.status_code}: {r.text[:300]}")
        else:
            data = r.json()
            print(f"    {data['count']} predictions, model_version={data.get('model_version')}")
            for p in data["predictions"][:5]:
                print(
                    f"      {p['product_sku']:<28} {p['branch_code']:<5} "
                    f"{p['forecast_month']}  qty={p['predicted_quantity']:>4} "
                    f"[{p['confidence_lower']}, {p['confidence_upper']}] {p['trend']}"
                )
            # Every prediction must satisfy the documented invariants.
            for p in data["predictions"]:
                if p["predicted_quantity"] < 0:
                    failures.append("negative predicted_quantity")
                    break
                if not (p["confidence_lower"] <= p["predicted_quantity"] <= p["confidence_upper"]):
                    failures.append(
                        f"point forecast {p['predicted_quantity']} outside CI "
                        f"[{p['confidence_lower']}, {p['confidence_upper']}]"
                    )
                    break
                if p["trend"] not in ("up", "down", "stable"):
                    failures.append(f"invalid trend {p['trend']!r}")
                    break

    return report(failures)


def report(failures: list[str]) -> int:
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
