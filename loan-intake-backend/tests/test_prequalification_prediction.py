from ai_prequalification.model_features import FEATURE_COLUMNS
from ai_prequalification.prequalification_engine import PrequalificationEngine, predict_prequalification


def _payload():
    return {
        "loan_amount": 95000,
        "equipment_list": [
            {
                "type": "Tractor",
                "year": 2021,
                "isNew": True,
                "serialNumber": "JD-001",
                "value": 115000,
            }
        ],
        "borrower_income": 98000,
        "credit_score": 710,
        "down_payment": 12000,
        "naics_code": "1111",
        "state": "NE",
        "trade_in_present": False,
        "loan_term_months": 60,
    }


def _risky_payload():
    return {
        "loan_amount": 150000,
        "equipment_list": [
            {
                "type": "Combine",
                "year": 2019,
                "isNew": False,
                "serialNumber": "CN-999",
                "value": 140000,
            }
        ],
        "borrower_income": 42000,
        "credit_score": 700,
        "down_payment": 15000,
        "naics_code": "1113",
        "state": "IA",
        "trade_in_present": False,
        "loan_term_months": 60,
    }


def test_predict_prequalification_function(prequal_model_dir, monkeypatch):
    engine = PrequalificationEngine(model_dir=prequal_model_dir)
    monkeypatch.setattr("ai_prequalification.prequalification_engine._ENGINE", engine)

    result = predict_prequalification(_payload())

    assert 0.0 <= result["approval_probability"] <= 1.0
    assert result["risk_tier"] in {"Low", "Medium", "High"}
    assert set(FEATURE_COLUMNS).issubset(result["features_used"].keys())


def test_predict_prequalification_reasons(prequal_model_dir, monkeypatch):
    engine = PrequalificationEngine(model_dir=prequal_model_dir)
    monkeypatch.setattr("ai_prequalification.prequalification_engine._ENGINE", engine)

    result = predict_prequalification(_risky_payload())
    reasons = result["reasons"]

    assert reasons
    codes = {reason["code"] for reason in reasons}
    assert "ltv_high" in codes
    assert "income_low" in codes
