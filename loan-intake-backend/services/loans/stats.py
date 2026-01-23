"""Statistics and listing helpers for loans."""

from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import LoanApplication, Salesperson, Location, Vendor
from utils import Defaults, ResponseFormatter, PermissionChecker


def my_applications(db: Session, salesperson: Salesperson, status_filter: Optional[str], limit: int):
    query = db.query(LoanApplication).filter(LoanApplication.salesperson_id == salesperson.id)
    if status_filter:
        query = query.filter(LoanApplication.status == status_filter)
    applications = query.order_by(LoanApplication.submitted_at.desc()).limit(limit).all()
    return [ResponseFormatter.format_loan_summary(app) for app in applications]


def location_applications(db: Session, salesperson: Salesperson, status_filter: Optional[str], limit: int):
    query = db.query(LoanApplication).filter(LoanApplication.location_id == salesperson.location_id)
    if status_filter:
        query = query.filter(LoanApplication.status == status_filter)
    applications = query.order_by(LoanApplication.submitted_at.desc()).limit(limit).all()
    return [ResponseFormatter.format_loan_summary(app) for app in applications]


def vendor_applications(db: Session, salesperson: Salesperson, status_filter: Optional[str], limit: int):
    location_ids = PermissionChecker.get_vendor_location_ids(salesperson, db)
    query = db.query(LoanApplication).filter(LoanApplication.location_id.in_(location_ids))
    if status_filter:
        query = query.filter(LoanApplication.status == status_filter)
    applications = query.order_by(LoanApplication.submitted_at.desc()).limit(limit).all()
    return [ResponseFormatter.format_loan_summary(app) for app in applications]


def my_stats(db: Session, salesperson: Salesperson):
    status_counts = (
        db.query(LoanApplication.status, func.count(LoanApplication.id))
        .filter(LoanApplication.salesperson_id == salesperson.id)
        .group_by(LoanApplication.status)
        .all()
    )
    total = (
        db.query(LoanApplication)
        .filter(LoanApplication.salesperson_id == salesperson.id)
        .count()
    )
    return {
        "salesperson": ResponseFormatter.format_salesperson(salesperson),
        "total_applications": total,
        "by_status": {status: count for status, count in status_counts},
        "location": ResponseFormatter.format_location(salesperson.location),
    }


def location_stats(db: Session, salesperson: Salesperson):
    status_counts = (
        db.query(LoanApplication.status, func.count(LoanApplication.id))
        .filter(LoanApplication.location_id == salesperson.location_id)
        .group_by(LoanApplication.status)
        .all()
    )
    total = (
        db.query(LoanApplication)
        .filter(LoanApplication.location_id == salesperson.location_id)
        .count()
    )
    salesperson_counts = (
        db.query(
            Salesperson.first_name,
            Salesperson.last_name,
            func.count(LoanApplication.id),
        )
        .join(LoanApplication, Salesperson.id == LoanApplication.salesperson_id)
        .filter(
            Salesperson.location_id == salesperson.location_id,
            Salesperson.is_active == True,
        )
        .group_by(Salesperson.id, Salesperson.first_name, Salesperson.last_name)
        .all()
    )
    return {
        "location": ResponseFormatter.format_location(salesperson.location),
        "total_applications": total,
        "by_status": {status: count for status, count in status_counts},
        "by_salesperson": [{"name": f"{fn} {ln}", "count": count} for fn, ln, count in salesperson_counts],
    }


def vendor_stats(db: Session, salesperson: Salesperson):
    location = db.query(Location).filter(Location.id == salesperson.location_id).first()
    vendor = db.query(Vendor).filter(Vendor.id == location.vendor_id).first() if location else None

    location_ids = PermissionChecker.get_vendor_location_ids(salesperson, db)
    status_counts = (
        db.query(LoanApplication.status, func.count(LoanApplication.id))
        .filter(LoanApplication.location_id.in_(location_ids))
        .group_by(LoanApplication.status)
        .all()
    )
    total = (
        db.query(LoanApplication)
        .filter(LoanApplication.location_id.in_(location_ids))
        .count()
    )
    location_counts = (
        db.query(Location.location_name, func.count(LoanApplication.id))
        .join(LoanApplication, Location.id == LoanApplication.location_id)
        .filter(Location.vendor_id == location.vendor_id, Location.is_active == True)
        .group_by(Location.id, Location.location_name)
        .all()
    )
    return {
        "vendor": ResponseFormatter.format_vendor(vendor) if vendor else None,
        "total_applications": total,
        "by_status": {status: count for status, count in status_counts},
        "by_location": [{"location": loc_name, "count": count} for loc_name, count in location_counts],
    }
