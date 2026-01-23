from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class EquipmentIntelligenceRequest(BaseModel):
    make: str
    model: str
    year: int
    hours: Optional[int]
    serial_number: Optional[str]
    region: Optional[str]
    condition: Optional[str]
    loan_amount: float
    ltv: float


class ValuationResponse(BaseModel):
    rule_value: float
    blended_value: float
    confidence: float
    ml_value: Optional[float]


class IntelligenceResponse(BaseModel):
    valuation: ValuationResponse
    serial_number: Dict[str, Any]
    history: Dict[str, Any]
    predictive_resale: Dict[str, Any]
    risk_flags: List[str]
    overall_confidence: float
