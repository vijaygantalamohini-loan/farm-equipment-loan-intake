from fastapi import APIRouter, HTTPException
import traceback
import logging

from equipment_intelligence.api.schemas import (
    EquipmentIntelligenceRequest,
    IntelligenceResponse,
)
from equipment_intelligence.orchestrator.intelligence_orchestrator import intelligence_orchestrator

router = APIRouter(prefix="/equipment", tags=["equipment"])
logger = logging.getLogger(__name__)


@router.post("/intelligence", response_model=IntelligenceResponse)
async def get_equipment_intelligence(request: EquipmentIntelligenceRequest):
    try:
        logger.info(f"Equipment intelligence request: {request.dict()}")
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
        logger.info(f"Equipment intelligence success")
        return result
    except Exception as e:
        logger.error(f"Equipment intelligence error: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Equipment intelligence error: {str(e)}")
