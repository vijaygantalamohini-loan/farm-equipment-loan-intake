"""
MSAL client wrapper for Microsoft Entra External ID (CIAM) and Azure AD B2C.

Uses ConfidentialClientApplication to build auth URLs and exchange auth codes.
MSAL handles state/nonce generation and validation internally.

Authority selection:
- If a B2C policy name is configured (e.g. ``B2C_1_signupsignin``), build a
    B2C authority: ``https://{tenant}.b2clogin.com/{tenant}.onmicrosoft.com/{policy}``
- Otherwise, default to CIAM authority:
    ``https://{tenant}.ciamlogin.com/{tenant_id}``

Scopes are sanitized to avoid reserved OIDC scopes (openid, profile, offline_access).
"""

import msal
import os
from typing import Tuple, Dict, Any, Optional, List
from core.settings import get_settings
from logging_config import auth_logger


_flows: Dict[str, Dict[str, Any]] = {}

def _compute_authority(settings) -> str:
    """Return the appropriate authority URL for B2C or CIAM.

    - B2C: https://{tenant}.b2clogin.com/{tenant}.onmicrosoft.com/{policy}
    - CIAM: https://{tenant}.ciamlogin.com/{tenant_id}
    """
    tenant = settings.azure_ad_tenant_name
    tenant_id = settings.azure_ad_b2c_tenant_id
    policy = (settings.azure_ad_policy_name or "").strip()
    mode = (getattr(settings, "azure_auth_mode", "ciam") or "ciam").lower()

    use_b2c = (mode == "b2c") and bool(policy)
    if use_b2c:
        authority = f"https://{tenant}.b2clogin.com/{tenant}.onmicrosoft.com/{policy}"
    else:
        authority = f"https://{tenant}.ciamlogin.com/{tenant_id}"
    return authority


def _build_app() -> msal.ConfidentialClientApplication:
    """Build an MSAL client using B2C when a policy is configured, else CIAM."""
    settings = get_settings()
    authority = _compute_authority(settings)
    mode = getattr(settings, "azure_auth_mode", "unknown")
    auth_logger.info("msal_build_app", extra={"authority": authority, "mode": mode})
    try:
        return msal.ConfidentialClientApplication(
            client_id=settings.azure_ad_client_id,
            client_credential=settings.azure_ad_client_secret,
            authority=authority,
        )
    except Exception as e:
        # Fallback to CIAM if B2C authority is invalid/misconfigured
        tenant = settings.azure_ad_tenant_name
        tenant_id = settings.azure_ad_b2c_tenant_id
        ciam_authority = f"https://{tenant}.ciamlogin.com/{tenant_id}"
        auth_logger.error("msal_build_app_fallback_ciam", extra={"error": str(e), "original_authority": authority, "fallback_authority": ciam_authority})
        return msal.ConfidentialClientApplication(
            client_id=settings.azure_ad_client_id,
            client_credential=settings.azure_ad_client_secret,
            authority=ciam_authority,
        )


def _compute_scopes(settings) -> List[str]:
    """
    Determine scopes for MSAL requests, sanitizing reserved scopes.

    - Reads `AZURE_API_SCOPE` from env if present, else falls back to
      `settings.azure_api_scope`, else uses `<client_id>/.default`.
    - Removes reserved OIDC scopes: openid, profile, offline_access.
    - Accepts comma or space-separated values and trims whitespace.
    - If sanitization yields an empty list, falls back to `.default`.
    """
    env_scope = os.getenv("AZURE_API_SCOPE", "").strip()
    raw = env_scope or (settings.azure_api_scope or "")
    reserved = {"openid", "profile", "offline_access"}
    parts = [p.strip() for p in raw.replace(",", " ").split() if p.strip()]
    scopes = [p for p in parts if p not in reserved]
    if not scopes:
        # Use app default scope (API permissions configured on the app registration)
        scopes = [f"{settings.azure_ad_client_id}/.default"]
    auth_logger.info("msal_scopes_sanitized", extra={"scopes": scopes})
    return scopes


def build_auth_url(redirect_uri: str) -> Tuple[str, str]:
    """
    Create an authorization URL with MSAL; returns (url, state).
    CIAM-only authority to keep issuer consistent.
    """
    settings = get_settings()
    scopes = _compute_scopes(settings)
    app = _build_app()
    flow = app.initiate_auth_code_flow(scopes=scopes, redirect_uri=redirect_uri)
    _flows[flow["state"]] = flow
    auth_logger.info("msal_auth_url_ciam_success", extra={"redirect_uri": redirect_uri})
    return flow["auth_uri"], flow["state"]


def exchange_code(state: str, query_params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Exchange auth code for tokens using the stored flow.
    Returns token result (includes id_token_claims) or None on failure.
    """
    settings = get_settings()
    scopes = _compute_scopes(settings)

    app = _build_app()
    flow = _flows.pop(state, None)

    # Preferred: use stored flow (keeps state + PKCE)
    if flow:
        result = app.acquire_token_by_auth_code_flow(flow, query_params)
        if "error" not in result:
            return result
        # fall through to fallback if MSAL returns error

    # Fallback: if the server restarted and the state/flow is missing,
    # attempt a direct authorization_code exchange using the same scopes.
    code = query_params.get("code")
    redirect_uri = query_params.get("redirect_uri")
    if not code or not redirect_uri:
        return None

    result = app.acquire_token_by_authorization_code(
        code=code,
        scopes=scopes,
        redirect_uri=redirect_uri,
    )

    if not result or "error" in result:
        return None

    return result
