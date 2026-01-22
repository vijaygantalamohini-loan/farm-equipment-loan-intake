"""Draft creation and saving logic for loan applications."""

from sqlalchemy.orm import Session

from database import LoanApplication, Salesperson
from utils import ApplicationStatus, ResponseFormatter, ensure_unique_application_number
from logging_config import get_struct_logger

log = get_struct_logger("loans.drafts")
from schemas.loan import SaveDraftRequest
from services.loans import validation
from services.loans.intake import normalize_borrower_payload


def start_application(db: Session, salesperson: Salesperson) -> dict:
    log.info("create_draft_enter", salesperson_id=salesperson.id)
    app_number = ensure_unique_application_number(db)
    log.info("create_draft_number", application_number=app_number)
    loan_app = LoanApplication(
        salesperson_id=salesperson.id,
        location_id=salesperson.location_id,
        application_number=app_number,
        status=ApplicationStatus.DRAFT,
        borrower_data={},
        coborrower_data={},
        loan_data={},
        dealer_data={},
    )
    db.add(loan_app)
    log.info("create_draft_commit_attempt", salesperson_id=salesperson.id)
    db.commit()
    log.info("create_draft_commit_success", salesperson_id=salesperson.id)
    db.refresh(loan_app)
    log.info("create_draft_refresh_success", application_id=loan_app.id)

    log.info("loan_draft_started", application_id=loan_app.id, application_number=loan_app.application_number, salesperson_id=salesperson.id)

    return ResponseFormatter.success_response(
        message="Application started successfully",
        data={
            "application_id": loan_app.id,
            "application_number": loan_app.application_number,
            "status": loan_app.status,
        },
    )


def save_draft(db: Session, salesperson: Salesperson, application_id: int, draft_data: SaveDraftRequest):
    application = (
        db.query(LoanApplication)
        .filter(
            LoanApplication.id == application_id,
            LoanApplication.salesperson_id == salesperson.id,
        )
        .first()
    )
    if not application:
        return None

    if draft_data.borrower_data is not None:
        merged_borrower = dict(application.borrower_data or {})
        merged_borrower.update(draft_data.borrower_data)
        application.borrower_data = normalize_borrower_payload(merged_borrower)
    if draft_data.coborrower_data is not None:
        application.coborrower_data = draft_data.coborrower_data
    if draft_data.loan_data is not None:
        # Normalize loan_data to include a convenient top-level serialNumber if available
        ld = dict(draft_data.loan_data or {})

        def _trim(v):
            if isinstance(v, str):
                v2 = v.strip()
                return v2 if v2 != "" else None
            return v

        primary_serial = _trim(ld.get("serialNumber"))
        try:
            assets = ld.get("purchaseAssets") or []
            if not primary_serial and isinstance(assets, list) and len(assets) > 0:
                first = assets[0] or {}
                sn = _trim(first.get("serialNumber"))
                if sn:
                    primary_serial = sn
        except Exception:
            # If structure isn't as expected, skip normalization silently
            pass
        if primary_serial:
            ld["serialNumber"] = primary_serial
        # Trim and normalize purchase asset serial numbers
        try:
            incoming_assets = ld.get("purchaseAssets") or []
            existing_assets = (application.loan_data or {}).get("purchaseAssets") or []
            cleaned_assets = []
            for idx, a in enumerate(incoming_assets):
                a = dict(a or {})
                sn = _trim(a.get("serialNumber"))
                if sn is None and idx < len(existing_assets):
                    prev_sn = (existing_assets[idx] or {}).get("serialNumber")
                    if prev_sn:
                        a["serialNumber"] = prev_sn
                else:
                    a["serialNumber"] = sn
                cleaned_assets.append(a)
            ld["purchaseAssets"] = cleaned_assets
        except Exception:
            pass
        # Trim and normalize trade-in serial numbers if present
        try:
            incoming_trade_ins = ld.get("tradeIns") or []
            existing_trade_ins = (application.loan_data or {}).get("tradeIns") or []
            cleaned_trade_ins = []
            for idx, ti in enumerate(incoming_trade_ins):
                ti = dict(ti or {})
                sn = _trim(ti.get("serialNumber"))
                # If serialNumber missing/empty, preserve previously stored value for that index (if any)
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
        application.loan_data = ld
    if draft_data.dealer_data is not None:
        application.dealer_data = draft_data.dealer_data
    if draft_data.documents_and_consents_data is not None:
        application.documents_and_consents_data = draft_data.documents_and_consents_data

    if application.status == ApplicationStatus.DRAFT:
        application.status = ApplicationStatus.IN_PROGRESS

    db.commit()
    db.refresh(application)

    # Compute missing fields for guidance (not enforced)
    missing_fields = {
        "borrower": validation.missing_borrower_fields(application.borrower_data, draft_data.borrower_type or "individual")
    }
    if draft_data.has_coborrower or (draft_data.coborrower_data and len(draft_data.coborrower_data) > 0):
        missing_fields["coborrower"] = validation.missing_coborrower_fields(application.coborrower_data)
    missing_fields["loan"] = validation.missing_loan_fields(application.loan_data)

    log.info(
        "loan_draft_saved",
        application_id=application.id,
        application_number=application.application_number,
        salesperson_id=salesperson.id,
        status=application.status,
        # Helpful debug fields to verify serial numbers are captured
        serial_top=(application.loan_data or {}).get("serialNumber"),
        serials_purchase=[(a or {}).get("serialNumber") for a in ((application.loan_data or {}).get("purchaseAssets") or [])],
        serials_tradeins=[(t or {}).get("serialNumber") for t in ((application.loan_data or {}).get("tradeIns") or [])],
    )

    return ResponseFormatter.success_response(
        message="Draft saved successfully",
        data={
            "application_id": application.id,
            "application_number": application.application_number,
            "status": application.status,
            "missing_fields": missing_fields,
        },
    )
