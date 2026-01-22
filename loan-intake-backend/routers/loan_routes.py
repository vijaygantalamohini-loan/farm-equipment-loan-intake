"""
Loan application routes - submission and management
"""

from fastapi import APIRouter, Depends, HTTPException, status, Header, UploadFile, File
import logging
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from sqlalchemy.orm import Session
from typing import Optional, List
from sqlalchemy import func

from core.dependencies import get_current_salesperson_azure
from database import get_db, LoanApplication, Salesperson, Location, Vendor
from schemas.loan import LoanSubmissionRequest, SaveDraftRequest, LoanResponse
from ai_prequalification.schemas import PrequalificationRequest
from services.ai_prequal_service import run_prequalification
from services.submit_application import run_one_click_submission, one_click_context
from services import MockLenderService
from services.loans import drafts, submit, stats, offers, dashboard, details, idempotency, revisions
from schemas.offers import OffersResponse
from models.loan_application import BORROWER_OPTIONAL_FIELD_KEYS
from utils import (
    ApplicationStatus,
    Messages,
    Defaults,
    StatusCodes,
    PermissionChecker,
    ResponseFormatter,
    ensure_unique_application_number,
    group_applications_by_status,
)

router = APIRouter(prefix="/loans", tags=["loans"])


@router.post("/start", response_model=dict)
async def start_loan_application(
    db: Session = Depends(get_db),
    current_salesperson: Salesperson = Depends(get_current_salesperson_azure),
    idempotency_key: str | None = Header(default=None, convert_underscores=False, alias="Idempotency-Key")
):
    """
    Start a new loan application.
    Generates application number and creates draft entry.
    Returns application_id and application_number to track progress.
    """
    try:
        logging.info(
            "start_application_requested",
            extra={
                "salesperson_id": getattr(current_salesperson, "id", None),
                "salesperson_email": getattr(current_salesperson, "email", None),
            },
        )
        # If provided, enforce idempotency and return the latest existing application on duplicate
        if idempotency_key and not idempotency.check_and_store(db, idempotency_key):
            logging.info(
                "start_application_idempotent_duplicate",
                extra={
                    "salesperson_id": getattr(current_salesperson, "id", None),
                    "salesperson_email": getattr(current_salesperson, "email", None),
                },
            )
            existing = (
                db.query(LoanApplication)
                .filter(LoanApplication.salesperson_id == current_salesperson.id)
                .order_by(LoanApplication.id.desc())
                .first()
            )
            if existing:
                return {
                    "application_id": existing.id,
                    "application_number": existing.application_number,
                    "status": existing.status,
                }
            # Fall through to create if none found

        result = drafts.start_application(db, current_salesperson)
        logging.info(
            "start_application_success",
            extra={
                "application_id": result.get("application_id"),
                "application_number": result.get("application_number"),
            },
        )
        return result
    except Exception:
        logging.exception("Error in /loans/start handler")
        raise


@router.put("/{application_id}/save-draft", response_model=dict)
async def save_draft(
    application_id: int,
    draft_data: SaveDraftRequest,
    db: Session = Depends(get_db),
    current_salesperson: Salesperson = Depends(get_current_salesperson_azure),
    idempotency_key: str | None = Header(default=None, convert_underscores=False, alias="Idempotency-Key")
):
    """
    Save draft application data.
    Allows saving progress at any step of the application process.
    """
    if idempotency_key and not idempotency.check_and_store(db, idempotency_key):
        return {"success": True, "message": "Duplicate request ignored via idempotency key"}

    result = drafts.save_draft(db, current_salesperson, application_id, draft_data)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found or access denied"
        )
    result["borrower_optional_fields"] = BORROWER_OPTIONAL_FIELD_KEYS
    return result


