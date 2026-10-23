"""Smoke tests for the FastAPI application wiring.

These use TestClient with the scheduler disabled so no background jobs
fire and no database connection is attempted.
"""

import pytest
from fastapi.testclient import TestClient

from src.config import get_settings


@pytest.fixture(scope="module")
def client():
    """A TestClient bound to the app, with scheduling disabled."""
    settings = get_settings()
    original = settings.enable_scheduler
    settings.enable_scheduler = False

    from src.main import app

    with TestClient(app) as c:
        yield c

    settings.enable_scheduler = original


class TestHealth:
    def test_health_is_public(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"

    def test_root_endpoint(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        body = resp.json()
        assert body["service"] == "SteelTrack LSTM Demand Forecasting"


class TestAuth:
    def test_predict_requires_api_key(self, client):
        resp = client.get("/predict")
        assert resp.status_code == 401

    def test_predict_rejects_wrong_key(self, client):
        resp = client.get("/predict", headers={"X-LSTM-API-KEY": "wrong"})
        assert resp.status_code == 401

    def test_train_requires_api_key(self, client):
        resp = client.post("/train", json={"product_ids": [], "branch_ids": []})
        assert resp.status_code == 401


class TestOpenApi:
    def test_schema_is_generated(self, client):
        resp = client.get("/openapi.json")
        assert resp.status_code == 200
        schema = resp.json()
        assert "/predict" in schema["paths"]
        assert "/train" in schema["paths"]
        assert "/health" in schema["paths"]


class TestSourceField:
    """The response must say which engine produced each row.

    A row served by the seasonal-naive fallback is indistinguishable from
    a row served by the trained LSTM unless the engine is reported. The
    e2e verifier asserts on this field, so it is part of the contract.
    """

    def test_prediction_schema_exposes_source(self, client):
        resp = client.get("/openapi.json")
        assert resp.status_code == 200
        props = resp.json()["components"]["schemas"]["ForecastPrediction"]["properties"]
        assert "source" in props, "ForecastPrediction must expose a source field"
        assert props["source"]["enum"] == ["lstm", "seasonal_naive"]

    def test_source_is_required(self, client):
        resp = client.get("/openapi.json")
        required = resp.json()["components"]["schemas"]["ForecastPrediction"]["required"]
        assert "source" in required, "source must be required, not optional"

    def test_prediction_rejects_unknown_source(self):
        from pydantic import ValidationError

        from src.api.schemas import ForecastPrediction

        base = {
            "product_id": "00000000-0000-0000-0000-000000000001",
            "product_sku": "SKU-1",
            "product_name": "Product",
            "branch_id": "00000000-0000-0000-0000-000000000002",
            "branch_code": "BR-1",
            "forecast_month": "2026-11-01",
            "predicted_quantity": 10,
            "confidence_lower": 5,
            "confidence_upper": 15,
            "trend": "stable",
            "model_version": "v0.1.0",
        }

        assert ForecastPrediction(**base, source="lstm").source == "lstm"
        assert ForecastPrediction(**base, source="seasonal_naive").source == "seasonal_naive"

        with pytest.raises(ValidationError):
            ForecastPrediction(**base, source="magic")


class TestPostPredict:
    """POST /predict carries the scope in a body.

    A scope of several hundred product UUIDs is a ~30 KB query string,
    which is not a reasonable thing to put in a URL. The .NET API uses
    the POST form.
    """

    def test_post_predict_requires_api_key(self, client):
        resp = client.post("/predict", json={"product_ids": [], "branch_ids": []})
        assert resp.status_code == 401

    def test_post_predict_rejects_bad_horizon(self, client):
        settings = get_settings()
        resp = client.post(
            "/predict",
            json={"product_ids": [], "branch_ids": [], "horizon_months": 99},
            headers={"X-LSTM-API-KEY": settings.api_key},
        )
        assert resp.status_code == 422

    def test_post_predict_is_in_the_openapi_schema(self, client):
        resp = client.get("/openapi.json")
        assert resp.status_code == 200
        paths = resp.json()["paths"]
        assert "/predict" in paths
        assert "post" in paths["/predict"], "POST /predict must be exposed"


class TestValidation:
    def test_train_rejects_empty_scope(self, client):
        settings = get_settings()
        resp = client.post(
            "/train",
            json={"product_ids": [], "branch_ids": []},
            headers={"X-LSTM-API-KEY": settings.api_key},
        )
        assert resp.status_code == 400

    def test_predict_rejects_bad_horizon(self, client):
        settings = get_settings()
        resp = client.get(
            "/predict?horizon_months=99",
            headers={"X-LSTM-API-KEY": settings.api_key},
        )
        assert resp.status_code == 422
