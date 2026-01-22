"""
Seed lenders and preferences for development/testing.
Run: python seed_lenders.py
"""

from sqlalchemy.orm import Session
from database import engine, SessionLocal, Lender, LenderPreference


def seed():
    db: Session = SessionLocal()
    try:
        # Lender A: Large loans, mid LTV
        a = Lender(name="AgriCapital Partners", contact_email="capital@example.com")
        db.add(a)
        db.flush()
        a_pref = LenderPreference(
            lender_id=a.id,
            min_loan_amount=500_000,
            max_loan_amount=None,
            ltv_min=0.4,
            ltv_max=0.8,
            equipment_types=["tractor", "combine", "harvester"],
            naics_codes=["1111", "1151"],
            states=["IA", "IL", "NE", "KS"],
        )
        db.add(a_pref)

        # Lender B: $1M+ with strict LTV
        b = Lender(name="FarmGrowth Bank", contact_email="fgb@example.com")
        db.add(b)
        db.flush()
        b_pref = LenderPreference(
            lender_id=b.id,
            min_loan_amount=1_000_000,
            max_loan_amount=None,
            ltv_min=0.3,
            ltv_max=0.6,
            equipment_types=["tractor", "sprayer"],
            naics_codes=["1112", "1152"],
            states=["ND", "SD", "MN"],
        )
        db.add(b_pref)

        # Lender C: mid-market range
        c = Lender(name="Rural Finance Co.", contact_email="rfc@example.com")
        db.add(c)
        db.flush()
        c_pref = LenderPreference(
            lender_id=c.id,
            min_loan_amount=150_000,
            max_loan_amount=900_000,
            ltv_min=0.5,
            ltv_max=0.9,
            equipment_types=["tractor", "trailer", "loader"],
            naics_codes=["1111", "1113", "1151"],
            states=["MO", "AR", "OK", "TX"],
        )
        db.add(c_pref)

        db.commit()
        print("Seeded lenders and preferences.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
