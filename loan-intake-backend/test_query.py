from database import SessionLocal, Salesperson

db = SessionLocal()
email = "testuser1@AssetFinanceOriginators.onmicrosoft.com"

# Test the exact query from get_or_create_salesperson_from_azure
result = db.query(Salesperson).filter(
    Salesperson.email.ilike(email),
    Salesperson.is_active == True
).first()

print(f"Email searched: {email}")
print(f"Query result: {result}")

if result:
    print(f"Found: ID={result.id}, Email={result.email}, Name={result.first_name} {result.last_name}")
else:
    print("Not found")
    
# Also test exact match
exact_result = db.query(Salesperson).filter(
    Salesperson.email == email
).first()
print(f"\nExact match result: {exact_result}")

# List all users
all_users = db.query(Salesperson).all()
print(f"\nAll users in database:")
for user in all_users:
    print(f"  ID: {user.id}, Email: [{user.email}], Active: {user.is_active}")

db.close()
