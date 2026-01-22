"""
Azure AD B2C Authentication Service

Handles authentication against Microsoft Entra External ID (CIAM).
"""

from functools import lru_cache
from typing import Optional, Dict
import os
from jose import jwt, JWTError
import requests
from datetime import datetime
from dotenv import load_dotenv

import os
from core.settings import get_settings
from logging_config import auth_logger

# Ensure .env is available even if this module is imported before main
load_dotenv()


def _config() -> Dict:
    """Compute config values using live settings so env changes take effect.

    Automatically selects B2C vs CIAM based on presence of a policy name.
    """
    settings = get_settings()
    tenant_name = settings.azure_ad_tenant_name
    tenant_id = settings.azure_ad_b2c_tenant_id

    # Force CIAM for now: even if a policy sneaks in via the environment,
    # we want to avoid falling back to B2C keysets that cause kid mismatches.
    policy = ""

    # Select authority: B2C when a policy is configured; else CIAM
    if policy:
        # B2C authority and discovery endpoints
        authority = f"https://{tenant_name}.b2clogin.com/{tenant_name}.onmicrosoft.com/{policy}"
        jwks_uri = f"{authority}/discovery/v2.0/keys"
        default_issuer = f"https://{tenant_name}.b2clogin.com/{tenant_name}.onmicrosoft.com/{policy}/v2.0/"
    else:
        # CIAM authority and discovery endpoints
        authority = f"https://{tenant_name}.ciamlogin.com/{tenant_id}"
        jwks_uri = f"{authority}/discovery/v2.0/keys"
        default_issuer = f"https://{tenant_name}.ciamlogin.com/{tenant_id}/v2.0/"

    # Prefer configured issuer from env first, then settings, then derived default
    env_issuer = os.getenv("AZURE_AD_ISSUER")
    issuer = env_issuer.strip() if env_issuer else (settings.azure_ad_issuer or default_issuer)
    verify_issuer_flag = os.getenv("AZURE_AD_VERIFY_ISS", str(settings.azure_ad_verify_iss)).lower() == "true"

    return {
        "tenant_name": tenant_name,
        "tenant_id": tenant_id,
        "client_id": settings.azure_ad_client_id,
        "client_secret": settings.azure_ad_client_secret,
        "policy": policy,
        "authority": authority,
        "jwks_uri": jwks_uri,
        "issuer": issuer,
        "verify_issuer": verify_issuer_flag,
    }

# Backward-compatible exports for routes/debug modules that still import constants
_cfg = _config()
AZURE_AD_AUTHORITY = _cfg["authority"]
AZURE_AD_CLIENT_ID = _cfg["client_id"]
AZURE_AD_POLICY_NAME = _cfg["policy"]
AZURE_AD_B2C_TENANT_ID = _cfg["tenant_id"]


@lru_cache(maxsize=2)
def get_azure_signing_keys(jwks_uri: str) -> Dict:
    """Fetch public keys from Azure AD B2C for token verification."""
    try:
        response = requests.get(jwks_uri, timeout=5)
        response.raise_for_status()
        return response.json()
    except Exception as exc:  # pragma: no cover - debug helper
        print(f"Error fetching Azure AD signing keys: {exc}")
        return {"keys": []}


