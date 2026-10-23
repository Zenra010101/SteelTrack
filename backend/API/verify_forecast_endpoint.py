"""Verify GET /api/products/lstm-forecast end to end.

Logs in against the locally-running .NET API, calls the forecast
endpoint, and reports the source breakdown so it is visible whether the
numbers came from the trained LSTM or from the fallback estimate.

The credentials are read from the tracked DataSeeder source rather than
hardcoded here, and nothing sensitive is printed.

    python verify_forecast_endpoint.py
"""

import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter

BASE = os.environ.get("STEELTRACK_API", "http://127.0.0.1:5199")
SEEDER = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..",
    "Infrastructure",
    "Persistence",
    "DataSeeder.cs",
)


def seeded_owner_credentials():
    """Pull the demo owner account out of the tracked seeder source."""
    with open(SEEDER, encoding="utf-8") as fh:
        source = fh.read()

    # The seeder's user table lists the account as
    #   (Email: "...", Name: "...", RoleId: ..., BranchId: ..., Password: "...")
    entry = re.search(
        r'\(Email:\s*"(?P<email>[^"]*owner[^"]*)".*?Password:\s*"(?P<password>[^"]+)"\)',
        source,
        re.DOTALL,
    )
    if not entry:
        raise SystemExit("could not find the demo owner account in DataSeeder.cs")
    return entry.group("email"), entry.group("password")


def post_json(path, payload, token=None):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{BASE}{path}", data=data, method="POST",
        headers={"Content-Type": "application/json"},
    )
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read())


def get_json(path, token):
    req = urllib.request.Request(f"{BASE}{path}")
    req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=300) as resp:
        return json.loads(resp.read())


def main() -> int:
    email, password = seeded_owner_credentials()
    print(f"login as     : {email}")

    try:
        body = post_json("/api/auth/login", {"email": email, "password": password})
    except urllib.error.HTTPError as exc:
        print(f"login failed : HTTP {exc.code} {exc.read()[:300]}")
        return 1

    data = body.get("data") or body
    token = (
        data.get("token")
        or body.get("token")
        or (body.get("data") or {}).get("accessToken")
    )
    if not token:
        print(f"no token in login response: {json.dumps(body)[:400]}")
        return 1
    print("login        : OK")

    query = urllib.parse.urlencode(
        {
            "fromMonth": "2026-04-01",
            "toMonth": "2027-01-01",
        }
    )
    resp = get_json(f"/api/products/lstm-forecast?{query}", token)
    forecast = resp.get("data") or resp

    rows = forecast.get("forecasts") or []
    sources = Counter(r.get("source") for r in rows)

    print(f"rows         : {len(rows)}")
    print(f"count field  : {forecast.get('count')}")
    print(f"modelVersion : {forecast.get('modelVersion')}")
    print(f"reachable    : {forecast.get('serviceReachable')}")
    print(f"fallback flag: {forecast.get('serviceFallback')}")
    print(f"sources      : {dict(sources)}")

    # The downstream diagnostics the UI turns into per-cause messages: a
    # 401 here means the shared API key was rejected, a 503 means there is
    # no trained model, and null means the service never answered at all.
    print(f"svc status   : {forecast.get('serviceStatusCode')}")
    print(f"svc error    : {forecast.get('serviceError')}")

    # Forecast-region coverage. The history months in the window are never
    # model-eligible, so the percentage the UI shows is computed from the
    # forecast region only.
    window = forecast.get("forecastWindowCount") or 0
    win_fallback = forecast.get("forecastFallbackCount") or 0
    print(f"forecast rows: {window} (fallback {win_fallback})")

    if rows:
        first = rows[0]
        print(
            "sample row   : "
            f"{first.get('productSku')} {first.get('month')} "
            f"qty={first.get('predictedQuantity')} "
            f"band=[{first.get('confidenceLower')},{first.get('confidenceUpper')}] "
            f"actual={first.get('actualQuantity')} "
            f"source={first.get('source')} "
            f"trend={first.get('trend')}"
        )
        months = sorted({r.get("month") for r in rows})
        print(f"months       : {months}")

        # Per-month source breakdown. The service only forecasts forward
        # from the current month, so earlier months in the range are
        # expected to be served by the legacy estimate.
        by_month = Counter((r.get("month"), r.get("source")) for r in rows)
        print("by month     :")
        for (month, source), count in sorted(by_month.items()):
            print(f"                {month}  {source:<14} {count}")

    # A forecast with no rows at all would mean the whole chain is broken.
    if not rows:
        print("RESULT: FAIL — the endpoint returned no forecast rows")
        return 1

    print("RESULT: OK — the endpoint served forecast rows")
    return 0


if __name__ == "__main__":
    sys.exit(main())
