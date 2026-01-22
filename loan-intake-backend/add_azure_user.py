"""
Add Azure AD B2C user to database

This script creates a salesperson record that matches your Azure AD B2C test user.
The email must match EXACTLY (case-insensitive).
"""

from database import SessionLocal, Salesperson, Location

# ===================================
# CONFIGURE YOUR AZURE USER HERE
# ===================================

# Your Azure AD B2C user email (from Step 6 in Azure Portal)
# Format: username@AssetFinanceOriginators.onmicrosoft.com
AZURE_USER_EMAIL = "testuser1@AssetFinanceOriginators.onmicrosoft.com"

# User details
FIRST_NAME = "Test"
LAST_NAME = "User 1"
LOCATION_ID = 1  # Des Moines (from seed data)

# ===================================

def add_azure_user():
    """Add Azure AD user to database"""
    db = SessionLocal()
    
    try:
        # Check if user already exists
        existing = db.query(Salesperson).filter(
            Salesperson.email.ilike(AZURE_USER_EMAIL)
        ).first()
        
        if existing:
            print(f"✅ User already exists: {existing.email}")
            print(f"   Name: {existing.first_name} {existing.last_name}")
            print(f"   Location ID: {existing.location_id}")
            print(f"   Active: {existing.is_active}")
            return
        
        # Verify location exists
        location = db.query(Location).filter(Location.id == LOCATION_ID).first()
        if not location:
            print(f"❌ Error: Location ID {LOCATION_ID} does not exist")
            print("   Available locations:")
            locations = db.query(Location).all()
            for loc in locations:
                print(f"   - ID {loc.id}: {loc.location_name} ({loc.vendor.name})")
            return
        
        # Create new salesperson
        salesperson = Salesperson(
            location_id=LOCATION_ID,
            email=AZURE_USER_EMAIL,
            password_hash="",  # Not used for Azure AD users
            first_name=FIRST_NAME,
            last_name=LAST_NAME,
            employee_code=f"AZ-TU1-001",  # Unique code for testuser1
            is_active=True
        )
        
        db.add(salesperson)
        db.commit()
        db.refresh(salesperson)
        
        print("✅ Azure user added to database successfully!")
        print(f"   Email: {salesperson.email}")
        print(f"   Name: {salesperson.first_name} {salesperson.last_name}")
        print(f"   Location: {location.location_name} ({location.vendor.name})")
        print(f"   Employee Code: {salesperson.employee_code}")
        print(f"   ID: {salesperson.id}")
        print()
        print("🎯 You can now login with this user!")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error adding user: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    print("=" * 60)
    print("Add Azure AD B2C User to Database")
    print("=" * 60)
    print()
    add_azure_user()
