from datetime import datetime
from pathlib import Path

import joblib

from equipment_intelligence.rules_engine.depreciation_rules import (
    apply_fixed_curve,
    hour_based_adjustment,
    age_based_adjustment,
)
from equipment_intelligence.rules_engine.valuation_rules import (
    estimate_price_from_model,
    DEFAULT_BASE_PRICE,
)

MODEL_PATH = Path(__file__).resolve().parent.parent / "ml_models" / "models" / "resale_model.pkl"


def _load_resale_model():
    if MODEL_PATH.exists():
        return joblib.load(MODEL_PATH)
    return None


def predictive_resale_module(make, model, year, hours, region, condition):
    inferred_price = estimate_price_from_model(model)
    base_source = "model_inferred" if inferred_price is not None else "default_baseline"
    starting_price = inferred_price or DEFAULT_BASE_PRICE
    base_price = apply_fixed_curve(starting_price, category="tractor")

    safe_year = None
    if year:
        try:
            safe_year = int(year)
        except (TypeError, ValueError):
            safe_year = None

    current_year = datetime.utcnow().year
    age_years = max(0, current_year - safe_year) if safe_year else None
    base_price = age_based_adjustment(base_price, age_years)

    safe_hours = None
    if hours is not None:
        try:
            safe_hours = float(hours)
        except (TypeError, ValueError):
            safe_hours = None

    base_price = hour_based_adjustment(base_price, safe_hours)

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

    model_pred = _load_resale_model()
    ml_pred = None
    if model_pred:
        X = {
            "region": region or "NA",
            "condition": condition or "Good",
            "age": age_years or 5,
            "hours": safe_hours or 0,
        }
        ml_pred = model_pred.predict([list(X.values())])[0]

    blended = base_price
    if ml_pred:
        blended = (base_price * 0.65) + (ml_pred * 0.35)

    confidence = 0.46
    if base_source == "model_inferred":
        confidence += 0.18
    else:
        confidence += 0.08
    if ml_pred:
        confidence += 0.07
    if hours_bucket in {"high", "elevated"}:
        confidence -= 0.03
    if age_years and age_years > 12:
        confidence -= 0.04

    metadata = {
        "base_source": base_source,
        "age_years": age_years,
        "hours_bucket": hours_bucket,
        "seasonal_month": datetime.utcnow().month,
    }

    return {
        "predicted_resale": round(blended, 2),
        "ml_resale": round(ml_pred, 2) if ml_pred else None,
        "depreciated": round(base_price, 2),
        "age_years": age_years,
        "confidence": round(max(0.3, min(confidence, 0.92)), 2),
        "metadata": metadata,
    }
