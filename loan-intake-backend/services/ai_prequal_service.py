"""
AI prequalification service wrapper.

Calls the local /prequalify endpoint and normalizes the response.
"""

from __future__ import annotations

from typing import Any, Dict

import httpx

from core.settings import get_settings


async def run_prequalification(payload: Dict[str, Any]) -> Dict[str, Any]:
    # Use localhost for internal backend-to-backend calls to avoid auth issues
    # External BACKEND_URL may require authentication/CORS
    url = "http://127.0.0.1:8000/prequalify"

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(url, json=payload)

    if response.status_code >= 400:
        try:
            detail = response.json()
        except ValueError:
            detail = response.text
        raise RuntimeError(f"Prequalification request failed ({response.status_code}): {detail}")

    data = response.json()
    optimal = data.get("optimal_structure") or {}
    return {
        "approval_probability": data.get("approval_probability"),
        "risk_tier": data.get("risk_tier"),
        "flags": data.get("flags") or [],
        "reasons": data.get("reasons") or [],
        "recommended_term": optimal.get("recommended_term"),
        "recommended_down_payment": optimal.get("recommended_down_payment"),
    }
