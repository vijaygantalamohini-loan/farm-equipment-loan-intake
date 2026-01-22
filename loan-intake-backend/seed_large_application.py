from database import SessionLocal, LoanApplication, Salesperson
from utils import ensure_unique_application_number, ApplicationStatus

def main():
    db = SessionLocal()
    try:
        sp = db.query(Salesperson).first()
        if not sp:
            print("No Salesperson found.")
            return
        app_number = ensure_unique_application_number(db)
        asset_value = 1_500_000.0
        cash_down = 300_000.0  # LTV 0.8
        borrower = {"firstName": "Big", "lastName": "Farmer", "email": "big@example.com", "phone": "555-9999", "annualIncome": 500000,
                    "address": {"street": "1 Ranch Rd", "city": "Ames", "state": "IA", "zip": "50010"}}
        loan = {
            "purpose": "tractor",
            "cashDown": cash_down,
            "termMonths": 72,
            "naicsCode": "1111",
            "purchaseAssets": [{"make": "JD", "model": "X", "year": "2024", "serialNumber": "BIG-001", "condition": "New", "valueEstimate": asset_value}],
        }
        dealer = {"dealershipName": "Green Valley Equipment", "contactPerson": "Dana Rep", "phoneNumber": "555-123-4567", "email": "dealer@example.com",
                  "address": {"street": "1234 Equipment Way", "city": "Des Moines", "state": "IA", "zip": "50315"}}
        app = LoanApplication(
            salesperson_id=sp.id,
            location_id=sp.location_id,
            application_number=app_number,
            status=ApplicationStatus.SUBMITTED,
            borrower_data=borrower,
            loan_data=loan,
            dealer_data=dealer,
        )
        db.add(app)
        db.commit()
        db.refresh(app)
        print("Created large application", app.id, app.application_number)
    finally:
        db.close()

if __name__ == "__main__":
    main()
