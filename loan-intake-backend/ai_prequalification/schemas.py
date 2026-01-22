from datetime import date
from typing import List, Optional

from pydantic import BaseModel, Field


YEAR_MIN = 1990
YEAR_MAX = date.today().year + 1


class EquipmentItem(BaseModel):
    type: str = Field(..., description="Equipment category, e.g., Tractor, Harvester")
    year: int = Field(..., ge=YEAR_MIN, le=YEAR_MAX, description="Model year")
    value: float = Field(..., gt=0, description="Estimated value of the equipment")
    isNew: bool = Field(..., description="Whether the equipment is new")
    serialNumber: Optional[str] = Field(None, description="Optional serial number for underwriting")


class PrequalificationRequest(BaseModel):
    loan_amount: float = Field(..., gt=0, alias="loan_amount")
    equipment_list: List[EquipmentItem] = Field(..., description="List of primary assets being financed")
    borrower_income: float = Field(..., gt=0, description="Borrower annual income")
    credit_score: int = Field(ge=300, le=850, description="Borrower credit score")
    down_payment: float = Field(..., ge=0, description="Down payment amount")
    naics_code: str = Field(..., min_length=4, description="NAICS code describing the borrower business")
    state: str = Field(..., min_length=2, max_length=2, description="Two-letter state code for the dealer/borrower")
    trade_in_present: bool = Field(False, description="Whether the borrower is applying with a trade-in asset")
    loan_term_months: int = Field(..., gt=0, description="Requested loan term")
    prior_defaults: bool = Field(False, description="Whether the borrower has prior loan defaults")
    bankruptcy_history: bool = Field(False, description="Whether the borrower has bankruptcy history")


class OptimalStructure(BaseModel):
    recommended_down_payment: float = Field(..., description="Suggested down payment amount")
    recommended_term: int = Field(..., description="Suggested loan term in months")
    expected_monthly_payment: float = Field(..., description="Estimated monthly payment for the suggested structure")


class PrequalificationReason(BaseModel):
    code: str = Field(..., description="Short reason code")
    message: str = Field(..., description="Human-readable explanation")
    weight: float = Field(..., ge=0, le=1, description="Relative strength of the reason")


class PrequalificationResponse(BaseModel):
    approval_probability: float = Field(..., ge=0, le=1)
    risk_score: float = Field(..., ge=0, le=100)
    risk_tier: str = Field(..., description="High/Medium/Low risk tier")
    flags: List[str] = Field(default_factory=list, description="Flags contributing to the risk score")
    optimal_structure: OptimalStructure
    reasons: List[PrequalificationReason] = Field(
        default_factory=list,
        description="Top reasons affecting the prequalification decision",
    )
    tracking_id: Optional[str] = Field(
        default=None,
        description="Identifier used to reconcile predicted probability with eventual decision",
    )
