"""
Tests for lender offers generation and standardized terms.
Run: pytest -q test_offers.py
"""

import pytest
from sqlalchemy.orm import Session
from uuid import uuid4

from database import (
    init_db,
    SessionLocal,
    Vendor,
    Location,
    Salesperson,
    LoanApplication,
)
from services.loans.offers import get_offers


def seed_basic_entities(db: Session):
    vendor = Vendor(name="Test Vendor", primary_contact="Alice", phone="555-1111", email="contact@testvendor.com")
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

    # Generate unique identifiers to avoid unique constraint conflicts across runs
    unique = uuid4().hex[:8]
    salesperson = Salesperson(
        location_id=location.id,
        email=f"rep_{unique}@testvendor.com",
        password_hash="dummy",
        first_name="Rep",
        last_name="Tester",
        phone="555-3333",
        employee_code=f"EMP_{unique}",
    )
    db.add(salesperson)
    db.flush()

    return vendor, location, salesperson


def create_application(db: Session, salesperson: Salesperson, location: Location) -> LoanApplication:
    borrower_data = {
        "firstName": "John",
        "lastName": "Farmer",
        "email": "john@example.com",
        "phone": "555-4444",
        "annualIncome": 85000,
    }

    loan_data = {
        "purpose": "Purchase tractor",
        "cashDown": 10000,
        "termMonths": 60,
        "naicsCode": "1121",  # Dairy/Livestock to trigger Green Valley specialty
        "purchaseAssets": [
            {"make": "John Deere", "model": "5075E", "year": "2022", "serialNumber": "JD-123", "valueEstimate": 65000},
        ],
        "tradeIns": [],
        "amount": 55000,
    }

    app = LoanApplication(
        salesperson_id=salesperson.id,
        location_id=location.id,
        borrower_data=borrower_data,
        coborrower_data=None,
        loan_data=loan_data,
        dealer_data={
            "dealershipName": "Test Vendor - Main Branch",
            "phoneNumber": location.phone,
            "email": location.email,
            "address": {
                "street": location.street,
                "city": location.city,
                "state": location.state,
                "zip": location.zip_code,
            },
        },
        documents_and_consents_data={
            "documents": [],
            "consents": {"creditCheck": True, "shareWithLenders": True},
        },
        status="submitted",
        application_number=f"APP-{salesperson.id}-TEST",
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    return app


def test_lender_offers_approved_and_terms_present():
    # Ensure DB schema present
    init_db()
    db = SessionLocal()
    try:
        vendor, location, salesperson = seed_basic_entities(db)
        app = create_application(db, salesperson, location)

        # Exercise offer generation
        result = get_offers(db, salesperson, app.id)

        # Basic structure checks
        assert result["application_id"] == app.id
        assert isinstance(result["total_lenders"], int) and result["total_lenders"] > 0
        assert isinstance(result["offers"], list) and len(result["offers"]) == result["total_lenders"]

        # At least one approved or conditional offer should be present with terms
        offers = result["offers"]
        valid_offers = [o for o in offers if o["decision"] in ("approved", "conditional")]
        assert len(valid_offers) > 0, "Expected at least one approved/conditional offer"

        # Check standardized fields present
        sample = valid_offers[0]
        for key in [
            "offer_id",
            "lender_name",
            "decision",
            "approved_amount",
            "interest_rate",
            "term_months",
            "monthly_payment",
            "conditions",
            "generated_at",
        ]:
            assert key in sample, f"Missing key '{key}' in offer"

        # Sum counts should match total_lenders
        total_count = (
            result["approved_offers"] + result["conditional_offers"] + result["declined_offers"]
        )
        assert total_count == result["total_lenders"], "Offer counts do not sum to total_lenders"
    finally:
        db.close()
