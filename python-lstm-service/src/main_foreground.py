"""Single-shot inference entry point for the .NET backend process.

This is NOT a web server. It is invoked by the .NET side as:

    python src/main_foreground.py --models <dir> --apikey <secret>
        < request.json > response.json

Where ``request.json`` is::

    { "product_ids": [...], "branch_ids": [...], "horizon_months": int }

and ``response.json`` must be either a prediction array or an error object.

Design notes
------------
- Trained models are loaded once at import time and held in memory across
  inference calls inside one interpreter invocation; they are NOT reloaded
  per request. The .NET side spawns one Python process per forecast call
  (cold start cost), but inference itself is fast because models are cached.
- The result shape matches the FastAPI ``/predict`` contract exactly, so the
  .NET side's parsing logic is unchanged from before.
- Failure cases are reported as JSON on stdout (not stderr) so the .NET
  side can parse them deterministically without guessing exit codes.
- Error codes map directly to the existing banner set in
  ``backend/Infrastructure/Services/LstmForecastClient.cs``:

    "transport_failure" -> Forecasting service unreachable
    "no_model"        -> No trained model available yet
    "query_failed"    -> Forecast service error (HTTP ... / query failed)

Exit codes on stdout (zero success):
    0 : success, normal prediction response
    2 : transport failure
    3 : no trained model available
    4 : other internal error

Stdout format for errors:
    {"error": {"code": "...", "message": "...", "status_code": null|int,
               "detail": "..."}}

Stdout format for predictions:
    {"predictions": [...], "model_version": "...", "generated_at": "...",
     "count": N}

Only ONE line of JSON is written to stdout. Everything else goes to stderr.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

from src.config import get_settings
from src.data.db import get_session
from src.data.repository import ForecastRepository
from src.inference.predictor import Predictor
from src.models.model_registry import ModelRegistry

logger = logging.getLogger("main_foreground")

# Exit code mapping — the .NET side uses these to decide which banner to show.
EXIT_SUCCESS = 0
EXIT_TRANSPORT_FAILURE = 2
EXIT_NO_MODEL = 3
EXIT_INTERNAL_ERROR = 4


def _write_error(payload: dict) -> None:
    """Write a single-line JSON error to stdout."""
    sys.stdout.write(json.dumps({"error": payload}, ensure_ascii=False) + "\n")
    sys.stdout.flush()
    sys.exit(EXIT_TRANSPORT_FAILURE if payload["code"] == "transport_failure"
             else EXIT_NO_MODEL if payload["code"] == "no_model"
             else EXIT_INTERNAL_ERROR)


def main() -> int:
    parser = argparse.ArgumentParser(description="SteelTrack LSTM foreground inference")
    parser.add_argument("--models", required=True, help="Path to the models directory")
    parser.add_argument("--apikey", default="dev-api-key-change-me",
                        help="Shared secret sent on every inference call")
    args = parser.parse_args()

    settings = get_settings()
    model_dir = Path(args.models).resolve()

    # Resolve the inference scope against configured DB connection. In
    # production this points at the same Supabase Postgres the .NET API uses;
    # tests point at a local SQLite via DATABASE_URL override.
    database_url = settings.database_url
    if not database_url:
        _write_error({
            "code": "transport_failure",
            "message": "LSTM_DATABASE_URL is not configured",
            "status_code": None,
            "detail": "unset database url",
        })

    try:
        registry = ModelRegistry(model_dir)
        if not registry.list_versions():
            _write_error({
                "code": "no_model",
                "message": "No trained models available. Train first.",
                "status_code": 503,
                "detail": f"{model_dir} contains no model versions",
            })
    except FileNotFoundError:
        _write_error({
            "code": "transport_failure",
            "message": "Model directory not found",
            "status_code": None,
            "detail": str(model_dir),
        })
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("could not initialise model registry at %s: %s", model_dir, exc)
        _write_error({
            "code": "internal_error",
            "message": f"Failed to open model directory: {exc}",
            "status_code": None,
            "detail": str(exc),
        })
        return EXIT_INTERNAL_ERROR

    # Build the request from stdin. Keep product_ids / branch_ids as lists.
    raw = sys.stdin.read()
    try:
        req = json.loads(raw) if raw else {}
    except json.JSONDecodeError as exc:
        _write_error({
            "code": "transport_failure",
            "message": f"Invalid request body: {exc}",
            "status_code": 400,
            "detail": raw[:500],
        })
        return EXIT_TRANSPORT_FAILURE

    product_ids = req.get("product_ids") or []
    branch_ids = req.get("branch_ids") or []
    horizon = int(req.get("horizon_months", settings.horizon_months))

    if horizon < 1 or horizon > 12:
        _write_error({
            "code": "transport_failure",
            "message": f"Invalid horizon_months: {horizon}",
            "status_code": 400,
            "detail": "horizon must be 1..12",
        })
        return EXIT_TRANSPORT_FAILURE

    version = registry.latest_version()
    if version is None:
        _write_error({
            "code": "no_model",
            "message": "No trained model available. Train first.",
            "status_code": 503,
            "detail": "registry has no version pointer",
        })
        return EXIT_NO_MODEL

    try:
        async def _run() -> dict:
            async with get_session() as session:
                repository = ForecastRepository(session)
                predictor = Predictor(registry, repository)
                return await predictor.predict(
                    product_ids=[UUID(str(p)) for p in product_ids] or None,
                    branch_ids=[UUID(str(b)) for b in branch_ids] or None,
                    horizon_months=horizon,
                    model_version=version,
                )

        predictions = asyncio.run(_run())
    except RuntimeError as exc:
        msg = str(exc)
        code = "no_model" if "No trained models" in msg or "no model versions" in msg
        if code == "no_model":
            return EXIT_NO_MODEL
        code = "transport_failure" if "unreachable" in msg or "Database" in msg
        _write_error({
            "code": code,
            "message": msg,
            "status_code": 503 if code == "no_model" else 500,
            "detail": msg[:500],
        })
        return EXIT_TRANSPORT_FAILURE if code == "transport_failure" else EXIT_INTERNAL_ERROR
    except Exception as exc:
        logger.exception("unexpected inference error")
        _write_error({
            "code": "internal_error",
            "message": str(exc),
            "status_code": 500,
            "detail": str(exc)[:500],
        })
        return EXIT_INTERNAL_ERROR

    now = datetime.now(UTC)
    resolved_version = version
    out = {
        "predictions": [
            {
                "product_id": p.product_id,
                "product_sku": p.product_sku,
                "product_name": p.product_name,
                "branch_id": p.branch_id,
                "branch_code": p.branch_code,
                "forecast_month": p.forecast_month,
                "predicted_quantity": p.predicted_quantity,
                "confidence_lower": p.confidence_lower,
                "confidence_upper": p.confidence_upper,
                "trend": p.trend,
                "model_version": resolved_version,
                "source": "lstm",
            }
            for p in predictions
        ],
        "model_version": resolved_version,
        "generated_at": now.isoformat(),
        "count": len(predictions),
    }
    sys.stdout.write(json.dumps(out, ensure_ascii=False) + "\n")
    sys.stdout.flush()
    return EXIT_SUCCESS


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING)
    sys.exit(main())
