from database import SessionLocal, LoanApplication

db = SessionLocal()
apps = db.query(LoanApplication).all()
print(f'Total applications in database: {len(apps)}')
for app in apps:
    print(f'  - {app.application_number} (Status: {app.status}, Salesperson ID: {app.salesperson_id})')
db.close()
