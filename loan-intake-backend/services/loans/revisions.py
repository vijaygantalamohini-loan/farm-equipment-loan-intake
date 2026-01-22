"""Helpers for reopening and revising submitted loan applications."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from database import Salesperson
from utils import ApplicationStatus, PermissionChecker, ResponseFormatter
from services.loans import validation


def _infer_borrower_type(borrower: Optional[dict]) -> str:
    """Best-effort guess of borrower type when not explicitly provided."""
    borrower = borrower or {}
    business_keys = (
        "legalName",
        "entityType",
        "tin",
        "signerName",
        "signerTitle",
        "signerEmail",
        "signerPhone",
    )
    if any(borrower.get(key) for key in business_keys):
        return "business"
    return "individual"


def reopen_for_edits(
    db: Session,
    salesperson: Salesperson,
    application_id: int,
    *,
    reason: Optional[str] = None,
) -> dict:
    """Mark a submitted application as editable again so it can be revised."""
    application = PermissionChecker.check_application_exists(application_id, db)
    PermissionChecker.check_same_location_access(application, salesperson)

    if application.salesperson_id != salesperson.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only revise applications you created",
        )

    if application.status == ApplicationStatus.FUNDED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Funded applications cannot be revised",
        )

    if application.status == ApplicationStatus.APPROVED and (application.loan_data or {}).get(
        "accepted_offer"
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Applications with an accepted offer must be cancelled before revising",
        )

    previous_status = application.status
    changed_status = False
    if application.status not in (ApplicationStatus.DRAFT, ApplicationStatus.IN_PROGRESS):
        application.status = ApplicationStatus.IN_PROGRESS
        changed_status = True

    raw_loan_data = application.loan_data or {}
    if isinstance(raw_loan_data, str):
        try:
            raw_loan_data = json.loads(raw_loan_data)
        except json.JSONDecodeError:
            raw_loan_data = {}
    loan_snapshot = dict(raw_loan_data)
    history = loan_snapshot.get("revisionHistory")
    if not isinstance(history, list):
        history = []
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "performedBy": salesperson.email,
        "previousStatus": previous_status,
    }
    if reason:
        entry["reason"] = reason.strip()
    history.append(entry)
    loan_snapshot["revisionHistory"] = history
    if "accepted_offer" in loan_snapshot:
        loan_snapshot.pop("accepted_offer", None)
    application.loan_data = loan_snapshot

    db.commit()
    db.refresh(application)

    raw_borrower = application.borrower_data or {}
    if isinstance(raw_borrower, str):
        try:
            raw_borrower = json.loads(raw_borrower)
        except json.JSONDecodeError:
            raw_borrower = {}

    raw_coborrower = application.coborrower_data or {}
    if isinstance(raw_coborrower, str):
        try:
            raw_coborrower = json.loads(raw_coborrower)
        except json.JSONDecodeError:
            raw_coborrower = {}

    borrower_type = _infer_borrower_type(raw_borrower)
    missing_fields = {
        "borrower": validation.missing_borrower_fields(raw_borrower, borrower_type),
        "loan": validation.missing_loan_fields(application.loan_data or {}),
        "coborrower": validation.missing_coborrower_fields(raw_coborrower) if raw_coborrower else [],
    }

    message = "Application reopened for edits" if changed_status else "Application already editable"

    return ResponseFormatter.success_response(
        message,
        data={
            "application_id": application.id,
            "application_number": application.application_number,
            "status": application.status,
            "missing_fields": missing_fields,
            "previous_status": previous_status,
        },
    )
