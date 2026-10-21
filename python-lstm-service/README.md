# SteelTrack — LSTM Demand Forecasting Service

Predicts how many units of each product each branch will sell in the next
month, using historical sales transactions. The service is a standalone
Python (FastAPI) microservice that the .NET SteelTrack backend calls over
HTTP; the two are decoupled so the model can be retrained on its own
cadence without a .NET redeploy.

The design and phasing are documented in
[`../IMPLEMENTATION_PLAN_LSTM_FORECASTING.md`](../IMPLEMENTATION_PLAN_LSTM_FORECASTING.md).

---

## How it works

```
PostgreSQL (Sales + SaleItems + Products + Branches)
        │
        ▼
  monthly series per (product, branch)        ← 24-month dense window
        │
        ▼
  log1p → median/IQR scaler → sliding windows  ← zero months = missing, not zero
        │
        ▼
  per-series LSTM  →  (mu, log_sigma) per horizon month
        │
        ▼
  Gaussian NLL training → 95% confidence interval
        │
        ▼
  versioned artifacts on disk  →  GET /predict
```

Each `(product, branch)` pair gets its **own** model. A per-series model beats
a single global model here because steel demand is dominated by product
mix and branch size, and a shared model spends most of its capacity learning
which branch rather than what a given product does at a given branch.

**Seasonal-naive fallback.** Any series that cannot be trained (not enough
history, or a training failure) is served a seasonal-naive estimate instead
of being dropped, so the API always returns complete coverage. The response
is identical in shape either way.

### Model architecture

| | |
|---|---|
| Layers | 2 × LSTM, hidden 64, dropout 0.1 |
| Head | Linear(64→32) → ReLU → Dropout → Linear(32→horizon×2) |
| Output | `(mu, log_sigma)` per horizon step — a Gaussian NLL loss gives calibrated intervals rather than point estimates with a hand-rolled error bar |
| History window | 24 months (configurable, 6–60) |
| Input sequence | 12 months by default — a full yearly cycle, which is the dominant seasonality signal for steel demand. The window shrinks automatically if the series is too short to supply training samples. |
| Horizon | 3 months (configurable, 1–12) |
| Optimiser | AdamW, lr 1e-3, weight decay 1e-5, gradient-norm clipping at 1.0, early stopping on validation NLL (patience 10) |
| Baseline | a seasonal-naive forecast is computed on the *same* validation windows and stored alongside the model's WAPE/MAE/sMAPE in the artifact metrics, so a model that cannot beat "the same month last year" is visible as such. It is reported, not enforced — a series with no model still needs a forecast. |

---

## Layout

```
src/
  main.py                 FastAPI app, API-key dependency, lifespan
  config.py               pydantic-settings; every knob is an env var
  api/
    routes_health.py      GET /health, GET /metrics
    routes_predict.py     GET /predict, GET /predict/versions
    routes_train.py       POST /train, GET /train/status/{id}, GET /train/jobs
    schemas.py            request/response contract (mirrors the .NET DTOs)
  data/
    db.py                 async SQLAlchemy engine + session factory
    repository.py         SQL over the SteelTrack tables; monthly aggregation
    preprocessing.py      scaling, sequence building, train/val split, baseline
  models/
    lstm_model.py         the network
    model_registry.py     versioned on-disk artifacts + manifest
  training/
    pipeline.py           per-series training, baseline comparison, publishing
  inference/
    predictor.py          batched inference + seasonal-naive fallback
    postprocess.py        outlier cap and reorder-advice rules — written but
                          not yet called from the prediction path
  scheduling/
    scheduler.py          APScheduler: nightly retrain + drift check
    drift_detector.py     MAE-ratio + KS test on residuals (the live-actual
                          comparison is not wired up yet — see Phase 6)
  utils/logging.py        structured JSON logging
tests/                    pytest suite + two live verification scripts
```

---

## Setup

Requires Python 3.11 or 3.12 and a reachable PostgreSQL database (the
SteelTrack schema — `Products`, `Branches`, `Sales`, `SaleItems`,
`ProductBatches`).

```bash
cd python-lstm-service

python -m venv .venv
.venv/Scripts/python -m pip install -e ".[dev]"      # Windows
# .venv/bin/pip install -e ".[dev]"                   # Linux/macOS

cp .env.example .env
```

Then edit `.env` — at minimum `DATABASE_URL` and `LSTM_API_KEY`.

> `.env` holds the database connection string and the shared secret. It is
> git-ignored; `.env.example` is the committed template.