@router.patch("/{application_id}/save-draft", response_model=dict)
async def save_draft_patch(
    application_id: int,
    draft_data: SaveDraftRequest,
    db: Session = Depends(get_db),
    current_salesperson: Salesperson = Depends(get_current_salesperson_azure),
    idempotency_key: str | None = Header(default=None, convert_underscores=False, alias="Idempotency-Key")
):
    """PATCH variant for partial draft saves."""
    if idempotency_key and not idempotency.check_and_store(db, idempotency_key):
        return {"success": True, "message": "Duplicate request ignored via idempotency key"}
    result = drafts.save_draft(db, current_salesperson, application_id, draft_data)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found or access denied"
        )
    result["borrower_optional_fields"] = BORROWER_OPTIONAL_FIELD_KEYS
    return result


class LoanResponse(BaseModel):
    id: int
    application_number: str
    status: str
    submitted_at: datetime
    salesperson_name: str
    location_name: str
    
    model_config = ConfigDict(from_attributes=True)


class ReopenRequest(BaseModel):
    reason: Optional[str] = None


@router.post("/submit", response_model=dict)
async def submit_loan_application(
    loan_data: LoanSubmissionRequest,
    db: Session = Depends(get_db),
    current_salesperson: Salesperson = Depends(get_current_salesperson_azure),
    idempotency_key: str | None = Header(default=None, convert_underscores=False, alias="Idempotency-Key")
):
    """
    Submit loan application (final step).
    Can create new application or update existing draft.
    If application_id provided, updates existing draft to submitted status.
    """
    
    if idempotency_key and not idempotency.check_and_store(db, idempotency_key):
        return {"success": True, "message": "Duplicate submission ignored via idempotency key"}

    result = submit.submit(db, current_salesperson, loan_data)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found or access denied"
        )
    result["borrower_optional_fields"] = BORROWER_OPTIONAL_FIELD_KEYS
    return result


@router.get("/my-applications", response_model=List[LoanResponse])
async def get_my_loan_applications(
    db: Session = Depends(get_db),
    current_salesperson: Salesperson = Depends(get_current_salesperson_azure),
    status_filter: Optional[str] = None,
    limit: int = Defaults.MAX_APPLICATIONS_MY
):
    """
    Get loan applications submitted by current salesperson.
    """
    return stats.my_applications(db, current_salesperson, status_filter, limit)


@router.get("/location-applications", response_model=List[LoanResponse])
async def get_location_applications(
    db: Session = Depends(get_db),
    current_salesperson: Salesperson = Depends(get_current_salesperson_azure),
    status_filter: Optional[str] = None,
    limit: int = Defaults.MAX_APPLICATIONS_LOCATION
):
    """
    Get all loan applications from current salesperson's location.
    Allows team visibility within same location.
    """
    return stats.location_applications(db, current_salesperson, status_filter, limit)


@router.get("/dashboard")
async def get_dashboard(
    db: Session = Depends(get_db),
    current_salesperson: Salesperson = Depends(get_current_salesperson_azure)
):
    """
    Get dashboard data for current salesperson.
    Returns applications grouped by status: in_progress, submitted, funded.
    """
    
    try:
        print("\n=== DASHBOARD DEBUG ===")
        print(f"Salesperson: {current_salesperson.email}")
        
        response_data = dashboard.dashboard(db, current_salesperson)
        print("Response ready, returning...")
        print("=======================\n")
        return response_data
    except Exception as e:
        # Log to files with full stack for easier diagnosis
        logging.exception("Error in /loans/dashboard handler")
        try:
            from logging_config import errors_logger
        except Exception:
            errors_logger = logging.getLogger('errors')
        # Mirror to errors.log with request context
        errors_logger.exception(
            "dashboard_handler_exception",
            extra={
                "endpoint": "/loans/dashboard",
                "salesperson_id": getattr(current_salesperson, "id", None),
                "salesperson_email": getattr(current_salesperson, "email", None),
            },
        )
        print(f"ERROR in dashboard: {e}")
        print(f"Error type: {type(e)}")
        import traceback
        traceback.print_exc()
        print(f"=======================\n")
        raise


@router.get("/{application_id}", response_model=dict)
async def get_loan_application_details(
    application_id: int,
    db: Session = Depends(get_db),
    current_salesperson: Salesperson = Depends(get_current_salesperson_azure)
):
    """
    Get detailed loan application data.
    Only accessible by salesperson from same location.
    """
    return details.get_details(db, current_salesperson, application_id)


