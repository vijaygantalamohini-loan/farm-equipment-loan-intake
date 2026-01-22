import json
from fastapi.testclient import TestClient

from uuid import uuid4
from main import app
from database import SessionLocal, init_db, Salesperson, LoanApplication
from seed_database import seed_database

client = TestClient(app)


def ensure_salesperson():
    init_db()
    seed_database()
    db = SessionLocal()
    try:
        sp = db.query(Salesperson).first()
        assert sp is not None, "Seed failed to create Salesperson"
        return sp
    finally:
        db.close()


def create_large_application(db, sp):
    # 1.5M asset, 300k down => amount 1.2M, LTV 0.8
    borrower = {
        "firstName": "Test",
        "lastName": "Borrower",
        "email": "tb@example.com",
        "phone": "555-0000",
        "annualIncome": 500000,
        "address": {"street": "1 Ranch Rd", "city": "Ames", "state": "IA", "zip": "50010"},
    }
    loan = {
        "purpose": "tractor",
        "cashDown": 300000.0,
        "termMonths": 72,
        "naicsCode": "1111",
        "purchaseAssets": [{
            "make": "JD",
            "model": "X",
            "year": "2024",
            "serialNumber": "BIG-001",
            "condition": "New",
            "valueEstimate": 1500000.0,
            "equipmentType": "tractor",
        }],
    }
    dealer = {
        "dealershipName": "Green Valley Equipment",
        "contactPerson": "Dana Rep",
        "phoneNumber": "555-123-4567",
        "email": "dealer@example.com",
        "address": {"street": "1234 Equipment Way", "city": "Des Moines", "state": "IA", "zip": "50315"},
    }
    app = LoanApplication(
        salesperson_id=sp.id,
        location_id=sp.location_id,
        application_number=f"TEST-APP-LARGE-{uuid4().hex[:6].upper()}",
        status="submitted",
        borrower_data=borrower,
        loan_data=loan,
        dealer_data=dealer,
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    return app


def test_lenders_crud_and_matching():
    sp = ensure_salesperson()

    # Create a lender
    r = client.post(
        "/lenders",
        json={"name": "Test Lender", "contact_email": "test@example.com"},
    )
    assert r.status_code == 200, r.text
    lender_id = r.json()["id"]

    # List lenders and find ours
    r = client.get("/lenders")
    assert r.status_code == 200
    lenders = r.json()
    assert any(l["id"] == lender_id for l in lenders)

    # Preferences initially empty
    r = client.get(f"/lenders/{lender_id}/preferences")
    assert r.status_code == 200
    assert r.json() == {}

    # Upsert preferences to match large tractor app: min 1M, LTV up to 0.85, IA
    r = client.post(
        f"/lenders/{lender_id}/preferences",
        json={
            "min_loan_amount": 1000000,
            "ltv_min": 0.3,
            "ltv_max": 0.85,
            "equipment_types": ["tractor"],
            "naics_codes": ["1111"],
            "states": ["IA"],
        },
    )
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True

    # Verify preferences
    r = client.get(f"/lenders/{lender_id}/preferences")
    assert r.status_code == 200
    prefs = r.json()
    assert prefs["min_loan_amount"] == 1000000
    assert prefs["ltv_max"] == 0.85
    assert "IA" in (prefs.get("states") or [])

    # Create large application directly in DB
    db = SessionLocal()
    try:
        app_row = create_large_application(db, sp)
        app_id = app_row.id
    finally:
        db.close()

    # Run matching
    r = client.post(f"/lenders/match/{app_id}")
    assert r.status_code == 200, r.text
    matches = r.json()
    assert any(m["lender_id"] == lender_id for m in matches), f"No match for lender {lender_id}: {matches}"

    # List matches
    r = client.get(f"/lenders/matches/{app_id}")
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) >= 1
    assert any(row["lender_id"] == lender_id for row in rows)
