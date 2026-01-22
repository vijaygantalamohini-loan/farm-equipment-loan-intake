from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db, Lender, LenderPreference, LoanApplication, LenderMatch
from services.loans.matching import match_application_to_lenders

router = APIRouter(prefix="/lenders", tags=["Lenders"])


class LenderCreate(BaseModel):
    name: str
    contact_email: str | None = None
    contact_phone: str | None = None


class PreferenceInput(BaseModel):
    min_loan_amount: float = 0.0
    max_loan_amount: float | None = None
    ltv_min: float = 0.0
    ltv_max: float = 1.0
    equipment_types: list[str] | None = None
    naics_codes: list[str] | None = None
    states: list[str] | None = None


@router.get("/", response_model=list)
def list_lenders(db: Session = Depends(get_db)):
    lenders = db.query(Lender).all()
    return [{
        "id": l.id,
        "name": l.name,
        "contact_email": l.contact_email,
        "contact_phone": l.contact_phone,
        "is_active": l.is_active,
    } for l in lenders]


@router.post("/", response_model=dict)
def create_lender(payload: LenderCreate, db: Session = Depends(get_db)):
    lender = Lender(name=payload.name, contact_email=payload.contact_email, contact_phone=payload.contact_phone)
    db.add(lender)
    db.commit()
    db.refresh(lender)
    return {"id": lender.id, "name": lender.name}


@router.get("/{lender_id}/preferences", response_model=dict)
def get_preferences(lender_id: int, db: Session = Depends(get_db)):
    lender = db.get(Lender, lender_id)
    if not lender:
        raise HTTPException(status_code=404, detail="Lender not found")
    pref = db.query(LenderPreference).filter(LenderPreference.lender_id == lender.id).first()
    if not pref:
        return {}
    return {
        "min_loan_amount": pref.min_loan_amount,
        "max_loan_amount": pref.max_loan_amount,
        "ltv_min": pref.ltv_min,
        "ltv_max": pref.ltv_max,
        "equipment_types": pref.equipment_types or [],
        "naics_codes": pref.naics_codes or [],
        "states": pref.states or [],
    }


@router.post("/{lender_id}/preferences", response_model=dict)
def upsert_preferences(
    lender_id: int,
    payload: PreferenceInput,
    db: Session = Depends(get_db),
):
    lender = db.get(Lender, lender_id)
    if not lender:
        raise HTTPException(status_code=404, detail="Lender not found")
    pref = db.query(LenderPreference).filter(LenderPreference.lender_id == lender.id).first()
    if not pref:
        pref = LenderPreference(lender_id=lender.id)
        db.add(pref)
    pref.min_loan_amount = float(payload.min_loan_amount or 0.0)
    pref.max_loan_amount = float(payload.max_loan_amount) if payload.max_loan_amount is not None else None
    pref.ltv_min = float(payload.ltv_min or 0.0)
    pref.ltv_max = float(payload.ltv_max or 1.0)
    pref.equipment_types = payload.equipment_types or []
    pref.naics_codes = payload.naics_codes or []
    pref.states = payload.states or []
    db.commit()
    db.refresh(pref)
    return {
        "ok": True,
        "lender_id": lender.id,
    }


@router.post("/match/{application_id}", response_model=list)
def run_matching(application_id: int, db: Session = Depends(get_db)):
    app = db.get(LoanApplication, application_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    matches = match_application_to_lenders(db, app)
    return [{
        "lender_id": m.lender_id,
        "application_id": m.application_id,
        "loan_amount": m.loan_amount,
        "ltv": m.ltv,
        "reason": m.reason,
    } for m in matches]


@router.get("/matches/{application_id}", response_model=list)
def list_matches(application_id: int, db: Session = Depends(get_db)):
    rows = db.query(LenderMatch).filter(LenderMatch.application_id == application_id).all()
    return [{
        "lender_id": m.lender_id,
        "application_id": m.application_id,
        "loan_amount": m.loan_amount,
        "ltv": m.ltv,
        "reason": m.reason,
        "created_at": m.created_at.isoformat(),
    } for m in rows]
