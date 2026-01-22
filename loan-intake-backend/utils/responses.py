"""
Response formatting utilities.
Standardizes API response structure across all endpoints.
"""

import logging
import os
from datetime import datetime
from typing import Optional, Dict, Any

from ai_prequalification.prequalification_engine import PrequalificationEngine
from ai_prequalification.schemas import PrequalificationRequest
from ai_prequalification.utils import (
    build_prequalification_payload,
    risk_tier_from_score,
)
from database import LoanApplication, Salesperson, Location, Vendor

log = logging.getLogger("ai_prequalification.dashboard")

DISABLE_PREQUAL = os.getenv("DISABLE_PREQUAL_ENGINE", "false").lower() == "true"

try:
    PREQUAL_ENGINE = None if DISABLE_PREQUAL else PrequalificationEngine()
except RuntimeError as exc:
    log.warning("prequalification_engine_disabled", extra={"reason": str(exc)})
    PREQUAL_ENGINE = None


class ResponseFormatter:
    """Helper class for formatting API responses"""
    
    @staticmethod
    def format_salesperson(salesperson: Salesperson) -> dict:
        """Format salesperson data for API response"""
        return {
            "id": salesperson.id,
            "name": f"{salesperson.first_name} {salesperson.last_name}",
            "email": salesperson.email,
            "first_name": salesperson.first_name,
            "last_name": salesperson.last_name
        }
    
    @staticmethod
    def format_location(location: Location) -> dict:
        """Format location data for API response"""
        return {
            "id": location.id,
            "name": location.location_name,
            "city": location.city,
            "state": location.state
        }
    
    @staticmethod
    def format_vendor(vendor: Vendor) -> dict:
        """Format vendor data for API response"""
        return {
            "id": vendor.id,
            "name": vendor.name
        }
    
    @staticmethod
    def format_loan_summary(application: LoanApplication) -> dict:
        """
        Format loan application for list views (summary).
        Used in dashboard, my-applications, location-applications, etc.
        """
        return {
            "id": application.id,
            "application_number": application.application_number,
            "status": application.status,
            "submitted_at": application.submitted_at,
            "salesperson_name": f"{application.salesperson.first_name} {application.salesperson.last_name}",
            "location_name": application.location.location_name
        }
    
    @staticmethod
    def format_loan_detail(application: LoanApplication) -> dict:
        """
        Format complete loan application data for detail view.
        Used when viewing full application details.
        """
        return {
            "id": application.id,
            "application_number": application.application_number,
            "status": application.status,
            "submitted_at": application.submitted_at,
            "updated_at": application.updated_at,
            "borrower_data": application.borrower_data,
            "coborrower_data": application.coborrower_data,
            "loan_data": application.loan_data,
            "dealer_data": application.dealer_data,
            "documents_and_consents_data": getattr(application, "documents_and_consents_data", None),
            "salesperson": ResponseFormatter.format_salesperson(application.salesperson),
            "location": ResponseFormatter.format_location(application.location)
        }
    
    @staticmethod
    def format_dashboard_application(application: LoanApplication) -> dict:
        """
        Format application for dashboard view.
        Extracts key fields from JSON for quick display.
        """
        # Extract borrower name from JSON (handle legacy string JSON)
        borrower_data = application.borrower_data or {}
        if isinstance(borrower_data, str):
            try:
                import json as _json
                borrower_data = _json.loads(borrower_data)
            except Exception:
                borrower_data = {}
        borrower_name = f"{borrower_data.get('firstName', '')} {borrower_data.get('lastName', '')}".strip() or "N/A"
        
        # Extract loan amount from JSON (handle legacy string JSON)
        loan_data = application.loan_data or {}
        if isinstance(loan_data, str):
            try:
                import json as _json
                loan_data = _json.loads(loan_data)
            except Exception:
                loan_data = {}
        loan_amount = loan_data.get('loanAmount', 0)
        
        # Extract equipment info
        equipment_info = loan_data.get('equipmentDescription', 'N/A')

        # Extract primary equipment serial number
        primary_serial = (
            loan_data.get('serialNumber')
            or (loan_data.get('purchaseAssets') or [{}])[0].get('serialNumber')
        )

        # Extract trade-in serial numbers if present
        trade_ins = loan_data.get('tradeIns') or []
        trade_in_serials = [ti.get('serialNumber') for ti in trade_ins if ti.get('serialNumber')]
        
        ai_score = None
        if PREQUAL_ENGINE:
            try:
                payload = build_prequalification_payload(
                    application.borrower_data,
                    loan_data,
                    application.dealer_data,
                )
                request_model = PrequalificationRequest(**payload)
                approval_probability = PREQUAL_ENGINE.predict_approval_probability(
                    request_model
                )
                risk_payload = PREQUAL_ENGINE.compute_risk_score(request_model)
                ai_score = {
                    "approval_probability": round(approval_probability, 2),
                    "risk_score": round(risk_payload["risk_score"], 1),
                    "risk_tier": risk_tier_from_score(risk_payload["risk_score"]),
                }
            except Exception as exc:  # pragma: no cover
                log.warning("dashboard_prequalification_error", extra={"error": str(exc), "application_id": application.id})

        return {
            "id": application.id,
            "application_number": application.application_number,
            "borrower_name": borrower_name,
            "loan_amount": loan_amount,
            "equipment": equipment_info,
            "submitted_at": application.submitted_at.isoformat() if application.submitted_at else None,
            "updated_at": application.updated_at.isoformat() if application.updated_at else None,
            "status": application.status,
            "serial_number": primary_serial,
            "trade_in_serials": trade_in_serials,
            "ai_score": ai_score,
        }
    
    @staticmethod
    def success_response(
        message: str,
        data: Optional[Dict[str, Any]] = None
    ) -> dict:
        """Standard success response format"""
        response = {
            "success": True,
            "message": message
        }
        if data:
            response.update(data)
        return response
    
    @staticmethod
    def error_response(
        message: str,
        error_code: Optional[str] = None
    ) -> dict:
        """Standard error response format"""
        response = {
            "success": False,
            "error": message
        }
        if error_code:
            response["error_code"] = error_code
        return response
