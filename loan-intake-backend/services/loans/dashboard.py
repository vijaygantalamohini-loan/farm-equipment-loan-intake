"""Dashboard helpers for grouping applications."""

from sqlalchemy.orm import Session
import logging

from database import LoanApplication, Salesperson
from utils import ResponseFormatter, group_applications_by_status


def dashboard(db: Session, salesperson: Salesperson):
    try:
        logging.info("dashboard_fetch_start", extra={"salesperson_id": salesperson.id})
        all_applications = (
            db.query(LoanApplication)
            .filter(LoanApplication.salesperson_id == salesperson.id)
            .order_by(LoanApplication.submitted_at.desc())
            .all()
        )
        logging.info("dashboard_fetch_success", extra={"count": len(all_applications)})

        grouped_apps = group_applications_by_status(all_applications)

        return {
            "salesperson": ResponseFormatter.format_salesperson(salesperson),
            "summary": {
                "total": len(all_applications),
                "in_progress": len(grouped_apps["in_progress"]),
                "submitted": len(grouped_apps["submitted"]),
                "funded": len(grouped_apps["funded"]),
            },
            "applications": grouped_apps,
        }
    except Exception as exc:
        # Log unexpected grouping/serialization errors to errors.log too
        try:
            from logging_config import errors_logger
        except Exception:
            errors_logger = logging.getLogger('errors')
        logging.exception("dashboard_unexpected_error")
        errors_logger.error(
            "dashboard_unexpected_error",
            extra={"salesperson_id": getattr(salesperson, "id", None), "detail": str(exc)},
        )
        raise
