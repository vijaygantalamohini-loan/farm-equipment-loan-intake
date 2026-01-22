"""
Basic security utilities and dependencies.
"""

import os
from dotenv import load_dotenv
from fastapi import HTTPException, Header


# Ensure .env variables are loaded before reading ADMIN_API_TOKEN
load_dotenv()
ADMIN_TOKEN = os.getenv("ADMIN_API_TOKEN")


def require_admin(x_admin_token: str | None = Header(default=None)) -> None:
    """
    Simple admin guard: requires X-Admin-Token header matching ADMIN_API_TOKEN.
    Set ADMIN_API_TOKEN in the environment for this check to work.
    """
    if not ADMIN_TOKEN:
        raise HTTPException(status_code=500, detail="Admin token not configured")
    if not x_admin_token or x_admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Admin access required")
