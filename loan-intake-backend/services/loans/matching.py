from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from database import LoanApplication, Lender, LenderPreference, LenderMatch


def _compute_amount_and_ltv(app: LoanApplication) -> Tuple[float, float]:
    loan = app.loan_data or {}
    assets = (loan.get("purchaseAssets") or loan.get("purchase_assets") or [])
    trade_ins = loan.get("tradeIns") or loan.get("trade_ins") or []

    # Total equipment value from purchase assets
    total_equipment = 0.0
    for a in assets:
        try:
            total_equipment += float(a.get("valueEstimate") or 0)
        except Exception:
            pass

    # Total trade-in value
    total_tradein = 0.0
    for t in trade_ins:
        try:
            total_tradein += float(t.get("valueEstimate") or 0)
        except Exception:
            pass

    cash_down = 0.0
    try:
        cash_down = float(loan.get("cashDown") or loan.get("cash_down") or 0)
    except Exception:
        pass

    amount = max(0.0, total_equipment - total_tradein - cash_down)
    ltv = 0.0
    if total_equipment > 0:
        ltv = amount / total_equipment
    return amount, ltv


def _derive_equipment_type(loan: dict) -> str:
    equipment_type = (loan.get("purpose") or "")
    assets = (loan.get("purchaseAssets") or loan.get("purchase_assets") or [])
    first_asset = assets[0] if assets else None
    if first_asset and isinstance(first_asset, dict):
        equipment_type = first_asset.get("equipmentType") or equipment_type
    return equipment_type or ""


def _derive_naics_code(loan: dict) -> Optional[str]:
    return loan.get("naicsCode") or loan.get("naics_code")


def _derive_dealer_state(app: LoanApplication) -> Optional[str]:
    dealer = app.dealer_data or {}
    address = dealer.get("address") or {}
    state = address.get("state")
    return state


def _matches_preferences(pref: LenderPreference, app: LoanApplication) -> bool:
    loan = app.loan_data or {}
    amount, ltv = _compute_amount_and_ltv(app)

    # Amount range
    if amount < (pref.min_loan_amount or 0):
        return False
    if pref.max_loan_amount is not None and amount > pref.max_loan_amount:
        return False

    # LTV range
    if ltv < (pref.ltv_min or 0):
        return False
    if ltv > (pref.ltv_max or 1.0):
        return False

    # Equipment type (derive from first asset purpose/type)
    equipment_type = _derive_equipment_type(loan)

    if pref.equipment_types and isinstance(pref.equipment_types, list):
        if equipment_type and equipment_type not in pref.equipment_types:
            return False

    # NAICS
    naics_code = _derive_naics_code(loan)
    if pref.naics_codes and isinstance(pref.naics_codes, list):
        if naics_code and naics_code not in pref.naics_codes:
            return False

    # State
    state = _derive_dealer_state(app)
    if pref.states and isinstance(pref.states, list):
        if state and state not in pref.states:
            return False

    return True


def _score_ltv(ltv: float, pref: LenderPreference) -> float:
    min_ltv = pref.ltv_min if pref.ltv_min is not None else 0.0
    max_ltv = pref.ltv_max if pref.ltv_max is not None else 1.0
    if max_ltv <= min_ltv:
        return 1.0 if ltv >= min_ltv else 0.0
    if ltv < min_ltv or ltv > max_ltv:
        return 0.0
    span = max_ltv - min_ltv
    mid = min_ltv + (span / 2)
    score = 1.0 - (abs(ltv - mid) / (span / 2))
    return max(0.0, min(score, 1.0))


def _score_preference(has_pref: bool, is_match: bool, neutral: float) -> float:
    if not has_pref:
        return neutral
    return 1.0 if is_match else 0.0


def _score_risk_tier(risk_tier: Optional[str]) -> float:
    tier = (risk_tier or "").strip().lower()
    if tier == "low":
        return 1.0
    if tier == "medium":
        return 0.6
    if tier == "high":
        return 0.3
    return 0.5


def rank_lenders_with_scores(
    db: Session,
    app: LoanApplication,
    prequalification: Optional[Dict[str, Any]],
    equipment_intelligence: Optional[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Auto-match lenders after AI prequalification + equipment intelligence.
    Returns ranked lenders with match scores.
    """
    if not prequalification or not equipment_intelligence:
        return []

    loan = app.loan_data or {}
    amount, ltv = _compute_amount_and_ltv(app)
    equipment_type = _derive_equipment_type(loan)
    naics_code = _derive_naics_code(loan)
    dealer_state = _derive_dealer_state(app)
    risk_tier = prequalification.get("risk_tier") if isinstance(prequalification, dict) else None

    weights = {
        "ltv": 0.35,
        "equipment_type": 0.2,
        "naics": 0.15,
        "state": 0.15,
        "risk": 0.15,
    }

    ranked: List[Dict[str, Any]] = []
    lenders = db.query(Lender).filter(Lender.is_active == True).all()
    for lender in lenders:
        pref = lender.preferences
        if not pref:
            continue
        if not _matches_preferences(pref, app):
            continue

        equipment_match = equipment_type in (pref.equipment_types or []) if pref.equipment_types else True
        naics_match = naics_code in (pref.naics_codes or []) if pref.naics_codes else True
        state_match = dealer_state in (pref.states or []) if pref.states else True

        ltv_score = _score_ltv(ltv, pref)
        equipment_score = _score_preference(bool(pref.equipment_types), equipment_match, 0.6)
        naics_score = _score_preference(bool(pref.naics_codes), naics_match, 0.55)
        state_score = _score_preference(bool(pref.states), state_match, 0.6)
        risk_score = _score_risk_tier(risk_tier)

        score = (
            ltv_score * weights["ltv"]
            + equipment_score * weights["equipment_type"]
            + naics_score * weights["naics"]
            + state_score * weights["state"]
            + risk_score * weights["risk"]
        )

        ranked.append({
            "lender_id": lender.id,
            "lender_name": lender.name,
            "match_score": round(score * 100, 1),
            "loan_amount": round(amount, 2),
            "ltv": round(ltv, 4),
            "risk_tier": risk_tier,
            "score_breakdown": {
                "ltv": round(ltv_score, 3),
                "equipment_type": round(equipment_score, 3),
                "naics": round(naics_score, 3),
                "state": round(state_score, 3),
                "risk": round(risk_score, 3),
            },
        })

    ranked.sort(key=lambda item: item.get("match_score", 0), reverse=True)
    return ranked


def match_application_to_lenders(db: Session, app: LoanApplication) -> List[LenderMatch]:
    """Compute interested lenders for a given application and persist match records."""
    results: List[LenderMatch] = []
    amount, ltv = _compute_amount_and_ltv(app)

    lenders = db.query(Lender).filter(Lender.is_active == True).all()
    for lender in lenders:
        pref = lender.preferences
        if not pref:
            continue
        if _matches_preferences(pref, app):
            reason_parts = ["amount", "ltv"]
            loan = app.loan_data or {}
            if loan.get("naicsCode") or loan.get("naics_code"):
                reason_parts.append("naics")
            if pref.states:
                reason_parts.append("state")
            reason = "+".join(reason_parts)
            match = LenderMatch(
                application_id=app.id,
                lender_id=lender.id,
                loan_amount=amount,
                ltv=ltv,
                reason=reason,
            )
            db.add(match)
            results.append(match)
    db.commit()
    return results
