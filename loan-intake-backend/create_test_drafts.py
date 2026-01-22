"""
Create test draft and in-progress applications for Salesperson ID: 1
"""
from database import SessionLocal, LoanApplication
from utils import ensure_unique_application_number
from datetime import datetime

db = SessionLocal()

print("\nCreating test applications for Salesperson ID: 1...")

# Create a DRAFT application (no data filled)
draft_app = LoanApplication(
    salesperson_id=1,
    location_id=1,
    application_number=ensure_unique_application_number(db),
    status="draft",
    borrower_data={},
    coborrower_data={},
    loan_data={},
    dealer_data={}
)
db.add(draft_app)

# Create an IN_PROGRESS application (partially filled)
in_progress_app = LoanApplication(
    salesperson_id=1,
    location_id=1,
    application_number=ensure_unique_application_number(db),
    status="in_progress",
    borrower_data={
        "firstName": "John",
        "lastName": "Farmer",
        "email": "john.farmer@example.com",
        "phone": "555-0123"
    },
    coborrower_data={},
    loan_data={
        "equipmentType": "Tractor",
        "equipmentCost": 85000,
        "requestedAmount": 75000
    },
    dealer_data={}
)
db.add(in_progress_app)

# Create another IN_PROGRESS application
in_progress_app2 = LoanApplication(
    salesperson_id=1,
    location_id=1,
    application_number=ensure_unique_application_number(db),
    status="in_progress",
    borrower_data={
        "firstName": "Sarah",
        "lastName": "AgriPro",
        "email": "sarah@agripro.com",
        "phone": "555-9876"
    },
    coborrower_data={},
    loan_data={
        "equipmentType": "Combine Harvester",
        "equipmentCost": 250000,
        "requestedAmount": 225000
    },
    dealer_data={}
)
db.add(in_progress_app2)

db.commit()

print(f"\n✅ Created 3 test applications for Salesperson ID: 1:")
print(f"   1. DRAFT: {draft_app.application_number}")
print(f"   2. IN_PROGRESS: {in_progress_app.application_number} (John Farmer)")
print(f"   3. IN_PROGRESS: {in_progress_app2.application_number} (Sarah AgriPro)")
print(f"\nRefresh your dashboard to see them!")

db.close()
