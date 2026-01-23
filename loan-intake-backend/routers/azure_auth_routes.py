"""
Azure AD B2C Authentication Routes

Handles login via Azure AD B2C with OAuth2 authorization code flow.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Form, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from core.dependencies import get_current_salesperson_azure
from core.settings import get_settings
from database import get_db, Salesperson, LoanApplication
from schemas.auth import AzureTokenResponse
from services.azure_ad_auth import (
    verify_azure_token,
    get_or_create_salesperson_from_azure,
)
from jose import jwt
from services import msal_client
from logging_config import auth_logger

router = APIRouter(prefix="/auth", tags=["microsoft-entra-authentication"])
settings = get_settings()

# Get URLs at runtime (not at import time) to ensure .env is loaded
def get_frontend_url():
    return settings.frontend_url

def get_backend_url():
    return settings.backend_url


def _prune_state_cache(now: float) -> None:
    """Drop expired state entries to avoid unbounded growth."""
    expired_keys = [k for k, v in _state_cache.items() if now - v["ts"] > STATE_TTL_SECONDS]
    for k in expired_keys:
        _state_cache.pop(k, None)


@router.get("/login")
async def azure_login(request: Request, db: Session = Depends(get_db)):
    """
    Redirect user to Microsoft Entra External ID login page.
    Frontend should redirect user to this endpoint.
    In DEV_MODE, bypass Azure AD and create a test user.
    """
    # Check for dev mode bypass
    import os
    if os.getenv("DEV_MODE", "").lower() == "true":
        auth_logger.info("dev_mode_enabled", extra={"message": "Bypassing Azure AD authentication"})
        
        # Create or get test salesperson
        test_email = "dev@example.com"
        salesperson = db.query(Salesperson).filter(Salesperson.email == test_email).first()
        
        if not salesperson:
            salesperson = Salesperson(
                email=test_email,
                name="Dev User",
                location="Test Location",
                role="salesperson"
            )
            db.add(salesperson)
            db.commit()
            db.refresh(salesperson)
            auth_logger.info("dev_mode_user_created", extra={"email": test_email})
        
        # Create a simple JWT token
        from datetime import datetime, timedelta
        token_data = {
            "sub": test_email,
            "name": salesperson.name,
            "email": salesperson.email,
            "exp": datetime.utcnow() + timedelta(days=7)
        }
        access_token = jwt.encode(token_data, settings.secret_key, algorithm=settings.algorithm)
        
        # Redirect to frontend with token
        frontend_callback = f"{get_frontend_url()}/auth/callback?token={access_token}&user={salesperson.email}"
        auth_logger.info("dev_mode_redirect", extra={"redirect_url": frontend_callback[:100]})
        return RedirectResponse(url=frontend_callback)
    
    # Normal Azure AD flow
    redirect_uri = f"{get_backend_url()}/auth/callback"
    try:
        auth_logger.info(
            "auth_login_start",
            extra={
                "backend_url": get_backend_url(),
                "frontend_url": get_frontend_url(),
                "redirect_uri": redirect_uri,
                "client_id": settings.azure_ad_client_id,
                "tenant": settings.azure_ad_tenant_name,
            },
        )
        authorization_url, state = msal_client.build_auth_url(redirect_uri)
        # Trim auth URL for log safety
        auth_logger.info(
            "auth_login_url_built",
            extra={
                "state": state,
                "authorization_url_prefix": authorization_url[:120],
            },
        )
    except Exception as exc:  # pragma: no cover - defensive logging
        # Log the full stack to help diagnose authority/redirect URI issues
        auth_logger.exception(
            "auth_login_build_url_failed",
            extra={
                "error": str(exc),
                "backend_url": get_backend_url(),
                "tenant": settings.azure_ad_tenant_name,
                "tenant_id": settings.azure_ad_b2c_tenant_id,
                "redirect_uri": redirect_uri,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initiate login with Microsoft Entra External ID.",
        ) from exc

    return RedirectResponse(url=authorization_url)


@router.get("/callback")
async def azure_callback(
    code: str = Query(None),
    state: str = Query(None),
    token: str = Query(None),
    user: str = Query(None),
    salesperson: str = Query(None),
    error: str = Query(None),
    error_description: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    Azure AD B2C redirects here after user logs in.
    Exchange authorization code for access token.
    """
    try:
        auth_logger.info(
            "auth_callback_get",
            extra={
                "code_present": bool(code),
                "state_present": bool(state),
                "token_present": bool(token),
                "user_present": bool(user),
                "error": error,
                "error_description": error_description,
                "redirect_uri": f"{get_backend_url()}/auth/callback",
            },
        )
        redirect_uri = f"{get_backend_url()}/auth/callback"
        # Relay explicit errors from Azure for clearer UI feedback
        if error:
            msg = error_description or error
            return RedirectResponse(
                url=f"{get_frontend_url()}/login?error=true&message={msg.replace(' ', '+')}"
            )
        # If frontend hits backend with token/user, forward to SPA handler
        if token and user:
            auth_logger.info("auth_callback_forward_spa", extra={"token_present": True, "user_present": True})
            return RedirectResponse(
                url=f"{get_backend_url()}/auth/callback-spa?token={token}&user={user}&salesperson={user}"
            )
        if token and salesperson:
            auth_logger.info("auth_callback_forward_spa_salesperson", extra={"token_present": True, "salesperson_present": True})
            return RedirectResponse(
                url=f"{get_backend_url()}/auth/callback-spa?token={token}&user={salesperson}&salesperson={salesperson}"
            )

        if not code or not state:
            auth_logger.warning("auth_callback_missing_code", extra={"code_present": bool(code), "state_present": bool(state)})
            return RedirectResponse(
                url=f"{get_frontend_url()}/login?error=true&message=Missing+authorization+code"
            )

        token_response = msal_client.exchange_code(
            state,
            {
                "code": code,
                "state": state,
                "redirect_uri": redirect_uri,
            }
        )

        if not token_response:
            auth_logger.error("auth_code_exchange_failed", extra={"state": state})
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange authorization code"
            )

        id_token_claims = token_response.get("id_token_claims")
        id_token = token_response.get("id_token")
        auth_logger.info(
            "auth_callback_tokens_received",
            extra={
                "id_token_present": bool(id_token),
                "claims_keys": list(id_token_claims.keys()) if isinstance(id_token_claims, dict) else None,
            },
        )

        # Log header kid/x5t to diagnose JWKS mismatches
        try:
            hdr = jwt.get_unverified_header(id_token) if id_token else {}
            auth_logger.info("id_token_header", extra={"kid": hdr.get("kid"), "x5t": hdr.get("x5t")})
        except Exception:
            pass

        if not id_token or not id_token_claims:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No ID token received"
            )

        azure_claims = verify_azure_token(id_token)
        if not azure_claims:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Azure AD token"
            )
        
        # Get or create salesperson
        try:
            salesperson = get_or_create_salesperson_from_azure(db, azure_claims)
        except ValueError as e:
            # User not found and auto-provisioning disabled
            return RedirectResponse(
                url=f"{get_frontend_url()}/login?error=unauthorized&message={str(e)}"
            )
        
        # Get location and vendor info
        location = salesperson.location
        vendor = location.vendor if location else None
        
        # Build URL with user data for frontend
        import urllib.parse
        import json
        
        user_data = {
            "id": salesperson.id,
            "email": salesperson.email,
            "firstName": salesperson.first_name,
            "lastName": salesperson.last_name,
            "name": f"{salesperson.first_name} {salesperson.last_name}",
            "location": {
                "id": location.id,
                "name": location.location_name,
                "street": location.street,
                "city": location.city,
                "state": location.state,
                "zip": location.zip_code,
                "phone": location.phone,
                "email": location.email
            } if location else None,
            "vendor": {
                "id": vendor.id,
                "name": vendor.name,
                "contact": vendor.primary_contact,
                "phone": vendor.phone,
                "email": vendor.email
            } if vendor else None
        }
        
        # Redirect to frontend with token and user data
        # Send id_token to frontend (not access_token) because backend validates id_token
        user_data_encoded = urllib.parse.quote(json.dumps(user_data))
        return RedirectResponse(
            url=f"{get_backend_url()}/auth/callback-spa?token={id_token}&user={user_data_encoded}&salesperson={user_data_encoded}"
        )
        
    except Exception as e:
        print(f"Azure callback error: {e}")
        auth_logger.exception("auth_callback_get_exception", extra={"error": str(e)})
        return RedirectResponse(
            url=f"{get_frontend_url()}/login?error=true&message=Authentication failed"
        )


