import os
from datetime import datetime
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from main import app
from database import SessionLocal, init_db, LoanApplication, Salesperson
from seed_database import seed_database
from utils import ApplicationStatus

client = TestClient(app)


def _ensure_salesperson() -> Salesperson:
    init_db()
    seed_database()
    db = SessionLocal()
    try:
        salesperson = db.query(Salesperson).first()
        assert salesperson is not None, "Seed should create at least one salesperson"
        return salesperson
    finally:
        db.close()


def _create_submitted_application(db: Session, salesperson: Salesperson) -> LoanApplication:
    application = LoanApplication(
        salesperson_id=salesperson.id,
        location_id=salesperson.location_id,
        borrower_data={
            "firstName": "Jane",
            "lastName": "Doe",
            "ssn": "123-45-6789",
            "dateOfBirth": "1990-01-01",
        },
        coborrower_data=None,
        loan_data={
            "equipmentType": "tractor",
            "make": "JD",
            "model": "4000",
            "year": "2023",
            "condition": "Used",
            "purchasePrice": 75000.0,
            "cashDown": 5000.0,
            "termMonths": 60,
            "accepted_offer": {"lenderId": "L123", "terms": {"apr": 5.9}},
            "revisionHistory": [
                {
                    "timestamp": datetime(2024, 1, 1, 12, 0, 0).isoformat(),
                    "performedBy": "previous@example.com",
                    "previousStatus": ApplicationStatus.SUBMITTED,
                }
            ],
        },
        dealer_data={"name": "Dealer", "address": {"state": "IA"}},
        application_number=f"REV-TEST-{uuid4().hex[:6].upper()}",
        status=ApplicationStatus.SUBMITTED,
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    return application


def test_reopen_application_moves_to_in_progress_and_tracks_history():
    salesperson = _ensure_salesperson()
    os.environ["TEST_USER_EMAIL"] = salesperson.email

    db = SessionLocal()
    try:
        app_row = _create_submitted_application(db, salesperson)
        app_id = app_row.id
    finally:
        db.close()

    token = "test.token"
    response = client.post(
        f"/loans/{app_id}/reopen",
        json={"reason": "Need to adjust down payment"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["success"] is True
    assert payload["status"] == ApplicationStatus.IN_PROGRESS
    assert payload["previous_status"] == ApplicationStatus.SUBMITTED
    missing = payload.get("missing_fields") or {}
    assert missing.get("borrower") == []
    assert missing.get("loan") == []

    db = SessionLocal()
    try:
        refreshed = db.get(LoanApplication, app_id)
        assert refreshed.status == ApplicationStatus.IN_PROGRESS
        history = refreshed.loan_data.get("revisionHistory")
        assert history is not None
        assert len(history) == 2
        last_entry = history[-1]
        assert last_entry["performedBy"] == salesperson.email
        assert last_entry["previousStatus"] == ApplicationStatus.SUBMITTED
        assert last_entry["reason"] == "Need to adjust down payment"
        assert "accepted_offer" not in refreshed.loan_data
    finally:
        db.close()
