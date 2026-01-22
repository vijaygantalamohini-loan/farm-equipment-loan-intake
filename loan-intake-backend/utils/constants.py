"""
Application constants and configuration values.
Centralized constants prevent typos and make updates easier.
"""

# Application Status Values
class ApplicationStatus:
    """Loan application status constants"""
    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    PENDING = "pending"
    SUBMITTED = "submitted"
    REVIEWING = "reviewing"
    APPROVED = "approved"
    FUNDED = "funded"
    DENIED = "denied"
    
    @classmethod
    def all_statuses(cls):
        """Get list of all valid statuses"""
        return [
            cls.DRAFT,
            cls.IN_PROGRESS,
            cls.PENDING,
            cls.SUBMITTED,
            cls.REVIEWING,
            cls.APPROVED,
            cls.FUNDED,
            cls.DENIED
        ]
    
    @classmethod
    def is_valid(cls, status: str) -> bool:
        """Check if status is valid"""
        return status in cls.all_statuses()


# API Response Messages
class Messages:
    """Standard API response messages"""
    # Success messages
    SUCCESS_APPLICATION_SUBMITTED = "Loan application submitted successfully"
    SUCCESS_APPLICATION_UPDATED = "Application updated successfully"
    SUCCESS_USER_CREATED = "User created successfully"
    SUCCESS_DATA_RETRIEVED = "Data retrieved successfully"
    
    # Error messages
    ERROR_APPLICATION_NOT_FOUND = "Application not found"
    ERROR_ACCESS_DENIED = "Access denied"
    ERROR_LOCATION_NOT_FOUND = "Location not found"
    ERROR_VENDOR_NOT_FOUND = "Vendor not found"
    ERROR_USER_NOT_FOUND = "User not found"
    ERROR_INVALID_TOKEN = "Invalid or expired token"
    ERROR_UNAUTHORIZED = "Unauthorized access"
    ERROR_INVALID_STATUS = "Invalid application status"
    ERROR_MISSING_FIELD = "Required field is missing"
    ERROR_DATABASE_ERROR = "Database error occurred"
    ERROR_AUTH_FAILED = "Authentication failed"


# Default Values
class Defaults:
    """Default values for queries and pagination"""
    MAX_APPLICATIONS_MY = 50
    MAX_APPLICATIONS_LOCATION = 100
    MAX_APPLICATIONS_VENDOR = 200
    SEARCH_RADIUS_METERS = 50000  # 50km
    DEALER_SEARCH_QUERY = "farm equipment dealer"


# Environment Variables Keys
class EnvVars:
    """Environment variable keys"""
    AZURE_AD_TENANT_NAME = "AZURE_AD_TENANT_NAME"
    AZURE_AD_CLIENT_ID = "AZURE_AD_CLIENT_ID"
    AZURE_AD_CLIENT_SECRET = "AZURE_AD_CLIENT_SECRET"
    AZURE_AD_POLICY_NAME = "AZURE_AD_POLICY_NAME"
    FRONTEND_URL = "FRONTEND_URL"
    BACKEND_URL = "BACKEND_URL"
    DATABASE_URL = "DATABASE_URL"
    GOOGLE_PLACES_API_KEY = "GOOGLE_PLACES_API_KEY"
    USPS_USER_ID = "USPS_USER_ID"


# HTTP Status Codes (semantic names)
class StatusCodes:
    """HTTP status codes with semantic names"""
    OK = 200
    CREATED = 201
    BAD_REQUEST = 400
    UNAUTHORIZED = 401
    FORBIDDEN = 403
    NOT_FOUND = 404
    CONFLICT = 409
    INTERNAL_SERVER_ERROR = 500