@router.post("/callback")
async def azure_callback_post(
    code: str = Form(None),
    state: str = Form(None),
    error: str = Form(None),
    error_description: str = Form(None),
    db: Session = Depends(get_db)
):
    """
    Handle Azure AD callback when response_mode=form_post is used.
    Mirrors the GET handler, but reads form fields.
    """
    try:
        auth_logger.info(
            "auth_callback_post",
            extra={
                "code_present": bool(code),
                "state_present": bool(state),
                "error": error,
                "error_description": error_description,
                "redirect_uri": f"{get_backend_url()}/auth/callback",
            },
        )
        # Forward explicit error codes back to login for clear diagnostics
        if error:
            msg = error_description or error
            return RedirectResponse(
                url=f"{get_frontend_url()}/login?error=true&message={msg.replace(' ', '+')}"
            )

        redirect_uri = f"{get_backend_url()}/auth/callback"
        if not code or not state:
            auth_logger.warning("auth_callback_missing_code_post", extra={"code_present": bool(code), "state_present": bool(state)})
            return RedirectResponse(
                url=f"{get_frontend_url()}/login?error=true&message=Missing+authorization+code"
            )

        token_response = msal_client.exchange_code(
            state,
            {
                "code": code,
                "state": state,
                "redirect_uri": redirect_uri,
            }
        )

        if not token_response:
            auth_logger.error("auth_code_exchange_failed_post", extra={"state": state})
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange authorization code"
            )

        id_token_claims = token_response.get("id_token_claims")
        id_token = token_response.get("id_token")
        auth_logger.info(
            "auth_callback_post_tokens_received",
            extra={
                "id_token_present": bool(id_token),
                "claims_keys": list(id_token_claims.keys()) if isinstance(id_token_claims, dict) else None,
            },
        )

        if not id_token or not id_token_claims:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No ID token received"
            )

        azure_claims = verify_azure_token(id_token)
        if not azure_claims:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Azure AD token"
            )

        try:
            salesperson = get_or_create_salesperson_from_azure(db, azure_claims)
        except ValueError as e:
            return RedirectResponse(
                url=f"{get_frontend_url()}/login?error=unauthorized&message={str(e)}"
            )

        location = salesperson.location
        vendor = location.vendor if location else None

        import urllib.parse
        import json

        user_data = {
            "id": salesperson.id,
            "email": salesperson.email,
            "firstName": salesperson.first_name,
            "lastName": salesperson.last_name,
            "name": f"{salesperson.first_name} {salesperson.last_name}",
            "location": {
                "id": location.id,
                "name": location.location_name,
                "street": location.street,
                "city": location.city,
                "state": location.state,
                "zip": location.zip_code,
                "phone": location.phone,
                "email": location.email
            } if location else None,
            "vendor": {
                "id": vendor.id,
                "name": vendor.name,
                "contact": vendor.primary_contact,
                "phone": vendor.phone,
                "email": vendor.email
            } if vendor else None
        }

        user_data_encoded = urllib.parse.quote(json.dumps(user_data))
        return RedirectResponse(
            url=f"{get_backend_url()}/auth/callback-spa?token={id_token}&user={user_data_encoded}&salesperson={user_data_encoded}"
        )

    except Exception as e:
        print(f"Azure callback POST error: {e}")
        auth_logger.exception("auth_callback_post_exception", extra={"error": str(e)})
        return RedirectResponse(
            url=f"{get_frontend_url()}/login?error=true&message=Authentication failed"
        )


