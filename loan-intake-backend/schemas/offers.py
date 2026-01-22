"""Pydantic schemas for lender offers and aggregated response."""

from typing import List, Optional
from pydantic import BaseModel


class LenderOffer(BaseModel):
    offer_id: str
    lender_name: str
    decision: str  # "approved" | "conditional" | "declined"
    approved_amount: Optional[float] = None
    interest_rate: Optional[float] = None
    term_months: Optional[int] = None
    monthly_payment: Optional[float] = None
    conditions: List[str] = []
    decline_reason: Optional[str] = None
    generated_at: Optional[str] = None
    acknowledged: bool = True
    acknowledged_at: Optional[str] = None


class OffersResponse(BaseModel):
    application_id: int
    application_number: str
    total_lenders: int
    approved_offers: int
    conditional_offers: int
    declined_offers: int
    offers: List[LenderOffer]
    acknowledged_lenders: Optional[int] = None
    pending_lenders: Optional[int] = None
