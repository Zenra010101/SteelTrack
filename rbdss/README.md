# SteelTrack Rule-Based Decision Support System (RBDSS)

A high-performance, deterministic decision support engine for multi-branch steel inventory management. The RBDSS operates downstream of the SteelTrack PyTorch LSTM demand forecasting model, ingesting forecasted demand alongside real-time warehouse inventory to produce auditable inter-branch transfer recommendations and procurement purchase orders.

---

## 1. Mathematical Formulation

The engine executes the following formulas per branch, per product, and per planning period:

$$\begin{aligned}
\text{PAS} &= \text{Current Stock} + \text{Incoming Stock} - \text{Reserved/Allocated Stock} \\
\text{RS}  &= \text{Forecasted Demand} + \text{Safety Stock} \\
\text{NIR} &= \max(0, \text{RS} - \text{PAS}) \\
\text{ES}  &= \max(0, \text{PAS} - \text{RS}) \\
\text{TQ}  &= \min(\text{ES}_{\text{donor}}, \text{NIR}_{\text{recipient}}) \\
\text{PQ}  &= \max(0, \text{NIR} - \text{TQ})
\end{aligned}$$

### Invariant Verification
A branch cannot simultaneously hold surplus stock and deficit stock:
$$\text{NIR} \cdot \text{ES} = 0$$

---

## 2. The 5 Inventory Decision Rules

1. **Rule 1 (Sufficient Inventory)**:
   $$\text{PAS} \ge \text{RS} \implies \text{NIR} = 0$$
   * **Action**: `KEEP` (maintain current inventory; excess $\text{ES} = \text{PAS} - \text{RS}$ is made available for inter-branch transfer).
2. **Rule 2 (Inventory Shortage)**:
   $$\text{PAS} < \text{RS} \implies \text{NIR} = \text{RS} - \text{PAS} > 0$$
   * Triggers an enterprise-wide search across other branches holding $\text{ES} > 0$.
3. **Rule 3 (Inter-Branch Transfer)**:
   $$\text{NIR} > 0 \quad \text{AND} \quad \text{Network Available ES} \ge \text{NIR}$$
   * **Action**: `TRANSFER` ($\text{TQ} = \text{NIR}, \text{PQ} = 0$). Internal stock transfers take strict priority over procurement.
4. **Rule 4 (Partial Transfer + Procurement)**:
   $$\text{NIR} > 0 \quad \text{AND} \quad 0 < \text{Network Available ES} < \text{NIR}$$
   * **Action**: `TRANSFER + PROCURE` ($\text{TQ} = \text{Available ES}, \text{PQ} = \text{NIR} - \text{TQ}$).
5. **Rule 5 (Procurement)**:
   $$\text{NIR} > 0 \quad \text{AND} \quad \text{Network Available ES} = 0$$
   * **Action**: `PROCURE` ($\text{TQ} = 0, \text{PQ} = \text{NIR}$). External supplier purchase order generated.

> [!NOTE]
> All generated recommendations are flagged with `status: "Pending Management Approval"` and include plain-language reasoning for supply chain auditability.

---

## 3. Project Directory Structure

```
rbdss/
├── __init__.py             # Public API exports
├── config.py               # RBDSSConfig, DonorStrategy, RoundingMode
├── models.py               # Dataclass entities (BranchRecommendation, TransferItem, etc.)
├── calculations.py         # Pure mathematical formulas (PAS, RS, NIR, ES, TQ, PQ)
├── rules.py                # IF-THEN rules and rationale generation
├── transfer_matcher.py     # Multi-branch donor-recipient greedy matching engine
├── adapter.py              # Forecast ingestion, negative clipping, rounding, LSTM hooks
├── pipeline.py             # Main entry point: run_rbdss(forecast_df, inventory_df, config)
├── exporters.py            # DataFrame, CSV, and JSON exporters
├── sample_data.py          # Reference dataset triggering all 5 canonical rules
├── run_example.py          # Standalone demonstration runner
├── README.md               # Integration guide and documentation
└── tests/
    ├── test_calculations.py# Tests for all 6 formulas and invariant
    ├── test_rules.py       # Tests for Rules 1 through 5
    ├── test_matching.py    # Multi-donor, multi-recipient, and prioritization tests
    └── test_pipeline.py    # End-to-end integration, validation, and export tests
```

