import uuid
import pytest

from database import SessionLocal, Vendor, Location, Salesperson, LoanApplication
from services.loans import dashboard as dashboard_mod


def _seed_salesperson_with_apps(db, suffix: str):
    vendor = Vendor(name=f"V-{suffix}")
    db.add(vendor)
    db.flush()

    loc = Location(vendor_id=vendor.id, location_name=f"L-{suffix}", state="IA")
    db.add(loc)
    db.flush()

    sp = Salesperson(
        location_id=loc.id,
        email=f"sp-{suffix}@example.com",
        password_hash="x",
        first_name="Sam",
        last_name="Person",
    )
    db.add(sp)
    db.flush()

    # submitted
    db.add(
        LoanApplication(
            salesperson_id=sp.id,
            location_id=loc.id,
            borrower_data={"firstName": "A", "lastName": "One"},
            loan_data={"loanAmount": 10000, "equipmentDescription": "Tractor"},
            application_number=f"APP-{suffix}-S",
            status="submitted",
        )
    )
    # funded
    db.add(
        LoanApplication(
            salesperson_id=sp.id,
            location_id=loc.id,
            borrower_data={"firstName": "B", "lastName": "Two"},
            loan_data={"loanAmount": 20000, "equipmentDescription": "Combine"},
            application_number=f"APP-{suffix}-F",
            status="funded",
        )
    )
    # other (in_progress bucket)
    db.add(
        LoanApplication(
            salesperson_id=sp.id,
            location_id=loc.id,
            borrower_data={"firstName": "C", "lastName": "Three"},
            loan_data={"loanAmount": 30000, "equipmentDescription": "Baler"},
            application_number=f"APP-{suffix}-I",
            status="reviewing",
        )
    )
    db.commit()

    return sp


def test_dashboard_normal_summary_counts_and_structure():
    db = SessionLocal()
    try:
        sp = _seed_salesperson_with_apps(db, suffix=str(uuid.uuid4())[:8])
        result = dashboard_mod.dashboard(db, sp)

        assert result["salesperson"]["email"] == sp.email
        assert result["summary"]["total"] == 3
        assert result["summary"]["submitted"] == 1
        assert result["summary"]["funded"] == 1
        assert result["summary"]["in_progress"] == 1

        # Ensure applications groups exist
        apps = result["applications"]
        assert len(apps["submitted"]) == 1
        assert len(apps["funded"]) == 1
        assert len(apps["in_progress"]) == 1
    finally:
        db.close()


def test_dashboard_exception_path_logs_and_raises(monkeypatch):
    db = SessionLocal()
    try:
        sp = _seed_salesperson_with_apps(db, suffix=str(uuid.uuid4())[:8])

        def boom(_apps):
            raise RuntimeError("boom")

        # Replace the imported function inside module with raising stub
        monkeypatch.setattr(dashboard_mod, "group_applications_by_status", boom)

        with pytest.raises(RuntimeError):
            dashboard_mod.dashboard(db, sp)
    finally:
        db.close()


def test_dashboard_exception_fallback_errors_logger(monkeypatch):
    db = SessionLocal()
    try:
        sp = _seed_salesperson_with_apps(db, suffix=str(uuid.uuid4())[:8])

        def boom(_apps):
            raise RuntimeError("boom")

        # Force missing errors_logger to exercise fallback path
        import logging_config as lc
        monkeypatch.delattr(lc, "errors_logger", raising=False)

        monkeypatch.setattr(dashboard_mod, "group_applications_by_status", boom)

        with pytest.raises(RuntimeError):
            dashboard_mod.dashboard(db, sp)
    finally:
        db.close()
