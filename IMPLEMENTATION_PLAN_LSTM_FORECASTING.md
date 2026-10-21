# SteelTrack — LSTM Demand Forecasting Engine Implementation Plan

> **Goal**: Replace mock forecasts with a production-grade **Python LSTM service** that consumes historical `Sale`/`SaleItem` data from PostgreSQL and predicts **monthly unit demand per (Product × Branch)** for the next 1–3 months, with confidence intervals.

---

## 1. High-Level Architecture

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  PostgreSQL         │     │  Python LSTM Service │     │  .NET API / Frontend│
│  (SteelTrackDb)     │────▶│  (FastAPI + PyTorch) │────▶│  (OwnerForecastView)│
│  • Sales            │     │  • Training Pipeline │     │  • Swagger /api/v1/ │
│  • SaleItems        │     │  • Inference API     │     │    forecast/lstm    │
│  • Products         │     │  • Model Registry    │     └─────────────────────┘
│  • Branches         │     │  • Monitoring        │            ▲
└─────────────────────┘     └──────────────────────┘            │
                                                                │ async HTTP
                                                 ┌────────────────┴────────────────┐
                                                 │  Background Jobs (Hangfire /    │
                                                 │  Quartz / Python APScheduler)  │
                                                 │  • Nightly retrain             │
                                                 │  • Drift detection             │
                                                 └────────────────────────────────┘
```

**Key Design Decisions**
- **Python microservice** (FastAPI) — keeps ML stack isolated from .NET, enables GPU, easy model versioning.
- **Per-(Product×Branch) models** — each SKU at each branch gets its own lightweight LSTM (or shared global model with embeddings).
- **Monthly granularity** — aligns with business planning cadence; input sequence = 24 months, forecast horizon = 3 months.
- **Model registry + artifact store** — local filesystem (MVP) → S3/MinIO later; MLflow optional.
- **Contract-first API** — OpenAPI spec shared between Python and .NET; .NET calls Python via `HttpClient`.

---

## 2. Data Contracts

### 2.1 Training Input (Python reads directly from PostgreSQL)

| Table | Columns Used |
|-------|--------------|
| `Sale` | `Id`, `BranchId`, `CreatedAt`, `Status`, `IsArchived` |
| `SaleItem` | `SaleId`, `ProductId`, `Quantity`, `UnitPrice` |
| `Product` | `Id`, `Sku`, `Name`, `CategoryId`, `IsActive` |
| `Branch` | `Id`, `Name`, `Code`, `IsActive` |

**Derived monthly series per (Product, Branch)**:
- `ds` = first day of month (UTC)
- `y` = sum of `Quantity` for completed, non-archived sales
- Exogenous features (optional v2): `promo_flag`, `holiday_count`, `steel_price_index`

### 2.2 Python ↔ .NET API Contract (OpenAPI)

```yaml
# POST /api/v1/forecast/train
requestBody:
  application/json:
    schema:
      type: object
      properties:
        product_ids:  { type: array, items: { type: string, format: uuid } }
        branch_ids:   { type: array, items: { type: string, format: uuid } }
        lookback_months: { type: integer, default: 24 }
        horizon_months:  { type: integer, default: 3 }
        retrain: { type: boolean, default: false }
      required: [product_ids, branch_ids]

responses:
  202:
    description: Training job accepted
    content:
      application/json:
        schema:
          type: object
          properties:
            job_id: { type: string }
            status: { type: string, enum: [queued, running, completed, failed] }
            model_version: { type: string }
            estimated_completion: { type: string, format: date-time }

---

# GET /api/v1/forecast/predict
parameters:
  - name: product_ids; in: query; schema: { type: array, items: { type: string, format: uuid } }
  - name: branch_ids;  in: query; schema: { type: array, items: { type: string, format: uuid } }
  - name: horizon_months; in: query; schema: { type: integer, default: 3 }
  - name: model_version; in: query; schema: { type: string }  # optional; "latest" if omitted
responses:
  200:
    content:
      application/json:
        schema:
          type: object
          properties:
            predictions:
              type: array
              items:
                type: object
                properties:
                  product_id:   { type: string, format: uuid }
                  product_sku:  { type: string }
                  product_name: { type: string }
                  branch_id:    { type: string, format: uuid }
                  branch_code:  { type: string }
                  forecast_month: { type: string, format: date }  # first day of month
                  predicted_quantity: { type: integer }
                  confidence_lower: { type: integer }
                  confidence_upper: { type: integer }
                  trend: { type: string, enum: [up, down, stable] }
                  model_version: { type: string }
