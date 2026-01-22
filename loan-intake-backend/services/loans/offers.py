"""Loan offer retrieval and acceptance logic."""

import os
from datetime import datetime

from sqlalchemy.orm import Session

from ai_prequalification.prequalification_engine import PrequalificationEngine
from ai_prequalification.schemas import PrequalificationRequest
from ai_prequalification.utils import build_prequalification_payload, risk_tier_from_score
from database import LoanApplication, Salesperson
from services import MockLenderService
from utils import ApplicationStatus, PermissionChecker, ResponseFormatter
from logging_config import get_struct_logger

log = get_struct_logger("loans.offers")

DISABLE_PREQUAL = os.getenv("DISABLE_PREQUAL_ENGINE", "false").lower() == "true"

try:
    PREQUAL_ENGINE = None if DISABLE_PREQUAL else PrequalificationEngine()
except RuntimeError as exc:
    log.warning("prequalification_engine_disabled", extra={"reason": str(exc)})
    PREQUAL_ENGINE = None


def get_offers(db: Session, salesperson: Salesperson, application_id: int):
    application = PermissionChecker.check_application_exists(application_id, db)
    PermissionChecker.check_same_location_access(application, salesperson)

    application_data = {
        "id": application_id,
        "borrower": application.borrower_data,
        "coborrower": application.coborrower_data,
        "loan": application.loan_data,
        "dealer": application.dealer_data,
    }

    offers = MockLenderService.get_all_offers(application_data)

    prequalification_result = None
    if PREQUAL_ENGINE:
        payload = build_prequalification_payload(
            application.borrower_data,
            application.loan_data,
            application.dealer_data,
        )
        try:
            request_model = PrequalificationRequest(**payload)
            approval_probability = PREQUAL_ENGINE.predict_approval_probability(request_model)
            risk_payload = PREQUAL_ENGINE.compute_risk_score(request_model)
            prequalification_result = {
                "approval_probability": round(approval_probability, 2),
                "risk_score": round(risk_payload["risk_score"], 1),
                "risk_tier": risk_tier_from_score(risk_payload["risk_score"]),
                "flags": risk_payload["flags"],
            }
        except Exception:
            log.warning(
                "prequalification_engine_error",
                extra={"application_id": application_id}
            )

    # Compute acknowledgement/processing summary
    ack_count = len([o for o in offers if o.get("acknowledged")])
    pending_count = len(offers) - ack_count

    log.info(
        "loan_offers_retrieved",
        application_id=application_id,
        application_number=application.application_number,
        salesperson_id=salesperson.id,
        offers=len(offers),
    )

    response_payload = {
        "application_id": application_id,
        "application_number": application.application_number,
        "total_lenders": len(offers),
        "approved_offers": len([o for o in offers if o["decision"] == "approved"]),
        "conditional_offers": len([o for o in offers if o["decision"] == "conditional"]),
        "declined_offers": len([o for o in offers if o["decision"] == "declined"]),
        "acknowledged_lenders": ack_count,
        "pending_lenders": pending_count,
        "offers": offers,
    }
    if prequalification_result:
        response_payload["prequalification"] = prequalification_result
    return response_payload


def accept_offer(db: Session, salesperson: Salesperson, application_id: int, offer_id: str):
    application = PermissionChecker.check_application_exists(application_id, db)
    PermissionChecker.check_same_location_access(application, salesperson)

    application.status = ApplicationStatus.APPROVED
    application.loan_data["accepted_offer"] = {
        "offer_id": offer_id,
        "accepted_at": datetime.now().isoformat(),
        "accepted_by": salesperson.email,
    }

    db.commit()
    db.refresh(application)

    log.info(
        "loan_offer_accepted",
        application_id=application_id,
        offer_id=offer_id,
        salesperson_id=salesperson.id,
    )

    return ResponseFormatter.success_response(
        "Loan offer accepted successfully",
        ResponseFormatter.format_loan_detail(application),
    )