### Configuration

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:12345@localhost:5432/SteelTrackDb` | asyncpg connection string |
| `MODEL_DIR` | `./models` | where artifacts are written |
| `LSTM_API_KEY` | `dev-api-key-change-me` | shared secret for `X-LSTM-API-KEY` |
| `LSTM_LOOKBACK_MONTHS` | `24` | months of history per series |
| `LSTM_HORIZON_MONTHS` | `3` | months to forecast |
| `LSTM_BATCH_SIZE` | `32` | series per optimiser step |
| `LSTM_MAX_EPOCHS` | `50` | hard epoch cap (early stopping usually ends sooner) |
| `LSTM_LEARNING_RATE` | `0.001` | AdamW learning rate |
| `LSTM_MIN_HISTORY_MONTHS` | `12` | **months of actual demand** required to train a series |
| `LSTM_METRICS_PORT` | `9090` | Prometheus exporter port |
| `LSTM_RETRAIN_HOUR` | `2` | UTC hour of the nightly retrain |
| `LSTM_ENABLE_SCHEDULER` | `true` | set `false` in CI/dev to disable background jobs |
| `LOG_LEVEL` | `INFO` | Python log level |

`LSTM_MIN_HISTORY_MONTHS` counts **months with demand**, not the length of
the window. A SKU that sold steadily for 12 of the last 24 months is
trainable; a SKU that sold once is not. Lowering it makes more series
trainable at the cost of noisy models — see *Current data situation* below.

---

## Running

```bash
.venv/Scripts/python -m uvicorn src.main:app --host 0.0.0.0 --port 8000
```

Or via the console script installed by the package: `lstm-api`.

With Docker:

```bash
docker compose up --build
```

---

## API

All routes except `/health` and `/metrics` require the header
`X-LSTM-API-KEY: <LSTM_API_KEY>`. A missing or wrong key returns **401**.

### `GET /health`

Liveness probe. No authentication.

```json
{ "status": "healthy", "service": "steeltrack-lstm", "uptime_seconds": null }
```

### `GET /predict`

Forecasts for the requested scope. Omit the filters for everything.

| Query param | Default | Meaning |
|---|---|---|
| `product_ids` | all | repeat or comma-separate UUIDs |
| `branch_ids` | all | repeat or comma-separate UUIDs |
| `horizon_months` | `3` | months ahead (1–12) |
| `model_version` | latest | pin a specific version |

```bash
curl -H "X-LSTM-API-KEY: $LSTM_API_KEY" \
  "http://localhost:8000/predict?horizon_months=1"
```

```json
{
  "predictions": [
    {
      "product_id": "…", "product_sku": "SS-RT202-1-2X1P2", "product_name": "…",
      "branch_id": "…", "branch_code": "BR1",
      "forecast_month": "2026-11-01",
      "predicted_quantity": 18,
      "confidence_lower": 9,
      "confidence_upper": 28,
      "trend": "stable",
      "model_version": "v0.1.0-20261021T091339Z"
    }
  ],
  "model_version": "v0.1.0-20261021T091339Z",
  "generated_at": "2026-10-21T09:13:40.512000+00:00",
  "count": 846
}
```

Invariants the response always satisfies: `predicted_quantity >= 0`,
`confidence_lower <= predicted_quantity <= confidence_upper`,
`trend` ∈ {`up`, `down`, `stable`}.

### `GET /predict/versions`

Every stored model version, newest first, with its manifest (scope, metrics,
creation time).

### `POST /train`

Queues a training run and returns **202** with a job ID. At least one of
`product_ids` / `branch_ids` must be non-empty.

```bash
curl -X POST -H "X-LSTM-API-KEY: $LSTM_API_KEY" -H "Content-Type: application/json" \
  -d '{"product_ids": [], "branch_ids": ["<uuid>"], "lookback_months": 24, "horizon_months": 3}' \
  http://localhost:8000/train
```

Poll `GET /train/status/{job_id}` until `status` is `completed` or `failed`.
`GET /train/jobs` lists recent runs with their summary
(`trained` / `skipped` / `failed`).

---

## Model artifacts

```
models/
  latest.json                        # pointer to the current version
  v0.1.0-20261021T091339Z/
    manifest.json                    # scope, metrics, created_at
    {product_id}__{branch_id}.pt     # state_dict + frozen scaler params
```

The scaler is **frozen at training time** and reused at inference. Refitting
it on serving data would leak information and make historical predictions
irreproducible. The registry is filesystem-backed for now; moving to
S3/Azure Blob + MLflow means reimplementing four methods in
`model_registry.py` and nothing else.

---

## Testing

```bash
.venv/Scripts/python -m pytest -q          # 67 tests, no database required
.venv/Scripts/python -m ruff check src tests
```

The pytest suite is fully offline — it uses synthetic series and a fake
session. Two additional scripts exercise the live system and are **not**
collected by pytest:

```bash
# Exercises every repository query against a real database.
.venv/Scripts/python tests/verify_live_database.py

# Starts a real server, drives the full HTTP flow, checks the invariants.
.venv/Scripts/python tests/verify_api_end_to_end.py
```

`verify_api_end_to_end.py` binds a port of its own; override it with
`LSTM_VERIFY_PORT` if 8022 is taken.

---

## Current data situation

The production dataset currently holds roughly **two months** of sales
(2026-09-29 → 2026-10-17), so no series reaches the default
`LSTM_MIN_HISTORY_MONTHS=12` bar. Every series is therefore served by the
seasonal-naive fallback, and a training run reports `trained: 0,
skipped: 282`.

This is a data-age problem, not a code problem. The LSTM path itself is
proven on synthetic data (WAPE 0.093 against a seasonal-naive 0.284 on a
held-out window). Two ways forward:

1. **Wait** for the history to accumulate — roughly 12 months of real sales.
2. **Lower the bar** (`LSTM_MIN_HISTORY_MONTHS=2`) to train on what exists
   now. The models will be weak, but they will be real and the pipeline is
   the same either way.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `401` on every request | missing/wrong `X-LSTM-API-KEY` | the header value must equal `LSTM_API_KEY` exactly |
| `503 "No model versions available"` | no artifacts on disk yet | `POST /train` first |
| `503 "Model version … contains no artifacts"` | every series was skipped for insufficient history | expected when the data is young; lower `LSTM_MIN_HISTORY_MONTHS` or wait |
| Training job ends `failed` | usually a schema/DB mismatch | read the job error in `GET /train/jobs` and check `DATABASE_URL` |
| `Errno 10048` on startup | a previous server still holds the port | use a different `--port` |
| `async def functions are not natively supported` | `pytest-asyncio` not installed | `uv pip install --python .venv/Scripts/python.exe "pytest-asyncio>=0.24"` |

---

## CI

`.github/workflows/lstm-service.yml` runs the lint + test suite on Python
3.11 and 3.12, then builds the Docker image. It is triggered by pushes and
pull requests that touch `python-lstm-service/**`.
