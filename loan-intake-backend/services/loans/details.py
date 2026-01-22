"""Loan detail and deletion helpers."""

from sqlalchemy.orm import Session
from fastapi import HTTPException

from database import LoanApplication, Salesperson
from utils import ApplicationStatus, PermissionChecker, ResponseFormatter


def get_details(db: Session, salesperson: Salesperson, application_id: int):
    application = PermissionChecker.check_application_exists(application_id, db)
    PermissionChecker.check_same_location_access(application, salesperson)
    return ResponseFormatter.format_loan_detail(application)


def delete_application(db: Session, salesperson: Salesperson, application_id: int):
    application = db.query(LoanApplication).filter(LoanApplication.id == application_id).first()
    if not application:
        return None

    if application.salesperson_id != salesperson.id:
        raise HTTPException(status_code=403, detail="You can only delete your own applications")

    if application.status not in [ApplicationStatus.DRAFT, ApplicationStatus.IN_PROGRESS]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete application with status '{application.status}'. Only draft and in_progress applications can be deleted.",
        )

    app_number = application.application_number
    db.delete(application)
    db.commit()

    return {
        "success": True,
        "message": f"Application {app_number} deleted successfully",
        "deleted_application_id": application_id,
    }
