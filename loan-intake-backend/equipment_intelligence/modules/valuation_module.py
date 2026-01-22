from datetime import datetime
from pathlib import Path

import joblib

from equipment_intelligence.rules_engine.valuation_rules import (
    rule_based_price,
    estimate_price_from_model,
    apply_condition_factor,
    apply_age_adjustment,
    apply_hours_adjustment,
    apply_region_adjustment,
    seasonal_adjustment,
    DEFAULT_BASE_PRICE,
    CONDITION_FACTORS,
    REGION_ADJUSTMENTS,
)

MODEL_PATH = Path(__file__).resolve().parent.parent / "ml_models" / "models" / "valuation_model.pkl"


def _load_model():
    if MODEL_PATH.exists():
        return joblib.load(MODEL_PATH)
    return None


def _fallback_price(make: str | None, model: str | None) -> tuple[float, str]:
    price = rule_based_price(make, model)
    if price is not None:
        return price, "rule_match"

    inferred = estimate_price_from_model(model)
    if inferred is not None:
        return inferred, "model_inferred"

    if make:
        make_inferred = estimate_price_from_model(make)
        if make_inferred is not None:
            return make_inferred, "make_inferred"

    return DEFAULT_BASE_PRICE, "default_baseline"


def valuation_module(make, model, year, hours, region, condition):
    base_price, base_source = _fallback_price(make, model)

    normalized_condition = (condition or "").strip().lower() or None
    condition_factor = CONDITION_FACTORS.get(normalized_condition, 1.0)

    safe_year = None
    if year:
        try:
            safe_year = int(year)
        except (TypeError, ValueError):
            safe_year = None

    current_year = datetime.utcnow().year
    age_years = max(0, current_year - safe_year) if safe_year else None

    safe_hours = None
    if hours is not None:
        try:
            safe_hours = float(hours)
        except (TypeError, ValueError):
            safe_hours = None

    if safe_hours is not None:
        if safe_hours <= 500:
            hours_bucket = "very_low"
        elif safe_hours <= 1500:
            hours_bucket = "moderate"
        elif safe_hours <= 3000:
            hours_bucket = "elevated"
        else:
            hours_bucket = "high"
    else:
        hours_bucket = None

    region_factor = REGION_ADJUSTMENTS.get((region or "").upper(), 1.0)

    base = apply_condition_factor(base_price, condition)
    base = apply_age_adjustment(base, safe_year)
    base = apply_hours_adjustment(base, safe_hours)
    base = apply_region_adjustment(base, region)
    base = seasonal_adjustment(base)

    predictor = _load_model()
    ml_value = None
    if predictor:
        X = {
            "make": make or "Unknown",
            "model": model or "Unknown",
            "region": region or "NA",
            "condition": condition or "Good",
            "year": safe_year or current_year,
            "hours": safe_hours or 0,
        }
        ml_value = predictor.predict([list(X.values())])[0]

    blended = base
    if ml_value:
        blended = (base * 0.6) + (ml_value * 0.4)

    confidence = 0.5
    if base_source == "rule_match":
        confidence += 0.22
    elif base_source == "model_inferred":
        confidence += 0.16
    elif base_source == "make_inferred":
        confidence += 0.12
    else:
        confidence += 0.07

    if ml_value:
        confidence += 0.06
    if hours_bucket in {"high", "elevated"}:
        confidence -= 0.03
    if age_years and age_years > 12:
        confidence -= 0.04

    metadata = {
        "base_source": base_source,
        "age_years": age_years,
        "hours_bucket": hours_bucket,
        "condition_factor": round(condition_factor, 3),
        "region_factor": round(region_factor, 3),
        "seasonal_month": datetime.utcnow().month,
    }

    return {
        "rule_value": round(base, 2),
        "ml_value": round(ml_value, 2) if ml_value else None,
        "blended_value": round(blended, 2),
        "confidence": round(max(0.35, min(confidence, 0.93)), 2),
        "metadata": metadata,
    }
