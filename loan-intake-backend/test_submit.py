from sqlalchemy.orm import Session
from uuid import uuid4
from fastapi import HTTPException
from database import SessionLocal, init_db, Salesperson, LoanApplication
from services.loans.submit import submit
from schemas.loan import LoanSubmissionRequest


def _ensure_salesperson(db: Session) -> Salesperson:
    init_db()
    sp = db.query(Salesperson).first()
    if not sp:
        sp = Salesperson(first_name="Test", last_name="User", email="t@example.com", location_id=1)
        db.add(sp)
        db.commit()
        db.refresh(sp)
    return sp


def test_submit_new_application_normalizes_serials_and_tradeins():
    db: Session = SessionLocal()
    try:
        sp = _ensure_salesperson(db)
        req = LoanSubmissionRequest(
            borrower_type="individual",
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
                "model": "X",
                "year": "2024",
                "condition": "New",
                "purchasePrice": 100000.0,
                "cashDown": 10000.0,
                "termMonths": 60,
                "purchaseAssets": [{"serialNumber": "SER-123"}],
                "tradeIns": [{"serialNumber": "  "}, {"serialNumber": None}],
            },
            dealer_data={"name": "Dealer", "address": {"state": "IA"}},
        )

        resp = submit(db, sp, req)
        assert resp["success"] is True

        app_id = resp["id"]
        row = db.get(LoanApplication, app_id)
        assert row is not None
        assert row.loan_data.get("serialNumber") == "SER-123"
        tis = row.loan_data.get("tradeIns") or []
        assert tis[0]["serialNumber"] is None
        assert tis[1]["serialNumber"] is None
    finally:
        db.close()


def test_submit_update_application_copies_existing_tradein_serials():
    db: Session = SessionLocal()
    try:
        sp = _ensure_salesperson(db)
        # Create an existing app with trade-in serials
        existing = LoanApplication(
            salesperson_id=sp.id,
            location_id=sp.location_id,
            borrower_data={"firstName": "Jane", "lastName": "Doe", "ssn": "111-22-3333", "dateOfBirth": "1990-01-01"},
            loan_data={
                "equipmentType": "tractor",
                "make": "JD",
                "model": "X",
                "year": "2024",
                "condition": "Used",
                "purchasePrice": 50000.0,
                "cashDown": 5000.0,
                "termMonths": 36,
                "tradeIns": [{"serialNumber": "T-OLD1"}, {"serialNumber": "T-OLD2"}],
            },
            dealer_data={"name": "D", "address": {"state": "IA"}},
            application_number=f"SUB-UPDATE-1-{uuid4().hex[:6].upper()}",
            status="submitted",
        )
        db.add(existing)
        db.commit()
        db.refresh(existing)

        req = LoanSubmissionRequest(
            application_id=existing.id,
            borrower_type="individual",
            borrower_data={"firstName": "Jane", "lastName": "Doe", "ssn": "111-22-3333", "dateOfBirth": "1990-01-01"},
            loan_data={
                "equipmentType": "tractor",
                "make": "JD",
                "model": "X",
                "year": "2024",
                "condition": "Used",
                "purchasePrice": 50000.0,
                "cashDown": 5000.0,
                "termMonths": 36,
                "tradeIns": [{"serialNumber": "  "}, {"serialNumber": None}],
            },
            dealer_data={"name": "D", "address": {"state": "IA"}},
        )

        resp = submit(db, sp, req)
        assert resp["success"] is True
        row = db.get(LoanApplication, existing.id)
        tis = row.loan_data.get("tradeIns")
        assert tis[0]["serialNumber"] == "T-OLD1"
        assert tis[1]["serialNumber"] == "T-OLD2"
    finally:
        db.close()


def test_submit_missing_fields_raises_http_400():
    db: Session = SessionLocal()
    try:
        sp = _ensure_salesperson(db)
        req = LoanSubmissionRequest(
            borrower_type="individual",
            borrower_data={"firstName": "Only"},  # missing lastName, ssn, dob
            loan_data={"equipmentType": "tractor"},  # missing required fields
        )
        try:
            submit(db, sp, req)
            assert False, "Expected HTTPException for missing fields"
        except HTTPException as exc:
            assert exc.status_code == 400
            detail = exc.detail
            assert "missing_fields" in detail
    finally:
        db.close()
