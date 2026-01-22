"""Submission logic for loan applications."""

from sqlalchemy.orm import Session
from database import LoanApplication, Salesperson
from utils import ApplicationStatus, Messages, ResponseFormatter, ensure_unique_application_number
from schemas.loan import LoanSubmissionRequest
from logging_config import get_struct_logger
from services.loans import validation
from services.loans.intake import normalize_borrower_payload
from fastapi import HTTPException, status

log = get_struct_logger("loans.submit")


def submit(db: Session, salesperson: Salesperson, data: LoanSubmissionRequest):
    borrower_type = validation.normalize_borrower_type(data.borrower_type)
    missing = {
        "borrower": validation.missing_borrower_fields(data.borrower_data, borrower_type),
        "loan": validation.missing_loan_fields(data.loan_data),
    }
    if data.has_coborrower or (data.coborrower_data and len(data.coborrower_data) > 0):
        missing["coborrower"] = validation.missing_coborrower_fields(data.coborrower_data)

    blocking_missing = {k: v for k, v in missing.items() if v}
    if blocking_missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Missing required fields", "missing_fields": blocking_missing},
        )

    if data.application_id:
        loan_app = (
            db.query(LoanApplication)
            .filter(
                LoanApplication.id == data.application_id,
                LoanApplication.salesperson_id == salesperson.id,
            )
            .first()
        )

        if not loan_app:
            return None

        loan_app.borrower_data = normalize_borrower_payload(data.borrower_data)
        loan_app.coborrower_data = data.coborrower_data
        # Normalize loan_data to ensure serial numbers are persisted similar to draft saves
        ld = dict(data.loan_data or {})
        primary_serial = ld.get("serialNumber")
        try:
            assets = ld.get("purchaseAssets") or []
            if not primary_serial and isinstance(assets, list) and len(assets) > 0:
                first = assets[0] or {}
                sn = first.get("serialNumber")
                if sn:
                    primary_serial = sn
        except Exception:
            pass
        if primary_serial:
            ld["serialNumber"] = primary_serial
        try:
            incoming_trade_ins = ld.get("tradeIns") or []
            existing_trade_ins = (loan_app.loan_data or {}).get("tradeIns") or []
            cleaned_trade_ins = []
            for idx, ti in enumerate(incoming_trade_ins):
                ti = dict(ti or {})
                sn = ti.get("serialNumber")
                if isinstance(sn, str):
                    sn = sn.strip()
                    if sn == "":
                        sn = None
                if sn is None and idx < len(existing_trade_ins):
                    prev_sn = (existing_trade_ins[idx] or {}).get("serialNumber")
                    if prev_sn:
                        ti["serialNumber"] = prev_sn
                else:
                    ti["serialNumber"] = sn
                cleaned_trade_ins.append(ti)
            ld["tradeIns"] = cleaned_trade_ins
        except Exception:
            pass
        loan_app.loan_data = ld
        loan_app.dealer_data = data.dealer_data
        loan_app.status = ApplicationStatus.SUBMITTED
    else:
        app_number = ensure_unique_application_number(db)
        # Normalize loan_data for new applications as well
        ld = dict(data.loan_data or {})
        primary_serial = ld.get("serialNumber")
        try:
            assets = ld.get("purchaseAssets") or []
            if not primary_serial and isinstance(assets, list) and len(assets) > 0:
                first = assets[0] or {}
                sn = first.get("serialNumber")
                if sn:
                    primary_serial = sn
        except Exception:
            pass
        if primary_serial:
            ld["serialNumber"] = primary_serial
        try:
            incoming_trade_ins = ld.get("tradeIns") or []
            cleaned_trade_ins = []
            for ti in incoming_trade_ins:
                ti = dict(ti or {})
                sn = ti.get("serialNumber")
                if isinstance(sn, str):
                    sn = sn.strip()
                    if sn == "":
                        sn = None
                ti["serialNumber"] = sn
                cleaned_trade_ins.append(ti)
            ld["tradeIns"] = cleaned_trade_ins
        except Exception:
            pass

        loan_app = LoanApplication(
            salesperson_id=salesperson.id,
            location_id=salesperson.location_id,
            borrower_data=normalize_borrower_payload(data.borrower_data),
            coborrower_data=data.coborrower_data,
            loan_data=ld,
            dealer_data=data.dealer_data,
            application_number=app_number,
            status=ApplicationStatus.SUBMITTED,
        )
        db.add(loan_app)

    db.commit()
    db.refresh(loan_app)

    log.info(
        "loan_submitted",
        application_id=loan_app.id,
        application_number=loan_app.application_number,
        salesperson_id=salesperson.id,
        status=loan_app.status,
    )

    return ResponseFormatter.success_response(
        message=Messages.SUCCESS_APPLICATION_SUBMITTED,
        data={
            "application_number": loan_app.application_number,
            "id": loan_app.id,
            "submitted_at": loan_app.submitted_at,
            "status": loan_app.status,
            "missing_fields": missing,
        },
    )
