"""
Test that trade-in serial numbers are persisted and surfaced on the dashboard.

Run: pytest -q test_tradein_serials.py
"""

from uuid import uuid4
from sqlalchemy.orm import Session

from database import init_db, SessionLocal, Vendor, Location, Salesperson, LoanApplication
from utils import ApplicationStatus
from services.loans import drafts, dashboard
from schemas.loan import SaveDraftRequest


def seed_vendor_location_salesperson(db: Session):
    vendor = Vendor(
        name="Test Vendor",
        primary_contact="Alice",
        phone="555-1111",
        email="contact@testvendor.com",
    )
    db.add(vendor)
    db.flush()

    location = Location(
        vendor_id=vendor.id,
        location_name="Main Branch",
        street="123 Farm Rd",
        city="Springfield",
        state="IL",
        zip_code="62701",
        phone="555-2222",
        email="main@testvendor.com",
    )
    db.add(location)
    db.flush()

    unique = uuid4().hex[:8]
    sp = Salesperson(
        location_id=location.id,
        email=f"rep_{unique}@testvendor.com",
        password_hash="dummy",
        first_name="Rep",
        last_name="Tester",
        phone="555-3333",
        employee_code=f"EMP_{unique}",
    )
    db.add(sp)
    db.flush()

    return vendor, location, sp


def create_draft_application(db: Session, salesperson: Salesperson, location: Location) -> LoanApplication:
    app = LoanApplication(
        salesperson_id=salesperson.id,
        location_id=location.id,
        borrower_data={},
        coborrower_data={},
        loan_data={},
        dealer_data={},
        application_number=f"APP-{uuid4().hex[:6]}",
        status=ApplicationStatus.DRAFT,
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    return app


def test_tradein_serials_persist_and_dashboard_surfaces():
    init_db()
    db = SessionLocal()
    try:
        _, location, sp = seed_vendor_location_salesperson(db)
        app = create_draft_application(db, sp, location)

        # Save draft with purchase asset and trade-in containing serial numbers
        req = SaveDraftRequest(
            borrower_type="individual",
            has_coborrower=False,
            borrower_data={},
            coborrower_data={},
            dealer_data={},
            loan_data={
                "purpose": "Purchase",
                "hasTradeIn": True,
                "purchaseAssets": [
                    {
                        "id": 1,
                        "make": "Deere",
                        "model": "5075E",
                        "year": "2024",
                        "serialNumber": " PUR-123-XYZ ",  # include spaces to test trim
                        "condition": "Good",
                        "valueEstimate": "10000",
                    }
                ],
                "tradeIns": [
                    {
                        "id": 2,
                        "make": "Old Co",
                        "model": "Trac",
                        "year": "2001",
                        "serialNumber": " TI-ABC-999 ",  # include spaces to test trim
                        "hoursOrMiles": "1200",
                        "condition": "Fair",
                        "valueEstimate": "2000",
                    }
                ],
            },
        )

        res = drafts.save_draft(db, sp, app.id, req)
        assert res and res.get("success"), "Draft save should succeed"

        # Verify normalization persisted to DB
        db.refresh(app)
        loan = app.loan_data or {}
        assert loan.get("serialNumber") == "PUR-123-XYZ"
        trade_ins = loan.get("tradeIns") or []
        assert trade_ins and trade_ins[0].get("serialNumber") == "TI-ABC-999"

        # Dashboard should surface primary and trade-in serials
        dash = dashboard.dashboard(db, sp)
        all_apps = (
            dash["applications"]["in_progress"]
            + dash["applications"]["submitted"]
            + dash["applications"]["funded"]
        )
        found = [a for a in all_apps if a.get("id") == app.id]
        assert found, "Application should be present on dashboard"
        item = found[0]
        assert item.get("serial_number") == "PUR-123-XYZ"
        assert "TI-ABC-999" in (item.get("trade_in_serials") or [])
    finally:
        db.close()