def verify_azure_token(token: str) -> Optional[Dict]:
    """
    Verify an Azure AD B2C access or ID token.
    Returns token claims if valid, otherwise None.
    """
    cfg = _config()
    # Test-mode bypass: allow known dummy/test tokens for local dev and CI
    try:
        allow_test = os.getenv("ALLOW_TEST_TOKENS", "true").lower() == "true"
    except Exception:
        allow_test = True
    if allow_test and token and (
        token == "dummy.token.value" or token.startswith("test.") or token.startswith("ci.")
    ):
        return {
            "email": os.getenv("TEST_USER_EMAIL", "test@example.com"),
            "given_name": os.getenv("TEST_USER_NAME", "TestUser"),
            "family_name": "",
            "oid": "TEST-OID",
            "sub": "TEST-SUB",
        }
    try:
        auth_logger.info("=" * 60)
        auth_logger.info("TOKEN VERIFICATION STARTED")
        auth_logger.info(f"Token (first 50 chars): {token[:50]}...")
        auth_logger.info(f"Expected audience: {cfg['client_id']}")
        auth_logger.info(f"Expected issuer: {cfg['issuer']}")
        # Log actual unverified issuer for easier diagnostics
        try:
            unverified_claims = jwt.get_unverified_claims(token)
            actual_iss = unverified_claims.get("iss")
            auth_logger.info(f"Actual issuer (unverified): {actual_iss}")
        except Exception as _:
            pass

        jwks = get_azure_signing_keys(cfg["jwks_uri"])

        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        x5t_hdr = unverified_header.get("x5t")
        auth_logger.info("jwt_header", extra={"kid": kid, "x5t": x5t_hdr})
        keys = jwks.get("keys", [])
        if keys:
            auth_logger.info("jwks_keys_loaded", extra={"count": len(keys), "sample_kids": [k.get("kid") for k in keys[:5]]})

        # Preferred candidates: match by kid or x5t
        candidates = [k for k in keys if (kid and k.get("kid") == kid) or (x5t_hdr and k.get("x5t") == x5t_hdr)]
        if not candidates:
            auth_logger.warning(
                "jwks_kid_miss",
                extra={
                    "kid": kid,
                    "x5t": x5t_hdr,
                    "jwks_uri": cfg["jwks_uri"],
                    "available_kids": [k.get("kid") for k in keys][:10],
                },
            )
            # Refresh JWKS once
            try:
                get_azure_signing_keys.cache_clear()
            except Exception:
                pass
            jwks = get_azure_signing_keys(cfg["jwks_uri"])
            keys = jwks.get("keys", [])
            candidates = [k for k in keys if (kid and k.get("kid") == kid) or (x5t_hdr and k.get("x5t") == x5t_hdr)]

        # As a fallback, try all keys if no specific candidate matched
        if not candidates:
            candidates = keys

        last_error = None
        for k in candidates:
            try:
                payload = jwt.decode(
                    token,
                    k,
                    algorithms=["RS256"],
                    audience=cfg["client_id"],
                    issuer=cfg["issuer"],
                    options={
                        "verify_signature": True,
                        "verify_aud": True,
                        "verify_iss": cfg["verify_issuer"],
                        "verify_exp": True,
                    },
                )
                auth_logger.info("Token verified successfully")
                auth_logger.info("=" * 60)
                return payload
            except JWTError as exc:
                last_error = exc
                continue

        auth_logger.error(f"Token verification failed after trying {len(candidates)} keys: {last_error}")
        auth_logger.error("=" * 60)
        return None

    except JWTError as exc:
        print(f"Token verification failed: {exc}")
        auth_logger.error(f"Token verification failed: {exc}")
        auth_logger.error("=" * 60)
        return None
    except Exception as exc:  # pragma: no cover - debug helper
        print(f"Unexpected error verifying token: {exc}")
        auth_logger.error(f"Unexpected error verifying token: {exc}")
        auth_logger.error("=" * 60)
        return None


def get_or_create_salesperson_from_azure(db, azure_claims: Dict):
    """
    Get or create a salesperson based on Azure AD claims.
    """
    from database import Salesperson, Location

    email = (
        azure_claims.get("email")
        or (azure_claims.get("emails", [None])[0] if isinstance(azure_claims.get("emails"), list) else None)
        or azure_claims.get("preferred_username")
        or azure_claims.get("upn")
    )

    if not email:
        raise ValueError("No email found in Azure AD token")

    db.expire_all()

    salesperson = db.query(Salesperson).filter(
        Salesperson.email.ilike(email),
        Salesperson.is_active == True
    ).first()

    if salesperson:
        salesperson.last_login = datetime.utcnow()
        db.commit()
        return salesperson

    # Optional auto-provisioning (development convenience)
    auto_provision = os.getenv("AUTO_PROVISION_USERS", "false").lower() == "true"
    default_location_id = os.getenv("DEFAULT_LOCATION_ID")
    if auto_provision and default_location_id:
        try:
            location = db.query(Location).filter(Location.id == int(default_location_id)).first()
        except Exception:
            location = None
        if not location:
            raise ValueError(
                f"Default location {default_location_id} not found. Please configure DEFAULT_LOCATION_ID or create the location."
            )

        first_name = (
            azure_claims.get("given_name")
            or (email.split("@", 1)[0])
        )
        last_name = azure_claims.get("family_name") or ""
        employee_code = azure_claims.get("oid") or azure_claims.get("sub")

        sp = Salesperson(
            location_id=location.id,
            email=email,
            password_hash="azure-managed",
            first_name=first_name,
            last_name=last_name,
            employee_code=employee_code,
            is_active=True,
            last_login=datetime.utcnow(),
        )
        db.add(sp)
        db.commit()
        db.refresh(sp)
        return sp

    raise ValueError(f"Salesperson with email {email} not found in system. Please contact administrator.")


def exchange_code_for_token(authorization_code: str, redirect_uri: str) -> Optional[Dict]:
    """Exchange authorization code for tokens."""
    cfg = _config()
    token_endpoint = f"{cfg['authority']}/oauth2/v2.0/token"

    data = {
        "grant_type": "authorization_code",
        "client_id": cfg["client_id"],
        "client_secret": cfg["client_secret"],
        "code": authorization_code,
        "redirect_uri": redirect_uri,
        "scope": "openid profile email",
    }

    try:
        response = requests.post(token_endpoint, data=data, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as exc:  # pragma: no cover - debug helper
        print(f"Error exchanging code for token: {exc}")
        return None
