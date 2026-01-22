from fastapi import APIRouter
from datetime import datetime, timezone
from core.settings import get_settings

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/healthz")
async def healthz():
    settings = get_settings()
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "time_utc": datetime.now(timezone.utc).isoformat(),
        "backend_url": settings.backend_url,
        "frontend_url": settings.frontend_url,
    }


@router.get("/auth-hints")
async def auth_hints():
    """Minimal, non-sensitive auth hints for debugging without admin header."""
    s = get_settings()
    authority = f"https://{s.azure_ad_tenant_name}.ciamlogin.com/{s.azure_ad_b2c_tenant_id}"
    return {
        "redirect_uri": f"{s.backend_url}/auth/callback",
        "frontend_callback": f"{s.frontend_url}/auth/callback-spa",
        "authority": authority,
        "issuer_expected": s.azure_ad_issuer,
    }
