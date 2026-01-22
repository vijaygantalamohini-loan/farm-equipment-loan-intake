"""
Admin routes for managing vendors, locations, and salespeople.

Note: These endpoints are unprotected. In production:
1. Add admin role check middleware
2. Restrict to specific IP addresses
3. Use separate admin authentication
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import List, Optional

from database import get_db, Vendor, Location, Salesperson
from services.auth_service import hash_password
from core.security import require_admin

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


# Request models
class VendorCreate(BaseModel):
    name: str
    primary_contact: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class LocationCreate(BaseModel):
    vendor_id: int
    location_name: str
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class SalespersonCreate(BaseModel):
    location_id: int
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    employee_code: Optional[str] = None


# Vendor endpoints
@router.post("/vendors", response_model=dict)
async def create_vendor(vendor: VendorCreate, db: Session = Depends(get_db)):
    """Create a new vendor/dealer organization"""
    db_vendor = Vendor(**vendor.dict())
    db.add(db_vendor)
    db.commit()
    db.refresh(db_vendor)
    
    return {
        "id": db_vendor.id,
        "name": db_vendor.name,
        "created_at": db_vendor.created_at
    }


@router.get("/vendors", response_model=List[dict])
async def list_vendors(db: Session = Depends(get_db), active_only: bool = True):
    """List all vendors"""
    query = db.query(Vendor)
    if active_only:
        query = query.filter(Vendor.is_active == True)
    
    vendors = query.all()
    return [
        {
            "id": v.id,
            "name": v.name,
            "primary_contact": v.primary_contact,
            "phone": v.phone,
            "email": v.email,
            "location_count": len(v.locations)
        }
        for v in vendors
    ]


# Location endpoints
@router.post("/locations", response_model=dict)
async def create_location(location: LocationCreate, db: Session = Depends(get_db)):
    """Create a new location for a vendor"""
    # Verify vendor exists
    vendor = db.query(Vendor).filter(Vendor.id == location.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    db_location = Location(**location.dict())
    db.add(db_location)
    db.commit()
    db.refresh(db_location)
    
    return {
        "id": db_location.id,
        "location_name": db_location.location_name,
        "vendor_name": vendor.name,
        "created_at": db_location.created_at
    }


@router.get("/locations", response_model=List[dict])
async def list_locations(
    db: Session = Depends(get_db),
    vendor_id: Optional[int] = None,
    active_only: bool = True
):
    """List locations, optionally filtered by vendor"""
    query = db.query(Location)
    
    if vendor_id:
        query = query.filter(Location.vendor_id == vendor_id)
    if active_only:
        query = query.filter(Location.is_active == True)
    
    locations = query.all()
    return [
        {
            "id": loc.id,
            "location_name": loc.location_name,
            "vendor_name": loc.vendor.name,
            "city": loc.city,
            "state": loc.state,
            "salesperson_count": len(loc.salespeople)
        }
        for loc in locations
    ]


# Salesperson endpoints
@router.post("/salespeople", response_model=dict)
async def create_salesperson(
    salesperson: SalespersonCreate,
    db: Session = Depends(get_db)
):
    """Create a new salesperson for a location"""
    # Verify location exists
    location = db.query(Location).filter(Location.id == salesperson.location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    
    # Check if email already exists
    existing = db.query(Salesperson).filter(Salesperson.email == salesperson.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    password_hash = hash_password(salesperson.password)
    
    # Create salesperson
    db_salesperson = Salesperson(
        location_id=salesperson.location_id,
        email=salesperson.email,
        password_hash=password_hash,
        first_name=salesperson.first_name,
        last_name=salesperson.last_name,
        phone=salesperson.phone,
        employee_code=salesperson.employee_code
    )
    
    db.add(db_salesperson)
    db.commit()
    db.refresh(db_salesperson)
    
    return {
        "id": db_salesperson.id,
        "email": db_salesperson.email,
        "first_name": db_salesperson.first_name,
        "last_name": db_salesperson.last_name,
        "location_name": location.location_name,
        "vendor_name": location.vendor.name,
        "created_at": db_salesperson.created_at
    }


@router.get("/salespeople", response_model=List[dict])
async def list_salespeople(
    db: Session = Depends(get_db),
    location_id: Optional[int] = None,
    active_only: bool = True
):
    """List salespeople, optionally filtered by location"""
    query = db.query(Salesperson)
    
    if location_id:
        query = query.filter(Salesperson.location_id == location_id)
    if active_only:
        query = query.filter(Salesperson.is_active == True)
    
    salespeople = query.all()
    return [
        {
            "id": sp.id,
            "email": sp.email,
            "first_name": sp.first_name,
            "last_name": sp.last_name,
            "employee_code": sp.employee_code,
            "location_name": sp.location.location_name,
            "vendor_name": sp.location.vendor.name,
            "last_login": sp.last_login
        }
        for sp in salespeople
    ]


@router.patch("/salespeople/{salesperson_id}/deactivate")
async def deactivate_salesperson(salesperson_id: int, db: Session = Depends(get_db)):
    """Deactivate a salesperson (soft delete)"""
    salesperson = db.query(Salesperson).filter(Salesperson.id == salesperson_id).first()
    if not salesperson:
        raise HTTPException(status_code=404, detail="Salesperson not found")
    
    salesperson.is_active = False
    db.commit()
    
    return {"message": "Salesperson deactivated successfully"}