---

## 4. Connecting Upstream PyTorch LSTM Predictions

### Method A: Direct DataFrame Integration (Recommended)
If your PyTorch inference pipeline outputs a pandas DataFrame or CSV/JSON file:

```python
import pandas as pd
from rbdss import run_rbdss, RBDSSConfig, DonorStrategy

# 1. Ingest forecasted demand from your PyTorch LSTM model
# Expected columns: branch_id, product_id, period, forecasted_demand
forecast_df = pd.DataFrame([
    {"branch_id": "BR-DVO", "product_id": "STEEL-DB-16MM", "period": "2026-12", "forecasted_demand": 60.0},
    {"branch_id": "BR-CDO", "product_id": "STEEL-DB-16MM", "period": "2026-12", "forecasted_demand": 40.0},
])

# 2. Ingest current branch inventory levels
# Expected columns: branch_id, product_id, period, current_stock, incoming_stock, reserved_stock, safety_stock
inventory_df = pd.DataFrame([
    {
        "branch_id": "BR-DVO",
        "product_id": "STEEL-DB-16MM",
        "period": "2026-12",
        "current_stock": 150.0,
        "incoming_stock": 30.0,
        "reserved_stock": 20.0,
        "safety_stock": 20.0,
    },
    {
        "branch_id": "BR-CDO",
        "product_id": "STEEL-DB-16MM",
        "period": "2026-12",
        "current_stock": 20.0,
        "incoming_stock": 0.0,
        "reserved_stock": 10.0,
        "safety_stock": 20.0,
    },
])

# 3. Configure matching policy (optional)
config = RBDSSConfig(donor_strategy=DonorStrategy.LARGEST_ES_FIRST)

# 4. Execute decision support engine
result = run_rbdss(forecast_df, inventory_df, config=config)

# 5. Access results
for rec in result.recommendations:
    print(f"Branch: {rec.branch_id} | Action: {rec.action} | TQ: {rec.transfer_quantity} | PQ: {rec.procurement_quantity}")
```

### Method B: Connecting Directly to PyTorch `Predictor.predict()`
To wire the existing SteelTrack `Predictor` class directly into the RBDSS:

```python
import asyncio
import pandas as pd
from uuid import UUID
from rbdss import run_rbdss
from src.inference.predictor import Predictor
from src.models.model_registry import ModelRegistry
from src.data.repository import ForecastRepository

async def generate_forecast_dataframe(predictor, product_uuids, branch_uuids):
    raw_predictions = await predictor.predict(
        product_ids=product_uuids,
        branch_ids=branch_uuids,
        horizon_months=3,
    )
    rows = []
    for p in raw_predictions:
        rows.append({
            "branch_id": str(p.branch_id),
            "product_id": str(p.product_id),
            "period": p.forecast_month.strftime("%Y-%m"),
            "forecasted_demand": float(p.predicted_quantity),
        })
    return pd.DataFrame(rows)

# Run forecasting and feed into RBDSS
fc_df = asyncio.run(generate_forecast_dataframe(predictor, prods, branches))
result = run_rbdss(fc_df, inventory_df)
```

---

## 5. Running Tests

Run the complete 55-test suite:

```powershell
& "python-lstm-service\.venv\Scripts\python.exe" -m pytest "rbdss/tests" -v
```

All 55 tests validate:
* Mathematical calculations (PAS, RS, NIR, ES, TQ, PQ)
* Exact edge cases ($\text{PAS} == \text{RS}$, zero demand, over-reserved stock)
* All 5 IF-THEN rules
* Multi-donor and multi-recipient matching
* Non-over-allocation invariant
* Configurable donor prioritization strategies
* Input validation and error handling

