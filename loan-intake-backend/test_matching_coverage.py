from sqlalchemy.orm import Session
from uuid import uuid4
from database import SessionLocal, init_db, Lender, LenderPreference, LoanApplication, Salesperson
from services.loans.matching import match_application_to_lenders


def _ensure_salesperson(db: Session) -> Salesperson:
    init_db()
    sp = db.query(Salesperson).first()
    if not sp:
        # create minimal salesperson if seed not present
        sp = Salesperson(first_name="Test", last_name="User", email="t@example.com", location_id=1)
        db.add(sp)
        db.commit()
        db.refresh(sp)
    return sp


def _create_lender(db: Session, **prefs_kwargs) -> Lender:
    lender = Lender(name="Coverage Lender", contact_email="cov@example.com")
    db.add(lender)
    db.flush()
    pref = LenderPreference(lender_id=lender.id, **prefs_kwargs)
    db.add(pref)
    db.commit()
    return lender


def test_amount_ltv_with_tradein_and_cashdown_and_non_numeric_asset():
    db: Session = SessionLocal()
    try:
        sp = _ensure_salesperson(db)
        # Lender willing to do small loans and wide LTV
        _create_lender(db, min_loan_amount=0, max_loan_amount=1_000_000, ltv_min=0.0, ltv_max=1.0, equipment_types=["tractor"], naics_codes=["1111"], states=["IA"])        

        loan = {
            "purpose": "tractor",
            "cashDown": 10_000.0,
            "termMonths": 60,
            "naicsCode": "1111",
            "purchaseAssets": [
                {"valueEstimate": "abc", "equipmentType": "tractor"},
                {"valueEstimate": 100_000.0, "equipmentType": "tractor"},
            ],
            "tradeIns": [{"valueEstimate": 20_000.0}],
        }
        dealer = {"address": {"state": "IA"}}
        app = LoanApplication(
            salesperson_id=sp.id,
            location_id=sp.location_id,
            application_number=f"COV-MATCH-1-{uuid4().hex[:6].upper()}",
            status="submitted",
            borrower_data={"firstName": "A", "lastName": "B"},
            loan_data=loan,
            dealer_data=dealer,
        )
        db.add(app)
        db.commit()
        db.refresh(app)

        matches = match_application_to_lenders(db, app)
        assert isinstance(matches, list)
        # amount = 100k - 20k - 10k = 70k, ltv = 0.7 -> should match
        assert len(matches) >= 1
        assert matches[0].ltv == 0.7

    finally:
        db.close()


def test_equipment_type_from_purpose_and_reason_flags_without_naics():
    db: Session = SessionLocal()
    try:
        sp = _ensure_salesperson(db)
        lender = _create_lender(
            db,
            min_loan_amount=0,
            max_loan_amount=500_000,
            ltv_min=0.0,
            ltv_max=1.0,
            equipment_types=["sprayer"],
            naics_codes=["1151"],
            states=["NE"],
        )

        loan = {
            "purpose": "sprayer",  # derive equipment type from purpose
            "cashDown": 0.0,
            "termMonths": 12,
            # omit naicsCode to exercise reason without naics
            "purchaseAssets": [],
        }
        dealer = {"address": {"state": "NE"}}
        app = LoanApplication(
            salesperson_id=sp.id,
            location_id=sp.location_id,
            application_number=f"COV-MATCH-2-{uuid4().hex[:6].upper()}",
            status="submitted",
            borrower_data={"firstName": "A", "lastName": "B"},
            loan_data=loan,
            dealer_data=dealer,
        )
        db.add(app)
        db.commit()
        db.refresh(app)

        matches = match_application_to_lenders(db, app)
        # verify at least one match for our lender and reason excludes naics
        ours = [m for m in matches if m.lender_id == lender.id]
        assert len(ours) >= 1
        assert ours[0].reason.startswith("amount+ltv")
        assert "state" in ours[0].reason
        assert "naics" not in ours[0].reason

    finally:
        db.close()


def test_state_filter_mismatch_blocks_match():
    db: Session = SessionLocal()
    try:
        sp = _ensure_salesperson(db)
        _create_lender(db, min_loan_amount=0, max_loan_amount=100_000, ltv_min=0.0, ltv_max=1.0, equipment_types=["tractor"], naics_codes=["1111"], states=["IA"])        

        loan = {
            "purpose": "tractor",
            "cashDown": 0.0,
            "termMonths": 24,
            "naicsCode": "1111",
            "purchaseAssets": [{"valueEstimate": 50_000.0, "equipmentType": "tractor"}],
        }
        dealer = {"address": {"state": "MO"}}  # not in lender states
        app = LoanApplication(
            salesperson_id=sp.id,
            location_id=sp.location_id,
            application_number=f"COV-MATCH-3-{uuid4().hex[:6].upper()}",
            status="submitted",
            borrower_data={"firstName": "A", "lastName": "B"},
            loan_data=loan,
            dealer_data=dealer,
        )
        db.add(app)
        db.commit()
        db.refresh(app)

        matches = match_application_to_lenders(db, app)
        assert len(matches) == 0
    finally:
        db.close()
