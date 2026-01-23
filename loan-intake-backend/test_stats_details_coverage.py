from sqlalchemy.orm import Session
from uuid import uuid4
from sqlalchemy import func
from fastapi import HTTPException

from database import SessionLocal, init_db, Vendor, Location, Salesperson, LoanApplication
from services.loans import stats, details
from utils.constants import ApplicationStatus


def _mk_vendor_loc_sp(db: Session, vendor_name: str, loc_name: str, city: str, state: str, email: str, first: str, last: str) -> tuple[Vendor, Location, Salesperson]:
    vendor = Vendor(name=vendor_name)
    db.add(vendor)
    db.flush()
    loc = Location(vendor_id=vendor.id, location_name=loc_name, city=city, state=state, is_active=True)
    db.add(loc)
    db.flush()
    sp = Salesperson(location_id=loc.id, email=email, password_hash="x", first_name=first, last_name=last, is_active=True)
    db.add(sp)
    db.commit()
    db.refresh(vendor)
    db.refresh(loc)
    db.refresh(sp)
    return vendor, loc, sp


def _mk_app(db: Session, sp: Salesperson, app_num: str, status: str, borrower_first="A", borrower_last="B") -> LoanApplication:
    app = LoanApplication(
        salesperson_id=sp.id,
        location_id=sp.location_id,
        application_number=f"{app_num}-{uuid4().hex[:6].upper()}",
        status=status,
        borrower_data={"firstName": borrower_first, "lastName": borrower_last},
        loan_data={"loanAmount": 1000},
        dealer_data={"name": "D"},
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    return app


def test_my_and_location_and_vendor_applications_and_stats():
    init_db()
    db: Session = SessionLocal()
    try:
        unique = uuid4().hex[:6].upper()
        v1, l1, s1 = _mk_vendor_loc_sp(db, "Vendor1", "Loc1", "Ames", "IA", f"s1-{unique}@example.com", "Ann", "Alpha")
        # Another salesperson in same location
        s2 = Salesperson(location_id=l1.id, email=f"s2-{unique}@example.com", password_hash="x", first_name="Bob", last_name="Beta", is_active=True)
        db.add(s2)
        db.commit()
        db.refresh(s2)

        # Second location in same vendor
        l2 = Location(vendor_id=v1.id, location_name="Loc2", city="Boone", state="IA", is_active=True)
        db.add(l2)
        db.commit()
        db.refresh(l2)
        s3 = Salesperson(location_id=l2.id, email=f"s3-{unique}@example.com", password_hash="x", first_name="Carl", last_name="Gamma", is_active=True)
        db.add(s3)
        db.commit()
        db.refresh(s3)

        # Another vendor and location to ensure vendor filter works
        v2, l3, s4 = _mk_vendor_loc_sp(db, "Vendor2", "Loc3", "Dallas", "TX", f"s4-{unique}@example.com", "Dana", "Delta")

        # Create applications across salespeople and locations
        _mk_app(db, s1, "STAT-1", ApplicationStatus.SUBMITTED)
        _mk_app(db, s1, "STAT-2", ApplicationStatus.FUNDED)
        _mk_app(db, s2, "STAT-3", ApplicationStatus.SUBMITTED)
        _mk_app(db, s3, "STAT-4", ApplicationStatus.REVIEWING)
        _mk_app(db, s4, "STAT-5", ApplicationStatus.SUBMITTED)

        # My applications and stats (s1)
        mine = stats.my_applications(db, s1, None, limit=50)
        assert len(mine) == 2
        assert all(row["salesperson_name"].startswith("Ann ") for row in mine)
        mine_sub = stats.my_applications(db, s1, ApplicationStatus.SUBMITTED, limit=50)
        assert len(mine_sub) == 1
        mstats = stats.my_stats(db, s1)
        assert mstats["total_applications"] == 2
        assert mstats["by_status"].get(ApplicationStatus.SUBMITTED) == 1
        assert mstats["location"]["name"] == l1.location_name

        # Location applications and stats (s1 sees s1+s2)
        loc_apps = stats.location_applications(db, s1, None, limit=50)
        assert len(loc_apps) == 3
        lstats = stats.location_stats(db, s1)
        assert lstats["total_applications"] == 3
        names = [sp["name"] for sp in lstats["by_salesperson"]]
        assert "Ann Alpha" in names and "Bob Beta" in names

        # Vendor applications (should include loc1 + loc2 only)
        vend_apps = stats.vendor_applications(db, s1, None, limit=50)
        # Should include s1,s2,s3 apps but not s4 (different vendor)
        assert len(vend_apps) == 4
        vstats = stats.vendor_stats(db, s1)
        assert vstats["vendor"]["name"] == v1.name
        loc_counts = {row["location"]: row["count"] for row in vstats["by_location"]}
        assert loc_counts.get("Loc1") == 3
        assert loc_counts.get("Loc2") == 1

    finally:
        db.close()


def test_get_details_and_delete_application_rules():
    init_db()
    db: Session = SessionLocal()
    try:
        unique2 = uuid4().hex[:6].upper()
        v, l, s = _mk_vendor_loc_sp(db, "VendD", "LocD", "Ames", "IA", f"sd-{unique2}@example.com", "Sam", "Delta")
        # Create draft and submitted apps
        a_draft = _mk_app(db, s, "DET-1", ApplicationStatus.DRAFT)
        a_sub = _mk_app(db, s, "DET-2", ApplicationStatus.SUBMITTED)

        # get_details returns formatted detail
        detail = details.get_details(db, s, a_draft.id)
        assert detail["id"] == a_draft.id
        assert detail["salesperson"]["name"] == "Sam Delta"
        assert detail["location"]["name"] == l.location_name

        # delete_application: cannot delete submitted
        try:
            details.delete_application(db, s, a_sub.id)
            assert False, "Expected 400 for non-draft deletion"
        except HTTPException as exc:
            assert exc.status_code == 400

        # delete_application: wrong salesperson -> 403
        s_other = Salesperson(location_id=l.id, email=f"other-{unique2}@example.com", password_hash="x", first_name="Other", last_name="User", is_active=True)
        db.add(s_other)
        db.commit()
        db.refresh(s_other)
        try:
            details.delete_application(db, s_other, a_draft.id)
            assert False, "Expected 403 for different salesperson"
        except HTTPException as exc:
            assert exc.status_code == 403

        # delete_application: draft deletion succeeds
        resp = details.delete_application(db, s, a_draft.id)
        assert resp["success"] is True
        # delete_application: non-existent returns None
        assert details.delete_application(db, s, 999999) is None
    finally:
        db.close()