@router.delete("/{application_id}", response_model=dict)
async def delete_loan_application(
    application_id: int,
    db: Session = Depends(get_db),
    current_salesperson: Salesperson = Depends(get_current_salesperson_azure)
):
    """
    Delete a loan application.
    Only draft and in_progress applications can be deleted.
    Only accessible by the salesperson who created it.
    """
    result = details.delete_application(db, current_salesperson, application_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application {application_id} not found"
        )
    return result


@router.get("/vendor-applications", response_model=List[LoanResponse])
async def get_vendor_applications(
    db: Session = Depends(get_db),
    current_salesperson: Salesperson = Depends(get_current_salesperson_azure),
    status_filter: Optional[str] = None,
    limit: int = Defaults.MAX_APPLICATIONS_VENDOR
):
    """
    Get all loan applications from current salesperson's vendor (all locations).
    Allows vendor-wide visibility for management.
    """
    return stats.vendor_applications(db, current_salesperson, status_filter, limit)


@router.get("/stats/my-stats")
async def get_my_statistics(
    db: Session = Depends(get_db),
    current_salesperson: Salesperson = Depends(get_current_salesperson_azure)
):
    """
    Get statistics for current salesperson's applications.
    """
    return stats.my_stats(db, current_salesperson)


@router.get("/stats/location-stats")
async def get_location_statistics(
    db: Session = Depends(get_db),
    current_salesperson: Salesperson = Depends(get_current_salesperson_azure)
):
    """
    Get statistics for current salesperson's location.
    """
    return stats.location_stats(db, current_salesperson)


@router.get("/stats/vendor-stats")
async def get_vendor_statistics(
    db: Session = Depends(get_db),
    current_salesperson: Salesperson = Depends(get_current_salesperson_azure)
):
    """
    Get statistics for current salesperson's vendor (all locations).
    """
    return stats.vendor_stats(db, current_salesperson)


@router.post("/{application_id}/get-offers", response_model=OffersResponse)
async def get_loan_offers(
    application_id: int,
    db: Session = Depends(get_db),
    current_salesperson: Salesperson = Depends(get_current_salesperson_azure)
):
    """
    Submit application to mock lenders and get loan offers.
    Returns aggregated offers from multiple lenders.
    """
    return offers.get_offers(db, current_salesperson, application_id)


@router.post("/{application_id}/accept-offer")
async def accept_loan_offer(
    application_id: int,
    offer_id: str,
    db: Session = Depends(get_db),
    current_salesperson: Salesperson = Depends(get_current_salesperson_azure)
):
    """
    Accept a loan offer from a lender.
    Updates application status to 'approved' or 'funded'.
    """
    return offers.accept_offer(db, current_salesperson, application_id, offer_id)


@router.post("/{application_id}/reopen", response_model=dict)
async def reopen_application_for_edits(
    application_id: int,
    payload: ReopenRequest | None = None,
    db: Session = Depends(get_db),
    current_salesperson: Salesperson = Depends(get_current_salesperson_azure),
):
    """Allow the owning salesperson to reopen a submitted application."""
    reason = (payload.reason if payload else None) or None
    return revisions.reopen_for_edits(
        db,
        current_salesperson,
        application_id,
        reason=reason,
    )


@router.post("/prequalify", response_model=dict)
async def prequalify_loan(
    payload: PrequalificationRequest,
    current_salesperson: Salesperson = Depends(get_current_salesperson_azure),
):
    """
    Proxy to AI prequalification engine using validated payload.
    """
    try:
        return await run_prequalification(payload.model_dump(by_alias=True))
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/one-click-submit", response_model=dict)
async def one_click_submit(
    id_image: UploadFile = File(...),
    invoice_image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_salesperson: Salesperson = Depends(get_current_salesperson_azure),
):
    """
    One-click submit endpoint.
    """
    try:
        with one_click_context(db, current_salesperson):
            return await run_one_click_submission(id_image, invoice_image)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
