"""
Application utility functions.
Helper functions for loan application processing and generation.
"""

import secrets
from datetime import datetime
from sqlalchemy.orm import Session

from database import LoanApplication


def generate_application_number() -> str:
    """
    Generate unique application number.
    Format: LA-YYYYMMDD-XXXXXX (LA = Loan Application)
    """
    timestamp = datetime.now().strftime("%Y%m%d")
    random_suffix = secrets.token_hex(3).upper()
    return f"LA-{timestamp}-{random_suffix}"


def ensure_unique_application_number(db: Session) -> str:
    """
    Generate and ensure application number is unique in database.
    Retries if duplicate found (very rare).
    """
    app_number = generate_application_number()
    
    # Check for duplicates (extremely unlikely but possible)
    max_retries = 5
    retries = 0
    
    while retries < max_retries:
        existing = db.query(LoanApplication).filter(
            LoanApplication.application_number == app_number
        ).first()
        
        if not existing:
            return app_number
        
        # Generate new number if duplicate found
        app_number = generate_application_number()
        retries += 1
    
    # If still duplicate after retries, add timestamp
    return f"{app_number}-{datetime.now().strftime('%H%M%S')}"


def group_applications_by_status(applications: list[LoanApplication]) -> dict:
    """
    Group applications by status for dashboard view.
    Returns dict with three categories: in_progress, submitted, funded
    """
    from utils.responses import ResponseFormatter
    from utils.constants import ApplicationStatus
    
    in_progress = []
    submitted = []
    funded = []
    
    for app in applications:
        try:
            app_data = ResponseFormatter.format_dashboard_application(app)
        except Exception as exc:
            # Skip problematic row but log to errors
            try:
                from logging_config import errors_logger
            except Exception:
                import logging as _logging
                errors_logger = _logging.getLogger('errors')
            errors_logger.exception(
                "format_dashboard_application_failed",
                extra={"application_id": getattr(app, 'id', None), "status": getattr(app, 'status', None)}
            )
            continue
        
        # Categorize by status
        if app.status in {ApplicationStatus.FUNDED, ApplicationStatus.APPROVED}:
            # Treat approved applications as effectively funded for dashboard placement
            funded.append(app_data)
        elif app.status == ApplicationStatus.SUBMITTED:
            submitted.append(app_data)
        else:
            # Any other status (draft, in_progress, pending, etc.)
            in_progress.append(app_data)
    
    return {
        "in_progress": in_progress,
        "submitted": submitted,
        "funded": funded
    }
