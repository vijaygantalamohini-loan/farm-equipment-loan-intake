"""
Authorization and permission checking utilities.
Centralizes access control logic for multi-tenant architecture.
"""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from database import Salesperson, Location, LoanApplication
from utils.constants import Messages, StatusCodes


class PermissionChecker:
    """Helper class for checking user permissions"""
    
    @staticmethod
    def check_same_location_access(
        application: LoanApplication,
        current_salesperson: Salesperson
    ) -> bool:
        """
        Check if salesperson can access application from same location.
        Raises HTTPException if access denied.
        """
        if application.location_id != current_salesperson.location_id:
            raise HTTPException(
                status_code=StatusCodes.FORBIDDEN,
                detail=Messages.ERROR_ACCESS_DENIED
            )
        return True
    
    @staticmethod
    def check_same_vendor_access(
        application: LoanApplication,
        current_salesperson: Salesperson,
        db: Session
    ) -> bool:
        """
        Check if salesperson can access application from same vendor.
        Raises HTTPException if access denied.
        """
        # Get salesperson's vendor
        salesperson_location = db.query(Location).filter(
            Location.id == current_salesperson.location_id
        ).first()
        
        # Get application's vendor
        app_location = db.query(Location).filter(
            Location.id == application.location_id
        ).first()
        
        if not salesperson_location or not app_location:
            raise HTTPException(
                status_code=StatusCodes.NOT_FOUND,
                detail=Messages.ERROR_LOCATION_NOT_FOUND
            )
        
        if salesperson_location.vendor_id != app_location.vendor_id:
            raise HTTPException(
                status_code=StatusCodes.FORBIDDEN,
                detail=Messages.ERROR_ACCESS_DENIED
            )
        return True
    
    @staticmethod
    def get_vendor_location_ids(
        current_salesperson: Salesperson,
        db: Session
    ) -> list[int]:
        """
        Get all location IDs for the salesperson's vendor.
        Returns list of location IDs or raises HTTPException.
        """
        # Get salesperson's location
        location = db.query(Location).filter(
            Location.id == current_salesperson.location_id
        ).first()
        
        if not location:
            raise HTTPException(
                status_code=StatusCodes.NOT_FOUND,
                detail=Messages.ERROR_LOCATION_NOT_FOUND
            )
        
        # Get all active locations for this vendor
        vendor_locations = db.query(Location.id).filter(
            Location.vendor_id == location.vendor_id,
            Location.is_active == True
        ).all()
        
        return [loc_id[0] for loc_id in vendor_locations]
    
    @staticmethod
    def check_application_exists(
        application_id: int,
        db: Session
    ) -> LoanApplication:
        """
        Check if application exists and return it.
        Raises HTTPException if not found.
        """
        application = db.query(LoanApplication).filter(
            LoanApplication.id == application_id
        ).first()
        
        if not application:
            raise HTTPException(
                status_code=StatusCodes.NOT_FOUND,
                detail=Messages.ERROR_APPLICATION_NOT_FOUND
            )
        
        return application