```

---

## 3. Python Service — Module Layout

```
python-lstm-service/
├── pyproject.toml                 # Poetry / uv config
├── Dockerfile
├── docker-compose.yml             # Local dev: API + Postgres + Redis
├── .env.example
├── src/
│   ├── config.py                  # Pydantic Settings (DB URL, model dir, etc.)
│   ├── main.py                    # FastAPI app + lifespan (load models)
│   ├── api/
│   │   ├── routes_train.py        # POST /train
│   │   ├── routes_predict.py      # GET /predict
│   │   ├── routes_health.py       # GET /health, /metrics
│   │   └── schemas.py             # Pydantic request/response models
│   ├── data/
│   │   ├── db.py                  # SQLAlchemy async engine + session
│   │   ├── repository.py          # Read-only queries for training/inference
│   │   └── preprocessing.py       # Series construction, scaling, train/val split
│   ├── models/
│   │   ├── lstm_model.py          # PyTorch LightningModule
│   │   ├── model_registry.py      # Save/load/version models to disk
│   │   └── ensemble.py            # (v2) Global model with embeddings
│   ├── training/
│   │   ├── pipeline.py            # End-to-end train loop per (product, branch)
│   │   ├── callbacks.py           # EarlyStopping, ModelCheckpoint, LR monitor
│   │   └── hyperparameters.py     # Optuna search space (optional)
│   ├── inference/
│   │   ├── predictor.py           # Batch prediction with confidence intervals
│   │   └── postprocess.py         # Business rules: min 0, round, cap at stock
│   ├── scheduling/
│   │   ├── scheduler.py           # APScheduler nightly retrain
│   │   └── drift_detector.py      # KS-test / MAE threshold alerting
│   └── utils/
│       ├── logging.py             # Structured JSON logs
│       └── metrics.py             # Prometheus counters/histograms
├── tests/
│   ├── test_preprocessing.py
│   ├── test_lstm_model.py
│   ├── test_api_predict.py
│   └── fixtures/
└── scripts/
    ├── bootstrap_db.py            # Create sample data for local dev
    └── export_onnx.py             # Export to ONNX for .NET ML.NET (future)
```

---

## 4. Core ML Design

### 4.1 Model Architecture (per series)

```
Input:  [Batch, SeqLen=24, Features=1]  →  monthly quantities (log1p scaled)
         │
         ▼
LSTM( hidden=64, num_layers=2, dropout=0.1, batch_first=True )
         │
         ▼
Linear(64 → 32) → ReLU → Dropout(0.1)
         │
         ▼
Linear(32 → Horizon*2)  # outputs: [mu, log_sigma] for each horizon step
```

- **Loss**: Gaussian NLL (`mu`, `sigma`) → gives calibrated confidence intervals.
- **Scaler**: `RobustScaler` (median/IQR) fit on training window; persisted with model.
- **Sequence length**: 24 months (2 years) — captures seasonality.
- **Horizon**: 3 months (configurable).
- **Training**: 80/20 temporal split; early stopping on val NLL (patience=10).
- **Batch size**: 32 series per step (pad shorter series with `NaN` + mask).

### 4.2 Cold-Start Strategy

| Scenario | Handling |
|----------|----------|
| New product (no history) | Global model (v2) or category-level average + expert prior |
| New branch | Transfer learning: fine-tune global model on first 3 months |
| Sparse series (< 6 months) | Hierarchical Bayesian shrinkage toward category mean (v2) |

**MVP**: Only train per-series models where ≥ 12 months of data exist; fall back to seasonal naive (same month last year) for others.

### 4.3 Confidence Intervals

- Predictive distribution: `y ~ Normal(mu, sigma)` per horizon step.
- 95% CI = `mu ± 1.96 * sigma`.
- Clamp: `lower = max(0, floor(lower))`, `upper = ceil(upper)`.
- Trend label: compare `mu[t]` vs `mu[t-1]` → `up` / `down` / `stable` (±5%).

---

## 5. .NET Integration

### 5.1 New DTOs (Application/DTOs/Forecast/)

```csharp
// ForecastRequestDto.cs
public class ForecastRequestDto
{
    public Guid[]? ProductIds { get; set; }
    public Guid[]? BranchIds  { get; set; }
    public int HorizonMonths { get; set; } = 3;
    public string? ModelVersion { get; set; }   // null = latest
}

// ForecastPredictionDto.cs  (matches Python response)
public class ForecastPredictionDto
{
    public Guid ProductId { get; set; }
    public string ProductSku { get; set; } = "";
    public string ProductName { get; set; } = "";
    public Guid BranchId { get; set; }
    public string BranchCode { get; set; } = "";
    public DateOnly ForecastMonth { get; set; }       // 1st of month
    public int PredictedQuantity { get; set; }
    public int ConfidenceLower { get; set; }
    public int ConfidenceUpper { get; set; }
    public string Trend { get; set; } = "stable";     // up, down, stable
    public string ModelVersion { get; set; } = "";
}
```

### 5.2 New Interface & Service

```csharp
// Application/Interfaces/IForecastService.cs
public interface IForecastService
{
    Task<IReadOnlyList<ForecastPredictionDto>> GetForecastAsync(
        ForecastRequestDto request, CancellationToken ct = default);

