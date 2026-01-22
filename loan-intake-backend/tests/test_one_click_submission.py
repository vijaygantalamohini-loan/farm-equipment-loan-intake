import io
import pytest

from services.submit_application import run_one_click_submission, one_click_context


class DummyDb:
    def query(self, *args, **kwargs):
        return self

    def filter(self, *args, **kwargs):
        return self

    def all(self):
        return []

    def add(self, *args, **kwargs):
        return None

    def commit(self):
        return None

    def refresh(self, *args, **kwargs):
        return None


class DummySalesperson:
    id = 1
    location_id = 1
    email = "test@example.com"


@pytest.mark.asyncio
async def test_one_click_submission(monkeypatch):
    async def fake_extract_text_from_id(_bytes):
        return {"rawText": ["DOE, JOHN", "01/02/1980", "123 MAIN ST", "OMAHA, NE 68102", "123-45-6789"]}

    async def fake_extract_invoice_data(_bytes):
        return {
            "dealer_name": "Farm Dealer",
            "buyer_name": "John Doe",
            "make": "John Deere",
            "model": "5075E",
            "year": "2022",
            "serial_number": "JD5075E123",
            "hours": 450,
            "price": 75000,
            "taxes": 500,
            "fees": 250,
            "trade_in_value": 5000,
            "down_payment": 10000,
            "total_financed_amount": 60500,
        }

    async def fake_run_prequalification(_payload):
        return {
            "approval_probability": 0.82,
            "risk_tier": "Low",
            "flags": [],
            "recommended_term": 60,
            "recommended_down_payment": 10000,
        }

    async def fake_run_equipment_intelligence(*_args, **_kwargs):
        return {
            "valuation": {"blended_value": 74000},
            "comparables": [{"price": 73000}],
            "fraud_flags": [],
            "resale_prediction": {"depreciated_value": 65000},
            "confidence_score": 0.76,
        }

    def fake_evaluate_fraud_flags(_payload):
        return [{"code": "price_above_market", "severity": "medium"}]

    def fake_submit(_db, _salesperson, _request):
        return {"success": True, "data": {"application_number": "APP-TEST", "id": 101}}

    def fake_rank_lenders_with_scores(_db, _app, _prequal, _equip):
        return [{"lender_name": "Mock Lender", "match_score": 87.5}]

    monkeypatch.setattr("services.submit_application.extract_text_from_id", fake_extract_text_from_id)
    monkeypatch.setattr("services.submit_application.extract_invoice_data", fake_extract_invoice_data)
    monkeypatch.setattr("services.submit_application.run_prequalification", fake_run_prequalification)
    monkeypatch.setattr("services.submit_application.run_equipment_intelligence", fake_run_equipment_intelligence)
    monkeypatch.setattr("services.submit_application.evaluate_fraud_flags", fake_evaluate_fraud_flags)
    monkeypatch.setattr("services.submit_application.submit_service.submit", fake_submit)
    monkeypatch.setattr("services.submit_application.rank_lenders_with_scores", fake_rank_lenders_with_scores)

    id_image = io.BytesIO(b"fake-id")
    invoice_image = io.BytesIO(b"fake-invoice")

    with one_click_context(DummyDb(), DummySalesperson()):
        result = await run_one_click_submission(id_image, invoice_image)

    assert result["borrower"]["firstName"] == "John"
    assert result["equipment"]["make"] == "John Deere"
    assert result["ai_prequal"]["approval_probability"] == 0.82
    assert result["fraud_flags"][0]["code"] == "price_above_market"
    assert result["matched_lenders"][0]["lender_name"] == "Mock Lender"
    assert result["submission"]["success"] is True
