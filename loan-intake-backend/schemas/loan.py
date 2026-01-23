"""Pydantic schemas for loan routes."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from models.loan_application import BorrowerIntakePayload


class LoanSubmissionRequest(BaseModel):
    application_id: Optional[int] = None  # For updating existing draft
    borrower_type: Optional[str] = "individual"  # individual | business
    has_coborrower: Optional[bool] = False
    borrower_data: BorrowerIntakePayload
    coborrower_data: Optional[BorrowerIntakePayload] = None
    loan_data: dict
    dealer_data: Optional[dict] = None


class SaveDraftRequest(BaseModel):
    borrower_type: Optional[str] = "individual"
    has_coborrower: Optional[bool] = False
    borrower_data: Optional[BorrowerIntakePayload] = None
    coborrower_data: Optional[BorrowerIntakePayload] = None
    loan_data: Optional[dict] = None
    dealer_data: Optional[dict] = None
    documents_and_consents_data: Optional[dict] = None


class LoanResponse(BaseModel):
    id: int
    application_number: str
    status: str
    submitted_at: datetime
    salesperson_name: str
    location_name: str

    model_config = ConfigDict(from_attributes=True)
