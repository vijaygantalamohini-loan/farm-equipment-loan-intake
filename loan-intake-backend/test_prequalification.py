"""
End-to-end tests for the AI prequalification workflow.
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from ai_prequalification.prequalification_engine import PrequalificationEngine
from ai_prequalification.routes import router as prequal_router
from ai_prequalification.schemas import PrequalificationRequest


def _sample_request_payload():
    return {
        "loan_amount": 120000,
        "equipment_list": [
            {
                "type": "Tractor",
                "year": 2022,
                "isNew": True,
                "serialNumber": "JD-123456",
                "value": 140000,
            },
            {
                "type": "Combine",
                "year": 2018,
                "isNew": False,
                "serialNumber": "CN-987654",
                "value": 80000,
            },
        ],
        "borrower_income": 125000,
        "credit_score": 680,
        "down_payment": 15000,
        "naics_code": "1113",
        "state": "IA",
        "trade_in_present": True,
        "loan_term_months": 72,
    }


def test_prequalification_engine_outputs_within_bounds(prequal_model_dir):
    engine = PrequalificationEngine(model_dir=prequal_model_dir)
    payload = _sample_request_payload()
    request = PrequalificationRequest(**payload)

    prediction = engine.predict_prequalification(request)
    prob = prediction["approval_probability"]
    assert 0.0 <= prob <= 1.0
    assert prediction["risk_tier"] in {"Low", "Medium", "High"}
    assert engine.last_tracking_id is not None

    risk = engine.compute_risk_score(request, approval_probability=prob)
    assert 0.0 <= risk["risk_score"] <= 100.0
    assert isinstance(risk["flags"], list)

    structure = engine.suggest_optimal_structure(request)
    assert structure["recommended_term"] >= 12
    assert structure["expected_monthly_payment"] >= 0
    assert structure["recommended_down_payment"] >= 0


def test_prequalify_route_returns_schema(prequal_model_dir):
    app = FastAPI()
    app.include_router(prequal_router)
    client = TestClient(app)
    import ai_prequalification.routes as prequal_routes
    prequal_routes.engine = PrequalificationEngine(model_dir=prequal_model_dir)
    response = client.post("/prequalify", json=_sample_request_payload())
    assert response.status_code == 200, response.text
    body = response.json()
    assert "approval_probability" in body
    assert "risk_score" in body
    assert "optimal_structure" in body
    assert body.get("tracking_id")
    assert body["optimal_structure"]["recommended_term"] >= 12
    assert body["flags"] and isinstance(body["flags"], list)
    assert "reasons" in body and isinstance(body["reasons"], list)
