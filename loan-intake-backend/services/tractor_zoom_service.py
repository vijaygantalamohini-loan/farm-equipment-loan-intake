"""Tractor Zoom API client utilities.

Async helper functions that wrap Tractor Zoom's public endpoints and
normalize responses for the rest of the application. The functions
prioritize returning lightweight dictionaries with consistent keys, so
callers do not need to worry about provider-specific field names.
"""

from __future__ import annotations

import asyncio
import os
import random
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

import httpx


DEFAULT_BASE_URL = "https://api.tractorzoom.com"
USER_AGENT = "FarmEquipmentLoanIntake/1.0 (+https://github.com/)"
_TIMEOUT_SECONDS = 10.0
_THROTTLE_RANGE = (0.2, 0.6)


def _get_api_key() -> Optional[str]:
    key = os.getenv("TRACTOR_ZOOM_API_KEY")
    if key:
        return key.strip()
    return None


def _get_bearer_token() -> Optional[str]:
    token = os.getenv("TRACTOR_ZOOM_BEARER_TOKEN")
    if token:
        return token.strip()
    return None


class TractorZoomError(RuntimeError):
    """Raised when Tractor Zoom responds with a non-success status code."""


def _get_base_url() -> str:
    return os.getenv("TRACTOR_ZOOM_BASE_URL", DEFAULT_BASE_URL).rstrip("/")


def _parse_iso_date(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed.isoformat()


def _safe_float(value: Any) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _safe_int(value: Any) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


async def _request_json(endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    url = f"{_get_base_url()}{endpoint}"
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    api_key = _get_api_key()
    if api_key:
        headers["x-api-key"] = api_key
    bearer = _get_bearer_token()
    if bearer:
        headers["Authorization"] = f"Bearer {bearer}"
    async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS, headers=headers) as client:
        response = await client.get(url, params=params)
    if response.status_code >= 400:
        raise TractorZoomError(f"Tractor Zoom request failed ({response.status_code}): {response.text}")
    try:
        return response.json()
    except ValueError as exc:
        raise TractorZoomError("Invalid JSON returned by Tractor Zoom") from exc


def _normalize_auction(item: Dict[str, Any]) -> Dict[str, Any]:
    event = item.get("event", {})
    equipment = item.get("equipment", {})
    return {
        "id": item.get("id"),
        "title": item.get("title") or equipment.get("description"),
        "make": equipment.get("make"),
        "model": equipment.get("model"),
        "year": _safe_int(equipment.get("year")),
        "hours": _safe_float(equipment.get("hours")),
        "location": event.get("location"),
        "event_date": _parse_iso_date(event.get("startDate")),
        "price": _safe_float(item.get("salePrice")),
        "currency": item.get("currency") or "USD",
        "source": "tractor_zoom",
    }


def _normalize_equipment(payload: Dict[str, Any]) -> Dict[str, Any]:
    specs = payload.get("specifications") or {}
    return {
        "make": payload.get("make"),
        "model": payload.get("model"),
        "year": _safe_int(payload.get("year")),
        "category": payload.get("category"),
        "sub_category": payload.get("subCategory"),
        "horsepower": _safe_float(specs.get("horsepower")),
        "engine": specs.get("engine"),
        "transmission": specs.get("transmission"),
        "weight": _safe_float(specs.get("operatingWeight")),
        "dimensions": {
            "length": _safe_float(specs.get("length")),
            "width": _safe_float(specs.get("width")),
            "height": _safe_float(specs.get("height")),
        },
        "media": payload.get("media") or [],
        "source": "tractor_zoom",
    }


def _normalize_comparable(item: Dict[str, Any]) -> Dict[str, Any]:
    equipment = item.get("equipment", {})
    pricing = item.get("pricing", {})
    location = item.get("location", {})
    return {
        "make": equipment.get("make"),
        "model": equipment.get("model"),
        "year": _safe_int(equipment.get("year")),
        "hours": _safe_float(equipment.get("hours")),
        "condition": equipment.get("condition"),
        "price": _safe_float(pricing.get("listPrice")),
        "price_currency": pricing.get("currency") or "USD",
        "seller": item.get("seller"),
        "location": {
            "city": location.get("city"),
            "state": location.get("state"),
            "country": location.get("country"),
        },
        "url": item.get("listingUrl"),
        "source": "tractor_zoom",
    }


def _normalize_list(items: Optional[Iterable[Dict[str, Any]]], normalizer) -> List[Dict[str, Any]]:
    if not items:
        return []
    return [normalizer(item) for item in items]

def _random_delay() -> float:
    return random.uniform(*_THROTTLE_RANGE)


async def get_recent_auctions(limit: int = 10) -> Dict[str, Any]:
    """Return the latest auction events from Tractor Zoom."""

    await asyncio.sleep(_random_delay())
    payload = await _request_json("/auctions/recent", params={"limit": limit})
    auctions = _normalize_list(payload.get("results"), _normalize_auction)
    return {
        "count": len(auctions),
        "auctions": auctions,
        "source": "tractor_zoom",
    }


async def get_equipment_details(make: str, model: str, year: Optional[int]) -> Dict[str, Any]:
    """Fetch metadata for a specific make/model/year combination."""

    await asyncio.sleep(_random_delay())
    params: Dict[str, Any] = {"make": make, "model": model}
    if year:
        params["year"] = year
    payload = await _request_json("/equipment/details", params=params)
    normalized = _normalize_equipment(payload.get("equipment", payload))
    normalized["source"] = "tractor_zoom"
    return normalized


async def get_comparables(make: str, model: str, year: Optional[int], hours: Optional[float]) -> Dict[str, Any]:
    """Return comparable listings for the supplied equipment description."""

    await asyncio.sleep(_random_delay())
    params: Dict[str, Any] = {"make": make, "model": model}
    if year:
        params["year"] = year
    if hours is not None:
        params["hours"] = hours
    payload = await _request_json("/equipment/comparables", params=params)
    comparables = _normalize_list(payload.get("results"), _normalize_comparable)
    return {
        "count": len(comparables),
        "comparables": comparables,
        "source": "tractor_zoom",
    }
