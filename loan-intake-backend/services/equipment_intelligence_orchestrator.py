"""
Equipment intelligence orchestrator service.

Aggregates valuation, comparables, depreciation curves, and fraud signals.
"""

from __future__ import annotations

import asyncio
import os
import statistics
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

from equipment_intelligence.modules.valuation_module import valuation_module
from equipment_intelligence.rules_engine.depreciation_rules import (
    apply_fixed_curve,
    age_based_adjustment,
    hour_based_adjustment,
)
from services.tractor_zoom_service import get_comparables
from services.ritchie_bros_scraper import fetch_multiple as fetch_ritchie_pages

try:
    from services.fraud_detection import evaluate_fraud_flags
except Exception:  # pragma: no cover - fallback for optional dependency during rollout
    def evaluate_fraud_flags(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        return []


def _safe_int(value: Any) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _safe_float(value: Any) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _infer_category(make: Optional[str], model: Optional[str]) -> str:
    combined = f"{make or ''} {model or ''}".lower()
    if any(token in combined for token in ["combine", "harvester"]):
        return "combine"
    if any(token in combined for token in ["excavator", "loader", "skid", "dozer", "backhoe"]):
        return "construction"
    return "tractor"


def _median(values: Iterable[float]) -> Optional[float]:
    values = [v for v in values if v is not None]
    if not values:
        return None
    try:
        return statistics.median(values)
    except statistics.StatisticsError:
        return None


def _normalize_comparables(items: Iterable[Dict[str, Any]], source: str) -> List[Dict[str, Any]]:
    normalized = []
    for item in items or []:
        if not isinstance(item, dict):
            continue
        normalized.append({
            "make": item.get("make"),
            "model": item.get("model"),
            "year": _safe_int(item.get("year")),
            "hours": _safe_float(item.get("hours")),
            "price": _safe_float(item.get("price")),
            "location": item.get("location"),
            "url": item.get("url"),
            "source": item.get("source") or source,
        })
    return normalized


async def _fetch_ritchie_bros(make: Optional[str], model: Optional[str]) -> List[Dict[str, Any]]:
    env_urls = os.getenv("RITCHIE_BROS_SEARCH_URLS", "")
    pages = [u.strip() for u in env_urls.split(",") if u.strip()]
    if pages:
        try:
            results = await fetch_ritchie_pages(pages)
            return _normalize_comparables(results, "ritchie_bros")
        except Exception:
            return []

    try:
        from equipment_intelligence.data_ingestion.ritchie_bros_scraper import scrape_ritchie_bros

        df = scrape_ritchie_bros()
        rows = df.to_dict(orient="records") if hasattr(df, "to_dict") else []
        return _normalize_comparables(rows, "ritchie_bros")
    except Exception:
        return []


def _compute_depreciation(base_value: float, year: Optional[int], hours: Optional[float], category: str) -> Dict[str, Any]:
    depreciated = apply_fixed_curve(base_value, category=category)
    age_years = None
    if year:
        age_years = max(0, datetime.utcnow().year - year)
        depreciated = age_based_adjustment(depreciated, age_years)
    depreciated = hour_based_adjustment(depreciated, hours)
    return {
        "base_value": round(base_value, 2),
        "depreciated_value": round(depreciated, 2),
        "age_years": age_years,
        "hours": hours,
        "category": category,
        "method": "depreciation_curve",
    }


async def run_equipment_intelligence(
    make: Optional[str],
    model: Optional[str],
    year: Optional[int],
    hours: Optional[float],
    serial: Optional[str],
) -> Dict[str, Any]:
    safe_year = _safe_int(year)
    safe_hours = _safe_float(hours)
    category = _infer_category(make, model)

    valuation_task = asyncio.to_thread(
        valuation_module,
        make,
        model,
        safe_year,
        safe_hours,
        None,
        None,
    )
    tractor_comps_task = get_comparables(make or "", model or "", safe_year, safe_hours)
    ritchie_task = _fetch_ritchie_bros(make, model)

    valuation_result, tractor_comps, ritchie_comps = await asyncio.gather(
        valuation_task,
        tractor_comps_task,
        ritchie_task,
        return_exceptions=True,
    )

    if isinstance(valuation_result, Exception):
        valuation = {"error": str(valuation_result)}
    else:
        valuation = valuation_result

    tractor_list = []
    if not isinstance(tractor_comps, Exception):
        tractor_list = _normalize_comparables(
            (tractor_comps or {}).get("comparables", []),
            "tractor_zoom",
        )

    ritchie_list = []
    if not isinstance(ritchie_comps, Exception):
        ritchie_list = _normalize_comparables(ritchie_comps or [], "ritchie_bros")

    comparables = tractor_list + ritchie_list
    comparable_prices = [c.get("price") for c in comparables if c.get("price") is not None]
    median_price = _median(comparable_prices)
    valuation_value = None
    if isinstance(valuation, dict):
        valuation_value = valuation.get("blended_value") or valuation.get("rule_value")
    base_value = _safe_float(valuation_value) or median_price or 0.0

    depreciation = _compute_depreciation(base_value, safe_year, safe_hours, category) if base_value else None
    resale_prediction = depreciation

    fraud_payload = {
        "make": make,
        "model": model,
        "year": safe_year,
        "serial_number": serial,
        "hours": safe_hours,
        "price": base_value,
        "comparables": comparables,
    }
    fraud_flags = evaluate_fraud_flags(fraud_payload) if callable(evaluate_fraud_flags) else []

    confidence = 0.4
    val_conf = valuation.get("confidence") if isinstance(valuation, dict) else None
    if val_conf is not None:
        confidence += 0.25 * min(max(val_conf, 0.0), 1.0)
    if comparables:
        confidence += min(0.2, 0.02 * len(comparables))
    if resale_prediction:
        confidence += 0.1
    if fraud_flags:
        confidence -= min(0.2, 0.04 * len(fraud_flags))
    confidence = max(0.2, min(confidence, 0.95))

    return {
        "valuation": valuation,
        "comparables": comparables,
        "fraud_flags": fraud_flags,
        "resale_prediction": resale_prediction,
        "confidence_score": round(confidence, 2),
    }
