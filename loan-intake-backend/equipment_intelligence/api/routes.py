from fastapi import APIRouter

from equipment_intelligence.api.schemas import (
    EquipmentIntelligenceRequest,
    IntelligenceResponse,
)
from equipment_intelligence.orchestrator.intelligence_orchestrator import intelligence_orchestrator

router = APIRouter(prefix="/equipment", tags=["equipment"])


@router.post("/intelligence", response_model=IntelligenceResponse)
async def get_equipment_intelligence(request: EquipmentIntelligenceRequest):
    result = intelligence_orchestrator(
        request.make,
        request.model,
        request.year,
        request.hours,
        request.serial_number,
        request.region,
        request.condition,
        request.loan_amount,
        request.ltv,
    )
    return result
