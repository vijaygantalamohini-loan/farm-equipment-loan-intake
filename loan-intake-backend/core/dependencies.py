"""
Shared FastAPI dependencies.

Centralizes common dependency functions so routers stay lean and
avoid circular imports.
"""

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from core.settings import get_settings
from database import get_db, Salesperson
from services.azure_ad_auth import get_or_create_salesperson_from_azure, verify_azure_token

security = HTTPBearer()


def get_settings_dependency():
    """Provide cached settings instance to request handlers."""
    return get_settings()


async def get_current_salesperson_azure(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Salesperson:
    """
    Dependency to get current authenticated salesperson from Azure AD token.
    """
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = credentials.credentials
    azure_claims = verify_azure_token(token)
    if not azure_claims:
        raise credentials_exception

    try:
        return get_or_create_salesperson_from_azure(db, azure_claims)
    except ValueError:
        raise credentials_exception
