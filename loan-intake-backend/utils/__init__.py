"""
Utility modules for backend application.
Provides constants, permissions, response formatting, and helper functions.
"""

from .constants import ApplicationStatus, Messages, Defaults, StatusCodes
from .permissions import PermissionChecker
from .application_helpers import (
    generate_application_number,
    ensure_unique_application_number,
    group_applications_by_status
)

__all__ = [
    # Constants
    "ApplicationStatus",
    "Messages",
    "Defaults",
    "StatusCodes",
    
    # Permissions
    "PermissionChecker",

    # Responses
    "ResponseFormatter",
    
    # Application helpers
    "generate_application_number",
    "ensure_unique_application_number",
    "group_applications_by_status",
]


def __getattr__(name):
    """Lazy import heavy response utilities to avoid circular dependencies."""
    if name == "ResponseFormatter":
        from .responses import ResponseFormatter  # type: ignore import-not-found

        return ResponseFormatter
    raise AttributeError(f"module 'utils' has no attribute {name!r}")
