"""
Seed submitted applications designed to produce varied lender responses.

Run with the backend virtualenv Python:

  C:\FarmEquipment\loan-intake-backend\.venv\Scripts\python.exe seed_submitted_applications.py

This will create:
- App A: High income, large asset, low cash down -> AgCredit conditional; others approved
- App B: Lower income, high loan amount -> Prairie may decline; AgCredit likely declines (for demo of decline states)
"""

from datetime import datetime
from database import SessionLocal, LoanApplication, Salesperson
from utils import ensure_unique_application_number, ApplicationStatus


def create_submitted_application(db, salesperson: Salesperson, *,
                                 annual_income: float,
                                 asset_value: float,
                                 cash_down: float,
                                 naics_code: str | None = None,
                                 purpose: str = "Purchase tractor for farming operations") -> LoanApplication:
    app_number = ensure_unique_application_number(db)
    loan_amount = max(0.0, asset_value - cash_down)

    borrower = {
        "firstName": "Alice",
        "lastName": "Tester",
        "email": "alice.tester@example.com",
        "phone": "555-0001",
        "annualIncome": annual_income,
        "address": {"street": "1 Farm Rd", "city": "Ames", "state": "IA", "zip": "50010"}
    }
    loan = {
        "purpose": purpose,
        "cashDown": cash_down,
        "termMonths": 60,
        "naicsCode": naics_code or "1111",
        "purchaseAssets": [
            {"make": "John Deere", "model": "5075E", "year": "2023", "serialNumber": "JD-TEST-001", "condition": "New", "valueEstimate": asset_value}
        ],
        "amount": loan_amount,
    }
    dealer = {
        "dealershipName": "Green Valley Equipment",
        "contactPerson": "Dana Rep",
        "phoneNumber": "555-123-4567",
        "email": "dealer@example.com",
        "address": {"street": "1234 Equipment Way", "city": "Des Moines", "state": "IA", "zip": "50315"}
    }

    app = LoanApplication(
        salesperson_id=salesperson.id,
        location_id=salesperson.location_id,
        application_number=app_number,
        status=ApplicationStatus.SUBMITTED,
        borrower_data=borrower,
        coborrower_data={},
        loan_data=loan,
        dealer_data=dealer,
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    return app


def main():
    db = SessionLocal()
    try:
        sp = db.query(Salesperson).first()
        if not sp:
            print("No Salesperson found. Seed database first (seed_database.py).")
            return

        print(f"Using Salesperson: {sp.email} (location {sp.location_id})")

        # App A: High income, low cash down -> AgCredit conditional (down < 15%), others approved
        app_a = create_submitted_application(
            db,
            sp,
            annual_income=120_000.0,
            asset_value=120_000.0,
            cash_down=10_000.0,  # < 15% of 120k => AgCredit adds down-payment condition => conditional
            naics_code="1111",
        )
        print(f"Created submitted application A: {app_a.application_number} (id {app_a.id})")

        # App B: Lower income, high loan amount -> Demonstrate decline states (Prairie/AgCredit)
        app_b = create_submitted_application(
            db,
            sp,
            annual_income=30_000.0,
            asset_value=95_000.0,
            cash_down=0.0,
            naics_code="1111",
        )
        print(f"Created submitted application B: {app_b.application_number} (id {app_b.id})")

        print("\nNext steps:")
        print("- Start backend and frontend dev servers.")
        print("- In the dashboard, look under Submitted and click 'Get Loan Offers' on the created applications.")
        print("  You should see AgCredit conditional (A) and declines on (B) depending on lender criteria.")
    except Exception as e:
        print("Error seeding submitted applications:", e)
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    main()