    Task<string> TriggerRetrainAsync(Guid[] productIds, Guid[] branchIds, CancellationToken ct);
    Task<TrainingJobStatusDto> GetTrainingStatusAsync(string jobId, CancellationToken ct);
}

// Infrastructure/Services/ForecastService.cs
public class ForecastService : IForecastService
{
    private readonly HttpClient _http;        // named "PythonForecastApi"
    private readonly ILogger<ForecastService> _log;

    public async Task<IReadOnlyList<ForecastPredictionDto>> GetForecastAsync(...)
    {
        var query = BuildQuery(request);
        var resp = await _http.GetFromJsonAsync<ForecastResponse>($"/api/v1/forecast/predict?{query}");
        return resp?.Predictions ?? [];
    }
}
```

### 5.3 DI Registration (API/Program.cs)

```csharp
builder.Services.AddHttpClient("PythonForecastApi", c =>
{
    c.BaseAddress = new Uri(builder.Configuration["Forecast:PythonApiUrl"] ?? "http://localhost:8001");
    c.Timeout = TimeSpan.FromSeconds(30);
    c.DefaultRequestHeaders.Add("X-API-Key", builder.Configuration["Forecast:ApiKey"]);
})
.AddStandardResilienceHandler();  // Polly retries, circuit breaker

builder.Services.AddScoped<IForecastService, ForecastService>();
```

### 5.4 New Controller Endpoint (API/Controllers/ForecastController.cs)

```csharp
[ApiController]
[Route("api/v1/forecast")]
[Authorize(Roles = "Owner,BranchManager")]  // Cashier doesn't need forecast
public class ForecastController : ControllerBase
{
    private readonly IForecastService _svc;

    [HttpGet("lstm")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<ForecastPredictionDto>>>>
        GetLstmForecast([FromQuery] ForecastRequestDto request, CancellationToken ct)
    {
        var result = await _svc.GetForecastAsync(request, ct);
        return Ok(ApiResponse<IReadOnlyList<ForecastPredictionDto>>.Ok(result));
    }

    [HttpPost("train")]
    public async Task<ActionResult<ApiResponse<TrainingJobDto>>>
        TriggerRetrain([FromBody] ForecastTrainRequestDto request, CancellationToken ct)
    {
        var jobId = await _svc.TriggerRetrainAsync(request.ProductIds, request.BranchIds, ct);
        return Accepted(ApiResponse<TrainingJobDto>.Ok(new TrainingJobDto { JobId = jobId, Status = "queued" }));
    }
}
```

### 5.5 Frontend Integration

- Update `frontend/src/services/api.ts` → add `fetchLstmForecast(request)` calling `/api/v1/forecast/lstm`.
- Update `OwnerForecastView.tsx` to:
  - Call real API instead of mock.
  - Support multi-product, multi-branch selection (checkboxes).
  - Show per-product cards with predicted qty + CI + trend badge.
  - Keep the **Post-LSTM Decision Support Rules** (they consume the predictions).

---

## 6. Infrastructure & Deployment

### 6.1 Docker Compose (Local Dev)

```yaml
# python-lstm-service/docker-compose.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: SteelTrackDb
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: 12345
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  lstm-api:
    build: .
    ports: ["8001:8000"]
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:12345@postgres:5432/SteelTrackDb
      MODEL_DIR: /models
      API_KEY: ${FORECAST_API_KEY:-dev-key}
      LOG_LEVEL: INFO
    volumes:
      - ./models:/models
      - ./src:/app/src
    depends_on: [postgres, redis]
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

volumes:
  pgdata:
  models:
```

### 6.2 Production (Azure / AWS / On-Prem)

| Component | Recommendation |
|-----------|----------------|
| Container | Azure Container Apps / AWS ECS Fargate / Kubernetes |
| GPU | A10G / T4 spot instances for training; CPU for inference |
| Model Store | Azure Blob / S3 + MLflow (versioning, lineage) |
| Scheduler | Azure Functions Timer / AWS EventBridge / Hangfire in .NET |
| Monitoring | Prometheus + Grafana (Python `/metrics`), App Insights / CloudWatch |
| Secrets | Key Vault / Secrets Manager (DB password, API keys) |

### 6.3 CI/CD (GitHub Actions)

```yaml
# .github/workflows/lstm-service.yml
on:
  push:
    paths: ['python-lstm-service/**']
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
      - run: uv sync --group test
      - run: uv run pytest -q

