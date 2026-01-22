from uuid import uuid4
from sqlalchemy.orm import Session

from database import SessionLocal, init_db, Vendor, Location, Salesperson, LoanApplication
from seed_database import seed_database
from seed_lenders import seed as seed_lenders
from services.loans.matching import match_application_to_lenders


def test_vendor_location_salesperson_application_relationships():
    # Ensure base schema and seed data
    init_db()
    seed_database()

    db: Session = SessionLocal()
    try:
        # Vendors and locations exist
        vendor = db.query(Vendor).first()
        assert vendor is not None
        location = db.query(Location).filter(Location.vendor_id == vendor.id).first()
        assert location is not None

        # Salesperson linked to location
        sp = db.query(Salesperson).filter(Salesperson.location_id == location.id).first()
        assert sp is not None
        assert sp.location_id == location.id

        # Create an application linked to salesperson and location
        app_number = f"REL-APP-{uuid4().hex[:6].upper()}"
        borrower = {
            "firstName": "Rel",
            "lastName": "Check",
            "email": "rel@example.com",
            "phone": "555-1212",
            "annualIncome": 100000,
            "address": {"street": "1 Farm Rd", "city": "Ames", "state": "IA", "zip": "50010"},
        }
        loan = {
            "purpose": "tractor",
            "cashDown": 10000.0,
            "termMonths": 60,
            "naicsCode": "1111",
            "purchaseAssets": [
                {"make": "JD", "model": "X", "year": "2024", "serialNumber": "REL-001", "condition": "New", "valueEstimate": 110000.0, "equipmentType": "tractor"}
            ],
            "tradeIns": [
                {"make": "Old", "model": "Y", "year": "2015", "serialNumber": "OLD-001", "valueEstimate": 10000.0}
            ],
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
            application_number=app_number,
            status="submitted",
            borrower_data=borrower,
            loan_data=loan,
            dealer_data=dealer,
        )
        db.add(app)
        db.commit()
        db.refresh(app)

        # Relationships resolve correctly
        assert app.salesperson is not None
        assert app.location is not None
        assert app.salesperson.location_id == app.location.id
        assert app.location.vendor_id == vendor.id

        # Asset JSON available
        assert isinstance(app.loan_data.get("purchaseAssets"), list)
        assert app.loan_data["purchaseAssets"][0]["equipmentType"] == "tractor"

    finally:
        db.close()


def test_matching_respects_state_and_amount_ltv():
    # Ensure lenders exist
    seed_lenders()

    db: Session = SessionLocal()
    try:
        # Create application that should match seeded Lender A (IA, tractor, amount 600k, LTV 0.8)
        sp = db.query(Salesperson).first()
        assert sp is not None
        app_number = f"REL-MATCH-{uuid4().hex[:6].upper()}"
        borrower = {"firstName": "Rel", "lastName": "Match"}
        loan = {
            "purpose": "tractor",
            "cashDown": 150000.0,
            "termMonths": 60,
            "naicsCode": "1111",
            "purchaseAssets": [{"valueEstimate": 750000.0, "equipmentType": "tractor"}],
        }
        dealer = {"address": {"state": "IA"}}
        app = LoanApplication(
            salesperson_id=sp.id,
            location_id=sp.location_id,
            application_number=app_number,
            status="submitted",
            borrower_data=borrower,
            loan_data=loan,
            dealer_data=dealer,
        )
        db.add(app)
        db.commit()
        db.refresh(app)

        matches = match_application_to_lenders(db, app)
        assert isinstance(matches, list)
        # Expect at least one match where states include IA and amount/LTV fit a lender range
        assert len(matches) >= 1
    finally:
        db.close()
