"""
Authentication service - Password hashing utilities.

Note: This app uses Azure AD B2C for authentication.
Password hashing is only used for admin-created accounts (if needed).
"""

from passlib.context import CryptContext

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """
    Hash a password for storing.
    Used only for admin-created accounts that don't use Azure AD.
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.
    Used only for admin-created accounts that don't use Azure AD.
    """
    return pwd_context.verify(plain_password, hashed_password)
