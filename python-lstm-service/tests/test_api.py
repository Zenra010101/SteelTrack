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
