from fastapi import APIRouter, Query, Request
from fastapi.responses import RedirectResponse
from core.settings import get_settings
from logging_config import auth_logger

settings = get_settings()
router = APIRouter(prefix="/auth", tags=["microsoft-entra-authentication"])


@router.get("/callback-spa")
async def callback_spa(
    request: Request,
    token: str = Query(None),
    user: str = Query(None),
    salesperson: str = Query(None)
):
    """
    SPA-friendly endpoint: writes token + user into localStorage then forwards to frontend dashboard.
    """
    payload = user or salesperson
    if not token or not payload:
        auth_logger.warning(
            "spa_callback_missing_payload",
            extra={
                "token_present": bool(token),
                "user_present": bool(user),
                "salesperson_present": bool(salesperson),
            },
        )
        return RedirectResponse(url=f"{settings.frontend_url}/login?error=true&message=Authentication+failed")

    import urllib.parse
    token_q = urllib.parse.quote(token)
    payload_q = urllib.parse.quote(payload)

    # Prefer dynamic origin for localhost dev to avoid stale FRONTEND_URL
    target_base = settings.frontend_url
    try:
        origin = request.headers.get("origin")
        referer = request.headers.get("referer")
        candidate = origin or referer
        if candidate:
            # Extract scheme://host:port from referer if present
            from urllib.parse import urlparse
            parsed = urlparse(candidate)
            base = f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme and parsed.netloc else None
            # Use dynamic base only for localhost to prevent cross-tenant issues in prod
            if base and "localhost" in base:
                target_base = base
    except Exception:
        # Fall back to configured frontend_url
        pass

    auth_logger.info(
        "spa_callback_redirect",
        extra={
            "origin": request.headers.get("origin"),
            "referer": request.headers.get("referer"),
            "target_base": target_base,
            "token_len": len(token) if token else 0,
            "user_len": len(payload) if payload else 0,
            "final_url_prefix": f"{target_base}/auth/callback-spa"[:120],
        },
    )

    response = RedirectResponse(
        url=f"{target_base}/auth/callback-spa?token={token_q}&user={payload_q}&salesperson={payload_q}",
        status_code=302,
    )
    # Set cookies so frontend can read token/user even if it can't parse query
    response.set_cookie("access_token", token, httponly=False, samesite="Lax", path="/")
    response.set_cookie("salesperson", payload, httponly=False, samesite="Lax", path="/")
    response.set_cookie("user", payload, httponly=False, samesite="Lax", path="/")
    auth_logger.info(
        "spa_callback_cookies_set",
        extra={
            "cookies_set": ["access_token", "salesperson", "user"],
        },
    )
    return response
