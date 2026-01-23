import os
from fastapi import APIRouter, HTTPException

from ai_prequalification.prequalification_engine import PrequalificationEngine
from ai_prequalification.schemas import PrequalificationRequest, PrequalificationResponse

router = APIRouter(prefix="/prequalify", tags=["ai"])

DISABLE_PREQUAL = os.getenv("DISABLE_PREQUAL_ENGINE", "false").lower() == "true"

try:
    engine = None if DISABLE_PREQUAL else PrequalificationEngine()
    init_error: str | None = None
except RuntimeError as exc:  # pragma: no cover - best effort logging wrapper
    engine = None
    init_error = str(exc)


@router.post("", response_model=PrequalificationResponse)
async def prequalify(application: PrequalificationRequest):
    if engine is None:
        detail = init_error or "Prequalification engine is disabled"
        raise HTTPException(status_code=503, detail=detail)
    try:
        prediction = engine.predict_prequalification(application)
        approval_probability = prediction["approval_probability"]
        risk_payload = engine.compute_risk_score(
            application,
            approval_probability=approval_probability,
        )
        optimal_structure = engine.suggest_optimal_structure(
            application,
            approval_probability=approval_probability,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Error computing prequalification") from exc

    tracking_id = engine.last_tracking_id

    return PrequalificationResponse(
        approval_probability=round(approval_probability, 2),
        risk_score=round(risk_payload["risk_score"], 1),
        risk_tier=prediction["risk_tier"],
        flags=risk_payload["flags"],
        optimal_structure=optimal_structure,
        reasons=prediction.get("reasons", []),
        tracking_id=tracking_id,
    )
