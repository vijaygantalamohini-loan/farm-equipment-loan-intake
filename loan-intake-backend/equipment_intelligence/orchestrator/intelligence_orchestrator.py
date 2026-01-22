from concurrent.futures import ThreadPoolExecutor, as_completed

from equipment_intelligence.modules.valuation_module import valuation_module
from equipment_intelligence.modules.serial_number_module import serial_number_module
from equipment_intelligence.modules.equipment_history_module import equipment_history_module
from equipment_intelligence.modules.predictive_resale_module import predictive_resale_module
from equipment_intelligence.rules_engine.risk_rules import (
    high_ltv_flag,
    old_equipment_flag,
    missing_serial_flag,
    inconsistent_hours_flag,
)


def _safe_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _safe_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def intelligence_orchestrator(make, model, year, hours, serial, region, condition, loan_amount, ltv):
    try:
        serial_data = serial_number_module(serial)
    except Exception as exc:
        serial_data = {"error": str(exc)}

    resolved_make = make or serial_data.get("manufacturer")
    if resolved_make == "Unknown":
        resolved_make = make or None

    resolved_model = model or serial_data.get("model")

    provided_year = _safe_int(year)
    serial_year = _safe_int(serial_data.get("decoded_year"))
    resolved_year = provided_year or serial_year

    provided_hours = _safe_float(hours)
    resolved_hours = provided_hours

    resolved_condition = condition or "Good"
    resolved_region = region

    results = {"serial": serial_data}

    tasks = {
        "valuation": (valuation_module, (resolved_make, resolved_model, resolved_year, resolved_hours, resolved_region, resolved_condition)),
        "history": (equipment_history_module, (serial, resolved_hours)),
        "resale": (predictive_resale_module, (resolved_make, resolved_model, resolved_year, resolved_hours, resolved_region, resolved_condition)),
    }

    with ThreadPoolExecutor() as executor:
        future_map = {executor.submit(func, *args): name for name, (func, args) in tasks.items()}
        for future in as_completed(future_map):
            name = future_map[future]
            try:
                results[name] = future.result()
            except Exception as exc:
                results[name] = {"error": str(exc)}

    valuation_data = results.get("valuation", {})
    resale_data = results.get("resale", {})
    history_data = results.get("history", {})

    safe_loan_amount = _safe_float(loan_amount)

    inferred_make = serial_data.get("manufacturer") if isinstance(serial_data, dict) else None
    inferred_model = serial_data.get("model") if isinstance(serial_data, dict) else None
    approx_hp = serial_data.get("approx_hp") if isinstance(serial_data, dict) else None

    risk_flags = []
    if high_ltv_flag(ltv):
        risk_flags.append("High LTV")
    if old_equipment_flag(resolved_year):
        risk_flags.append("Old equipment")
    if missing_serial_flag(serial):
        risk_flags.append("Missing serial")
    if inconsistent_hours_flag(resolved_hours):
        risk_flags.append("Inconsistent hours")
    if resale_data and resale_data.get("predicted_resale") and safe_loan_amount:
        if resale_data["predicted_resale"] < safe_loan_amount * 0.6:
            risk_flags.append("Resale < 60% loan")
    if valuation_data and valuation_data.get("blended_value") and safe_loan_amount:
        if valuation_data["blended_value"] < safe_loan_amount * 0.8:
            risk_flags.append("Valuation below loan")

    confidence = 0.42

    serial_conf = serial_data.get("confidence") if isinstance(serial_data, dict) else None
    if serial_conf is not None:
        confidence += 0.15 * min(serial_conf, 1.0)
        if serial_conf < 0.55:
            confidence -= 0.04
    else:
        confidence -= 0.05

    if valuation_data and "error" not in valuation_data:
        base_source = (valuation_data.get("metadata") or {}).get("base_source")
        if base_source == "rule_match":
            confidence += 0.22
        elif base_source == "model_inferred":
            confidence += 0.16
        elif base_source == "make_inferred":
            confidence += 0.12
        else:
            confidence += 0.07
        if valuation_data.get("ml_value"):
            confidence += 0.04
    else:
        confidence -= 0.08

    if resale_data and "error" not in resale_data:
        resale_source = (resale_data.get("metadata") or {}).get("base_source")
        if resale_source == "model_inferred":
            confidence += 0.12
        else:
            confidence += 0.05
        if resale_data.get("ml_resale"):
            confidence += 0.04
    else:
        confidence -= 0.06

    if history_data and "error" not in history_data:
        confidence += 0.04
    else:
        confidence -= 0.03

    if not resolved_make:
        confidence -= 0.06
    if not resolved_model:
        confidence -= 0.04
    if not resolved_year:
        confidence -= 0.03

    if "High LTV" in risk_flags:
        confidence -= 0.05
    if "Valuation below loan" in risk_flags:
        confidence -= 0.05

    confidence = max(0.3, min(confidence, 0.92))

    metadata = {
        "resolved_inputs": {
            "make": resolved_make,
            "model": resolved_model,
            "year": resolved_year,
            "hours": resolved_hours,
            "condition": resolved_condition,
            "region": resolved_region,
        },
        "serial_enrichment": {
            "inferred_make": inferred_make if inferred_make != "Unknown" else None,
            "inferred_model": inferred_model,
            "decoded_year": serial_year,
            "applied": any([
                (resolved_make and resolved_make != make),
                (resolved_model and resolved_model != model),
                (resolved_year and resolved_year != provided_year),
            ]),
        },
        "approx_hp": approx_hp,
        "ltv": ltv,
        "loan_amount": safe_loan_amount,
    }

    return {
        "valuation": valuation_data,
        "serial_number": serial_data,
        "history": history_data,
        "predictive_resale": resale_data,
        "risk_flags": risk_flags,
        "overall_confidence": round(confidence, 2),
        "metadata": metadata,
    }