@router.post("/verify", response_model=AzureTokenResponse)
async def verify_azure_token_endpoint(
    token: str,
    db: Session = Depends(get_db)
):
    """
    Verify an Azure AD token and return salesperson info.
    Used by frontend to validate tokens.
    """
    azure_claims = verify_azure_token(token)
    
    if not azure_claims:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    try:
        salesperson = get_or_create_salesperson_from_azure(db, azure_claims)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    
    location = salesperson.location
    vendor = location.vendor if location else None
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "salesperson": {
            "id": salesperson.id,
            "email": salesperson.email,
            "first_name": salesperson.first_name,
            "last_name": salesperson.last_name,
            "employee_code": salesperson.employee_code,
            "location_id": location.id if location else None,
            "location_name": location.location_name if location else None,
            "vendor_id": vendor.id if vendor else None,
            "vendor_name": vendor.name if vendor else None
        }
    }


@router.get("/profile")
async def get_user_profile(
    db: Session = Depends(get_db),
    current_salesperson: Salesperson = Depends(get_current_salesperson_azure)
):
    """
    Get current user's profile with multi-tenant context.
    Shows vendor, location, and salesperson details.
    """
    location = current_salesperson.location
    vendor = location.vendor if location else None
    
    # Count user's applications
    total_apps = db.query(LoanApplication).filter(
        LoanApplication.salesperson_id == current_salesperson.id
    ).count()
    
    return {
        "salesperson": {
            "id": current_salesperson.id,
            "email": current_salesperson.email,
            "first_name": current_salesperson.first_name,
            "last_name": current_salesperson.last_name,
            "employee_code": current_salesperson.employee_code,
            "phone": current_salesperson.phone,
            "last_login": current_salesperson.last_login,
            "total_applications": total_apps
        },
        "location": {
            "id": location.id,
            "name": location.location_name,
            "city": location.city,
            "state": location.state,
            "phone": location.phone,
            "email": location.email
        } if location else None,
        "vendor": {
            "id": vendor.id,
            "name": vendor.name,
            "primary_contact": vendor.primary_contact,
            "phone": vendor.phone,
            "email": vendor.email
        } if vendor else None
    }
