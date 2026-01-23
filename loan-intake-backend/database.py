"""
Database configuration and models for loan intake system.

Uses SQLAlchemy ORM with SQLite for development.
For production, switch to PostgreSQL.
"""

from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, ForeignKey, Text, JSON, Float
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime, UTC
import os

from core.settings import get_settings

settings = get_settings()

# Database URL - SQLite for development
DATABASE_URL = settings.database_url

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Vendor(Base):
    """Vendor/Dealer organization"""
    __tablename__ = "vendors"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    primary_contact = Column(String(255))
    phone = Column(String(20))
    email = Column(String(255))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    is_active = Column(Boolean, default=True)
    
    # Relationships
    locations = relationship("Location", back_populates="vendor")


class Location(Base):
    """Physical location/branch of a vendor"""
    __tablename__ = "locations"
    
    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    location_name = Column(String(255), nullable=False)
    
    # Address
    street = Column(String(255))
    city = Column(String(100))
    state = Column(String(2))
    zip_code = Column(String(10))
    
    phone = Column(String(20))
    email = Column(String(255))
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    is_active = Column(Boolean, default=True)
    
    # Relationships
    vendor = relationship("Vendor", back_populates="locations")
    salespeople = relationship("Salesperson", back_populates="location")
    loan_applications = relationship("LoanApplication", back_populates="location")


class Salesperson(Base):
    """Sales representative at a location"""
    __tablename__ = "salespeople"
    
    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    
    # Login credentials
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    
    # Personal info
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(20))
    
    # Employee ID or code
    employee_code = Column(String(50), unique=True, index=True)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime(timezone=True))
    
    # Relationships
    location = relationship("Location", back_populates="salespeople")
    loan_applications = relationship("LoanApplication", back_populates="salesperson")


class LoanApplication(Base):
    """Loan application submitted by salesperson"""
    __tablename__ = "loan_applications"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Associations
    salesperson_id = Column(Integer, ForeignKey("salespeople.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    
    # Application data (stored as JSON for flexibility)
    borrower_data = Column(JSON, nullable=False)  # firstName, lastName, SSN, etc.
    coborrower_data = Column(JSON)  # Optional co-borrower
    loan_data = Column(JSON, nullable=False)  # purpose, amount, equipment, etc.
    dealer_data = Column(JSON)  # Dealer info if different from location
    documents_and_consents_data = Column(JSON)  # New: documents and consents step
    
    # Status tracking
    status = Column(String(50), default="submitted", index=True)  # submitted, reviewing, approved, denied
    application_number = Column(String(50), unique=True, index=True)
    
    # Timestamps
    submitted_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), index=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))
    reviewed_at = Column(DateTime(timezone=True))
    
    # Additional fields
    notes = Column(Text)
    
    # Relationships
    salesperson = relationship("Salesperson", back_populates="loan_applications")
    location = relationship("Location", back_populates="loan_applications")


class IdempotencyKey(Base):
    """Idempotency key storage for safe retries"""
    __tablename__ = "idempotency_keys"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(255), unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), index=True)
    expires_at = Column(DateTime(timezone=True), nullable=True, index=True)


class Lender(Base):
    """Lender organization or funding partner"""
    __tablename__ = "lenders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    contact_email = Column(String(255))
    contact_phone = Column(String(50))
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    # Relationships
    preferences = relationship("LenderPreference", back_populates="lender", uselist=False)
    matches = relationship("LenderMatch", back_populates="lender")


class LenderPreference(Base):
    """Per-lender interest filters/preferences"""
    __tablename__ = "lender_preferences"

    id = Column(Integer, primary_key=True, index=True)
    lender_id = Column(Integer, ForeignKey("lenders.id"), nullable=False, index=True)

    # Amount filters
    min_loan_amount = Column(Float, default=0.0)
    max_loan_amount = Column(Float, nullable=True)

    # LTV range (0..1)
    ltv_min = Column(Float, default=0.0)
    ltv_max = Column(Float, default=1.0)

    # JSON lists for categorical filters
    equipment_types = Column(JSON)  # ["tractor", "combine", ...]
    naics_codes = Column(JSON)      # ["1111", "1151", ...]
    states = Column(JSON)           # ["IA", "IL", "NE", ...]

    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    lender = relationship("Lender", back_populates="preferences")


class LenderMatch(Base):
    """Match record linking applications to interested lenders"""
    __tablename__ = "lender_matches"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("loan_applications.id"), nullable=False, index=True)
    lender_id = Column(Integer, ForeignKey("lenders.id"), nullable=False, index=True)

    # Snapshot fields for transparency
    loan_amount = Column(Float)
    ltv = Column(Float)
    reason = Column(String(255))  # e.g., "amount+ltv+state"
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    lender = relationship("Lender", back_populates="matches")
    application = relationship("LoanApplication")


def init_db():
    """Initialize database - create all tables"""
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")


def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


if __name__ == "__main__":
    # Run this to create tables
    init_db()
