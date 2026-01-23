"""
Centralized application settings.

Avoids scattered os.getenv calls and provides a single source of truth
for configuration values used across the application.
"""

import os
from functools import lru_cache
from typing import List


class Settings:
    """Lightweight settings loader backed by environment variables."""

    app_name: str = "Loan Intake OCR API"
    app_version: str = "4.0.0"

    # URLs
    backend_url: str
    frontend_url: str

    # Database
    database_url: str

    # Azure AD B2C / Microsoft Entra External ID
    azure_ad_tenant_name: str
    azure_ad_b2c_tenant_id: str
    azure_ad_client_id: str
    azure_ad_client_secret: str
    azure_ad_policy_name: str
    azure_ad_issuer: str
    azure_ad_verify_iss: bool
    azure_api_scope: str
    azure_auth_mode: str

    # CORS
    allow_origins: List[str]

    # Idempotency
    idempotency_ttl_seconds: int

    def __init__(self) -> None:
        # Prefer localhost for dev to avoid 127.0.0.1 vs localhost cookie/CS issues
        self.backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
        self.frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        self.database_url = os.getenv("DATABASE_URL", "sqlite:///./loan_intake.db")

        self.azure_ad_tenant_name = os.getenv("AZURE_AD_TENANT_NAME", "yourtenantname")
        self.azure_ad_b2c_tenant_id = os.getenv("AZURE_AD_B2C_TENANT_ID", "your-tenant-id")
        self.azure_ad_client_id = os.getenv("AZURE_AD_CLIENT_ID", "your-client-id")
        self.azure_ad_client_secret = os.getenv("AZURE_AD_CLIENT_SECRET", "your-client-secret")
        # Default to CIAM (no B2C policy). Set AZURE_AD_POLICY_NAME to enable B2C explicitly.
        self.azure_ad_policy_name = os.getenv("AZURE_AD_POLICY_NAME", "")
        self.azure_ad_issuer = os.getenv("AZURE_AD_ISSUER", f"https://{self.azure_ad_tenant_name}.ciamlogin.com/{self.azure_ad_b2c_tenant_id}/v2.0/")
        self.azure_ad_verify_iss = os.getenv("AZURE_AD_VERIFY_ISS", "true").lower() == "true"
        # Optional: API scope for MSAL (e.g., api://<app-id-uri>/access_as_user)
        self.azure_api_scope = os.getenv("AZURE_API_SCOPE", "")
        # Explicitly choose auth mode; default to CIAM for development
        self.azure_auth_mode = os.getenv("AZURE_AUTH_MODE", "ciam").lower()

        self.idempotency_ttl_seconds = int(os.getenv("IDEMPOTENCY_TTL_SECONDS", "3600"))

        # Allow comma-separated origins; default to explicit localhost variants for dev
        cors_origins = os.getenv(
            "CORS_ALLOW_ORIGINS",
            "http://127.0.0.1:3000,http://localhost:3000,http://127.0.0.1:3001,http://localhost:3001",
        )
        self.allow_origins = [origin.strip() for origin in cors_origins.split(",") if origin.strip()]


@lru_cache()
def get_settings() -> Settings:
    """Cached settings instance to avoid repeated env parsing."""
    return Settings()
