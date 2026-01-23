"""
Database initialization and seed script.
Run this to create sample data for testing.
"""

from database import SessionLocal, Vendor, Location, Salesperson, init_db
from services.auth_service import hash_password


def seed_database():
    """Create sample vendors, locations, and salespeople"""
    
    # Initialize database tables
    init_db()
    
    db = SessionLocal()
    
    try:
        # Check if already seeded
        if db.query(Vendor).first():
            print("Database already has data. Skipping seed.")
            return
        
        # Create Vendor 1: John Deere Dealership
        vendor1 = Vendor(
            name="Green Valley Equipment",
            primary_contact="Mike Johnson",
            phone="515-555-1000",
            email="info@greenvalley.com"
        )
        db.add(vendor1)
        db.commit()
        db.refresh(vendor1)
        
        # Location 1: Des Moines
        location1 = Location(
            vendor_id=vendor1.id,
            location_name="Des Moines",
            street="1234 Equipment Way",
            city="Des Moines",
            state="IA",
            zip_code="50315",
            phone="515-555-1001",
            email="desmoines@greenvalley.com"
        )
        db.add(location1)
        
        # Location 2: Ames
        location2 = Location(
            vendor_id=vendor1.id,
            location_name="Ames",
            street="567 Farm Road",
            city="Ames",
            state="IA",
            zip_code="50010",
            phone="515-555-1002",
            email="ames@greenvalley.com"
        )
        db.add(location2)
        db.commit()
        db.refresh(location1)
        db.refresh(location2)
        
        # Salespeople for Des Moines location
        sales1 = Salesperson(
            location_id=location1.id,
            email="john.smith@greenvalley.com",
            password_hash=hash_password("password123"),
            first_name="John",
            last_name="Smith",
            phone="515-555-2001",
            employee_code="EMP001"
        )
        
        sales2 = Salesperson(
            location_id=location1.id,
            email="sarah.jones@greenvalley.com",
            password_hash=hash_password("password123"),
            first_name="Sarah",
            last_name="Jones",
            phone="515-555-2002",
            employee_code="EMP002"
        )
        
        # Salespeople for Ames location
        sales3 = Salesperson(
            location_id=location2.id,
            email="tom.brown@greenvalley.com",
            password_hash=hash_password("password123"),
            first_name="Tom",
            last_name="Brown",
            phone="515-555-2003",
            employee_code="EMP003"
        )
        
        db.add_all([sales1, sales2, sales3])
        db.commit()
        
        # Create Vendor 2: Case IH Dealership
        vendor2 = Vendor(
            name="Red Power Equipment",
            primary_contact="Lisa Anderson",
            phone="515-555-3000",
            email="info@redpower.com"
        )
        db.add(vendor2)
        db.commit()
        db.refresh(vendor2)
        
        # Location 3: Cedar Rapids
        location3 = Location(
            vendor_id=vendor2.id,
            location_name="Cedar Rapids",
            street="890 Industrial Blvd",
            city="Cedar Rapids",
            state="IA",
            zip_code="52404",
            phone="319-555-3001",
            email="cedarrapids@redpower.com"
        )
        db.add(location3)
        db.commit()
        db.refresh(location3)
        
        # Salespeople for Cedar Rapids
        sales4 = Salesperson(
            location_id=location3.id,
            email="mary.wilson@redpower.com",
            password_hash=hash_password("password123"),
            first_name="Mary",
            last_name="Wilson",
            phone="319-555-4001",
            employee_code="EMP101"
        )
        
        sales5 = Salesperson(
            location_id=location3.id,
            email="david.lee@redpower.com",
            password_hash=hash_password("password123"),
            first_name="David",
            last_name="Lee",
            phone="319-555-4002",
            employee_code="EMP102"
        )
        
        db.add_all([sales4, sales5])
        db.commit()
        
        print("\n✅ Database seeded successfully!")
        print("\n📊 Sample Data Created:")
        print("\nVendors:")
        print("  1. Green Valley Equipment (2 locations)")
        print("  2. Red Power Equipment (1 location)")
        print("\nLocations:")
        print("  - Des Moines (Green Valley) - 2 salespeople")
        print("  - Ames (Green Valley) - 1 salesperson")
        print("  - Cedar Rapids (Red Power) - 2 salespeople")
        print("\n🔑 Sample Login Credentials:")
        print("  Email: john.smith@greenvalley.com")
        print("  Password: password123")
        print("\n  (All test accounts use password: password123)")
        
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