  docker:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/build-push-action@v5
        with:
          context: ./python-lstm-service
          push: true
          tags: ghcr.io/${{ github.repository }}/steeltrack-lstm:${{ github.sha }}
```

---

## 7. Implementation Phases & Effort

| Phase | Deliverable | Est. Effort | Dependencies |
|-------|-------------|-------------|--------------|
| **0. Scaffold** | Repo, Poetry env, FastAPI skeleton, Dockerfile, CI | 4h | — |
| **1. Data Access** | SQLAlchemy models + repository queries (monthly series per product×branch) | 8h | Phase 0 |
| **2. Preprocessing** | Series builder, RobustScaler, train/val split, DataLoader with masking | 8h | Phase 1 |
| **3. LSTM Model** | PyTorch Lightning module, Gaussian NLL loss, early stopping | 12h | Phase 2 |
| **4. Training Pipeline** | Per-series loop, model registry (save/load versioned artifacts), Optuna (optional) | 16h | Phase 3 |
| **5. Inference API** | `/predict` endpoint, batch prediction, CI calc, post-process | 8h | Phase 4 |
| **6. Scheduling & Monitoring** | APScheduler nightly job, drift detection (KS-test), Prometheus metrics | 8h | Phase 5 |
| **7. .NET Integration** | DTOs, `IForecastService`, `HttpClient`, `ForecastController`, DI, config | 12h | Phase 5 |
| **8. Frontend Wiring** | `api.ts` update, `OwnerForecastView` real data, multi-select UI | 8h | Phase 7 |
| **9. Hardening** | Integration tests, load test (locust), GPU inference benchmark, docs | 12h | Phase 8 |
| **Total** | **MVP** | **~96h (2.5 weeks solo / 1.5 weeks pair)** | |

---

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Insufficient history for many SKUs | High | Medium | Cold-start fallback (seasonal naive); hierarchical model v2 |
| Non-stationary demand (price shocks, new competitors) | Medium | High | Drift detector → auto-retrain alert; rolling 24-mo window |
| GPU cost / availability | Low | Medium | CPU inference is fast (<50ms/series); train nightly on spot GPU |
| Python ↔ .NET latency | Low | Low | Async calls, 30s timeout, cache predictions 1h in Redis |
| Model artifacts drift across deploys | Medium | Medium | Versioned model registry; `/predict?model_version=X` |
| Data leakage (future sales in train) | Low | Critical | Temporal split only; unit test enforces `CreatedAt < cutoff` |

---

## 9. Acceptance Criteria (Definition of Done)

- [ ] **Python service** builds, passes `pytest -q`, `docker compose up` runs healthy.
- [ ] **Training** completes for ≥ 100 (product×branch) series in < 20 min on T4 GPU.
- [ ] **Inference** p95 < 200 ms for 500 series batch on CPU.
- [ ] **.NET endpoint** `/api/v1/forecast/lstm` returns valid JSON matching `ForecastPredictionDto[]`.
- [ ] **Frontend** `OwnerForecastView` shows real predictions, confidence bands, trend badges.
- [ ] **Nightly job** retrains dirty models; drift alert fires in Grafana when MAE ↑ > 20%.
- [ ] **Documentation**: OpenAPI spec at `/openapi.json`, README with runbook.

---

## 10. Next Steps (Immediate)

1. **Create `python-lstm-service/`** scaffold (Phase 0).
2. **Add SQLAlchemy models** mirroring `Sale`, `SaleItem`, `Product`, `Branch` (read-only).
3. **Write `repository.get_monthly_series(product_ids, branch_ids, lookback_months)`** — the single most important query.
4. **Spike**: Train one LSTM on a real series in a notebook; validate NLL < baseline (seasonal naive).
5. **Parallelize**: While spike runs, start .NET DTOs + `IForecastService` interface.

---

## Appendix: Minimal `pyproject.toml` (Poetry / uv)

```toml
[project]
name = "steeltrack-lstm"
version = "0.1.0"
description = "SteelTrack LSTM Demand Forecasting Service"
requires-python = ">=3.11"
dependencies = [
    "fastapi==0.115.*",
    "uvicorn[standard]==0.32.*",
    "pydantic==2.9.*",
    "pydantic-settings==2.6.*",
    "sqlalchemy==2.0.*",
    "asyncpg==0.29.*",
    "pandas==2.2.*",
    "numpy==2.1.*",
    "scikit-learn==1.5.*",
    "torch==2.5.*",
    "lightning==2.5.*",
    "optuna==4.1.*",          # optional hyperparam search
    "apscheduler==3.11.*",
    "prometheus-client==0.20.*",
    "python-json-logger==2.0.*",
]

[tool.uv.sources]
torch = { index = "pytorch", marker = "sys_platform != 'win32'" }  # GPU wheels

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"
```

---

*End of Plan* — ready to scaffold Phase 0 when you say go.