"""Sample multi-branch steel inventory dataset triggering all 5 canonical RBDSS rules.

Branches:
- BR-DVO (Davao Central Branch)
- BR-CDO (Cagayan De Oro Branch)
- BR-CEB (Cebu City Branch)
- BR-MND (Mandaue Logistics Hub)

Products:
- STEEL-DB-16MM: Deformed Bar 16mm (Triggers Rule 1 KEEP and Rule 3 TRANSFER)
- STEEL-PL-304-4MM: Stainless Plate 304 4mm (Triggers Rule 4 TRANSFER + PROCURE)
- STEEL-SQ-TUBE-2X2: Square Tubing 2x2 1.5mm (Triggers Rule 5 PROCURE)
- STEEL-FB-1X1P4: Flat Bar 1/4 x 1 (Triggers Rule 1 Exact Balance PAS == RS)
"""

from __future__ import annotations

import pandas as pd

SAMPLE_PERIOD = "2026-12"


def generate_sample_inventory() -> pd.DataFrame:
    """Generate realistic physical inventory records across 4 branches and 4 steel products."""
    records = [
        # Product 1: STEEL-DB-16MM (Deformed Bar 16mm)
        # Davao: PAS = 150+30-20 = 160. RS = 60+20 = 80 -> ES = 80 (Donor, Rule 1)
        {
            "branch_id": "BR-DVO",
            "product_id": "STEEL-DB-16MM",
            "period": SAMPLE_PERIOD,
            "current_stock": 150.0,
            "incoming_stock": 30.0,
            "reserved_stock": 20.0,
            "safety_stock": 20.0,
        },
        # CDO: PAS = 20+0-10 = 10. RS = 40+20 = 60 -> NIR = 50 (Recipient, Rule 3 TRANSFER)
        {
            "branch_id": "BR-CDO",
            "product_id": "STEEL-DB-16MM",
            "period": SAMPLE_PERIOD,
            "current_stock": 20.0,
            "incoming_stock": 0.0,
            "reserved_stock": 10.0,
            "safety_stock": 20.0,
        },
        # Cebu: PAS = 80+20-10 = 90. RS = 50+30 = 80 -> ES = 10 (Donor, Rule 1)
        {
            "branch_id": "BR-CEB",
            "product_id": "STEEL-DB-16MM",
            "period": SAMPLE_PERIOD,
            "current_stock": 80.0,
            "incoming_stock": 20.0,
            "reserved_stock": 10.0,
            "safety_stock": 30.0,
        },
        # Mandaue: PAS = 60+10-10 = 60. RS = 40+15 = 55 -> ES = 5 (Donor, Rule 1)
        {
            "branch_id": "BR-MND",
            "product_id": "STEEL-DB-16MM",
            "period": SAMPLE_PERIOD,
            "current_stock": 60.0,
            "incoming_stock": 10.0,
            "reserved_stock": 10.0,
            "safety_stock": 15.0,
        },

        # Product 2: STEEL-PL-304-4MM (Stainless Plate 304 4mm)
        # Davao: PAS = 30+10-5 = 35. RS = 15+10 = 25 -> ES = 10 (Donor, Rule 1)
        {
            "branch_id": "BR-DVO",
            "product_id": "STEEL-PL-304-4MM",
            "period": SAMPLE_PERIOD,
            "current_stock": 30.0,
            "incoming_stock": 10.0,
            "reserved_stock": 5.0,
            "safety_stock": 10.0,
        },
        # CDO: PAS = 10+0-5 = 5. RS = 45+10 = 55 -> NIR = 50 (Recipient, Rule 4 TRANSFER + PROCURE)
        {
            "branch_id": "BR-CDO",
            "product_id": "STEEL-PL-304-4MM",
            "period": SAMPLE_PERIOD,
            "current_stock": 10.0,
            "incoming_stock": 0.0,
            "reserved_stock": 5.0,
            "safety_stock": 10.0,
        },
        # Cebu: PAS = 15+5-5 = 15. RS = 15+10 = 25 -> NIR = 10 (Recipient, Rule 5 PROCURE)
        {
            "branch_id": "BR-CEB",
            "product_id": "STEEL-PL-304-4MM",
            "period": SAMPLE_PERIOD,
            "current_stock": 15.0,
            "incoming_stock": 5.0,
            "reserved_stock": 5.0,
            "safety_stock": 10.0,
        },

        # Product 3: STEEL-SQ-TUBE-2X2 (Square Tubing 2x2 1.5mm)
        # Davao: PAS = 10+0-5 = 5. RS = 35+20 = 55 -> NIR = 50 (Recipient, Rule 5 PROCURE)
        {
            "branch_id": "BR-DVO",
            "product_id": "STEEL-SQ-TUBE-2X2",
            "period": SAMPLE_PERIOD,
            "current_stock": 10.0,
            "incoming_stock": 0.0,
            "reserved_stock": 5.0,
            "safety_stock": 20.0,
        },
        # CDO: PAS = 15+0-5 = 10. RS = 25+15 = 40 -> NIR = 30 (Recipient, Rule 5 PROCURE)
        {
            "branch_id": "BR-CDO",
            "product_id": "STEEL-SQ-TUBE-2X2",
            "period": SAMPLE_PERIOD,
            "current_stock": 15.0,
            "incoming_stock": 0.0,
            "reserved_stock": 5.0,
            "safety_stock": 15.0,
        },
        # Cebu: PAS = 5+0-0 = 5. RS = 15+10 = 25 -> NIR = 20 (Recipient, Rule 5 PROCURE)
        {
            "branch_id": "BR-CEB",
            "product_id": "STEEL-SQ-TUBE-2X2",
            "period": SAMPLE_PERIOD,
            "current_stock": 5.0,
            "incoming_stock": 0.0,
            "reserved_stock": 0.0,
            "safety_stock": 10.0,
        },
        # Mandaue: PAS = 10+0-0 = 10. RS = 0+10 = 10 -> PAS == RS -> ES = 0, NIR = 0 (Rule 1 KEEP)
        {
            "branch_id": "BR-MND",
            "product_id": "STEEL-SQ-TUBE-2X2",
            "period": SAMPLE_PERIOD,
            "current_stock": 10.0,
            "incoming_stock": 0.0,
            "reserved_stock": 0.0,
            "safety_stock": 10.0,
        },

        # Product 4: STEEL-FB-1X1P4 (Flat Bar 1/4 x 1)
        # Davao: PAS = 50+10-10 = 50. RS = 40+10 = 50 -> PAS == RS (Rule 1 KEEP exact balance)
        {
            "branch_id": "BR-DVO",
            "product_id": "STEEL-FB-1X1P4",
            "period": SAMPLE_PERIOD,
            "current_stock": 50.0,
            "incoming_stock": 10.0,
            "reserved_stock": 10.0,
            "safety_stock": 10.0,
        },
        # CDO: PAS = 40+0-0 = 40. RS = 25+15 = 40 -> PAS == RS (Rule 1 KEEP exact balance)
        {
            "branch_id": "BR-CDO",
            "product_id": "STEEL-FB-1X1P4",
            "period": SAMPLE_PERIOD,
            "current_stock": 40.0,
            "incoming_stock": 0.0,
            "reserved_stock": 0.0,
            "safety_stock": 15.0,
        },
    ]
    return pd.DataFrame(records)


