"""
Debug Authentication Routes - Troubleshooting Azure AD B2C
"""

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
import os
from dotenv import load_dotenv
from core.security import require_admin
from core.settings import get_settings
from services import msal_client
from services.azure_ad_auth import get_azure_signing_keys
import urllib.parse

# Ensure env vars loaded
load_dotenv()

router = APIRouter(prefix="/debug", tags=["debug"], dependencies=[Depends(require_admin)])


@router.get("/auth-config")
async def get_auth_config():
    """
    Show current authentication configuration.
    Use this to verify environment variables and Azure AD settings.
    """
    from services.azure_ad_auth import (
        AZURE_AD_AUTHORITY,
        AZURE_AD_CLIENT_ID,
        AZURE_AD_POLICY_NAME,
        AZURE_AD_B2C_TENANT_ID,
    )
    
    settings = get_settings()
    backend_url = settings.backend_url or os.getenv("BACKEND_URL", "NOT_SET")
    frontend_url = settings.frontend_url or os.getenv("FRONTEND_URL", "NOT_SET")
    client_secret_set = "YES" if os.getenv("AZURE_AD_CLIENT_SECRET") else "NO"
    # Compute sanitized scopes consistent with MSAL client
    scopes = msal_client._compute_scopes(get_settings())
    scopes_param = urllib.parse.quote(" ".join(scopes))
    
    config = {
        "environment_variables": {
            "BACKEND_URL": backend_url,
            "FRONTEND_URL": frontend_url,
            "AZURE_AD_CLIENT_SECRET_SET": client_secret_set
        },
        "azure_ad_config": {
            "AUTHORITY": AZURE_AD_AUTHORITY,
            "CLIENT_ID": AZURE_AD_CLIENT_ID,
            "POLICY_NAME": AZURE_AD_POLICY_NAME,
            "TENANT_ID": AZURE_AD_B2C_TENANT_ID
        },
        "generated_urls": {
            "redirect_uri": f"{backend_url}/auth/callback",
            "authorization_url": (
                f"{AZURE_AD_AUTHORITY}/oauth2/v2.0/authorize?"
                f"client_id={AZURE_AD_CLIENT_ID}&"
                f"response_type=code&"
                f"redirect_uri={backend_url}/auth/callback&"
                f"response_mode=query&"
                f"scope={scopes_param}&"
                f"state=12345"
            )
        },
        "expected_azure_portal_config": {
            "redirect_uris": [
                f"{backend_url}/auth/callback",
                f"{frontend_url}/auth/callback"
            ],
            "implicit_grants": {
                "access_tokens": "MUST BE ENABLED",
                "id_tokens": "MUST BE ENABLED"
            },
            "user_flow_claims": {
                "required": [
                    "Email Addresses",
                    "Given Name",
                    "Surname",
                    "User's Object ID"
                ]
            }
        }
    }
    
    return JSONResponse(content=config, status_code=200)


@router.get("/auth-health")
async def auth_health():
    """
    Report current MSAL/CIAM auth health: authority, issuer, scopes,
    ability to initiate auth flow, and JWKS keys availability.
    """
    settings = get_settings()
    backend_url = settings.backend_url
    tenant_name = settings.azure_ad_tenant_name
    tenant_id = settings.azure_ad_b2c_tenant_id
    authority = f"https://{tenant_name}.ciamlogin.com/{tenant_id}"
    issuer = (os.getenv("AZURE_AD_ISSUER") or settings.azure_ad_issuer).strip()

    scopes = msal_client._compute_scopes(settings)
    redirect_uri = f"{backend_url}/auth/callback"

    flow_ok = False
    auth_uri_prefix = None
    state = None
    error = None
    try:
        auth_uri, st = msal_client.build_auth_url(redirect_uri)
        flow_ok = True
        auth_uri_prefix = auth_uri[:160]
        state = st
    except Exception as exc:
        error = str(exc)

    jwks_uri = f"{authority}/discovery/v2.0/keys"
    try:
        keys = get_azure_signing_keys(jwks_uri).get("keys", [])
        jwks_keys_count = len(keys)
    except Exception:
        jwks_keys_count = 0

    return {
        "backend_url": backend_url,
        "authority": authority,
        "issuer_expected": issuer,
        "scopes": scopes,
        "redirect_uri": redirect_uri,
        "flow": {
            "can_initiate": flow_ok,
            "authorization_url_prefix": auth_uri_prefix,
            "state": state,
            "error": error,
        },
        "jwks": {
            "uri": jwks_uri,
            "keys_count": jwks_keys_count,
        },
    }


@router.get("/test-auth-flow")
async def test_auth_flow():
    """
    Test the authentication flow step by step.
    Returns what would happen at each step.
    """
    from services.azure_ad_auth import AZURE_AD_AUTHORITY, AZURE_AD_CLIENT_ID
    
    backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
    redirect_uri = f"{backend_url}/auth/callback"
    
    auth_url = (
        f"{AZURE_AD_AUTHORITY}/oauth2/v2.0/authorize?"
        f"client_id={AZURE_AD_CLIENT_ID}&"
        f"response_type=code&"
        f"redirect_uri={redirect_uri}&"
        f"response_mode=query&"
        f"scope=openid%20profile%20email&"
        f"state=12345"
    )
    
    return {
        "step_1_frontend_clicks_login": {
            "action": "Frontend redirects to /auth/login"
        },
        "step_2_backend_generates_auth_url": {
            "generated_url": auth_url,
            "redirect_uri_used": redirect_uri
        },
        "step_3_user_redirected_to_azure": {
            "azure_authority": AZURE_AD_AUTHORITY,
            "note": "If you see 'resource removed' error here, check User Flow exists and claims are configured"
        },
        "step_4_azure_validates": {
            "checks": [
                f"redirect_uri '{redirect_uri}' is in App Registration",
                "Client ID matches",
                "User Flow B2C_1_signupsignin exists",
                "User Flow has Email, Given Name, Surname claims enabled"
            ]
        },
        "step_5_azure_redirects_back": {
            "redirect_to": f"{redirect_uri}?code=AUTHORIZATION_CODE&state=12345"
        },
        "step_6_backend_exchanges_code": {
            "action": "POST to Azure token endpoint",
            "receives": "id_token, access_token"
        },
        "step_7_backend_verifies_token": {
            "validates": "id_token signature and claims"
        },
        "step_8_backend_creates_user": {
            "action": "Get or create user in database"
        },
        "step_9_backend_redirects_to_frontend": {
            "redirect_to": f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/auth/callback?token=..."
        }
    }


@router.post("/test-token")
async def test_token(authorization: str = None):
    """
    Test if a token can be validated.
    Pass token in Authorization header: Bearer <token>
    """
    if not authorization:
        return {"error": "No Authorization header provided"}
    
    if not authorization.startswith("Bearer "):
        return {"error": "Authorization header must start with 'Bearer '"}
    
    token = authorization.replace("Bearer ", "")
    
    from services.azure_ad_auth import verify_azure_token
    
    # Try to verify token
    claims = verify_azure_token(token)
    
    if claims:
        return {
            "status": "valid",
            "claims": claims
        }
    else:
        return {
            "status": "invalid",
            "error": "Token verification failed",
            "hint": "Check browser console for token value and test with: POST /debug/test-token with header 'Authorization: Bearer <token>'"
        }