def generate_sample_forecasts() -> pd.DataFrame:
    """Generate forecasted demand (simulated from upstream LSTM model)."""
    records = [
        # Product 1
        {"branch_id": "BR-DVO", "product_id": "STEEL-DB-16MM", "period": SAMPLE_PERIOD, "forecasted_demand": 60.0},
        {"branch_id": "BR-CDO", "product_id": "STEEL-DB-16MM", "period": SAMPLE_PERIOD, "forecasted_demand": 40.0},
        {"branch_id": "BR-CEB", "product_id": "STEEL-DB-16MM", "period": SAMPLE_PERIOD, "forecasted_demand": 50.0},
        {"branch_id": "BR-MND", "product_id": "STEEL-DB-16MM", "period": SAMPLE_PERIOD, "forecasted_demand": 40.0},

        # Product 2
        {"branch_id": "BR-DVO", "product_id": "STEEL-PL-304-4MM", "period": SAMPLE_PERIOD, "forecasted_demand": 15.0},
        {"branch_id": "BR-CDO", "product_id": "STEEL-PL-304-4MM", "period": SAMPLE_PERIOD, "forecasted_demand": 45.0},
        {"branch_id": "BR-CEB", "product_id": "STEEL-PL-304-4MM", "period": SAMPLE_PERIOD, "forecasted_demand": 15.0},

        # Product 3
        {"branch_id": "BR-DVO", "product_id": "STEEL-SQ-TUBE-2X2", "period": SAMPLE_PERIOD, "forecasted_demand": 35.0},
        {"branch_id": "BR-CDO", "product_id": "STEEL-SQ-TUBE-2X2", "period": SAMPLE_PERIOD, "forecasted_demand": 25.0},
        {"branch_id": "BR-CEB", "product_id": "STEEL-SQ-TUBE-2X2", "period": SAMPLE_PERIOD, "forecasted_demand": 15.0},
        {"branch_id": "BR-MND", "product_id": "STEEL-SQ-TUBE-2X2", "period": SAMPLE_PERIOD, "forecasted_demand": 0.0},

        # Product 4
        {"branch_id": "BR-DVO", "product_id": "STEEL-FB-1X1P4", "period": SAMPLE_PERIOD, "forecasted_demand": 40.0},
        {"branch_id": "BR-CDO", "product_id": "STEEL-FB-1X1P4", "period": SAMPLE_PERIOD, "forecasted_demand": 25.0},
    ]
    return pd.DataFrame(records)

