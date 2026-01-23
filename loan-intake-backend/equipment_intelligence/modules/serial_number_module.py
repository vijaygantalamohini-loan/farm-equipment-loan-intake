from functools import lru_cache

import pandas as pd

from .serial_ml_module import ml_serial_lookup
from equipment_intelligence.rules_engine.serial_rules import (
    detect_manufacturer_prefix,
    decode_year,
    decode_model,
    validate_serial_pattern,
    serial_confidence,
)
from services.serial_decoder import (
    TOP_MANUFACTURERS,
    decode_serial_number as legacy_decode_serial,
)
from services.vin_service import decode_vin_year, decode_wmi
from equipment_intelligence.ml_models.model_utils import DATASET_PATH


def _coerce_year(value):
    if value is None:
        return None
    try:
        year_int = int(value)
        if year_int < 1900:
            return None
        return year_int
    except (TypeError, ValueError):
        return None


def _vin_lookup(serial):
    normalized = serial.strip().upper() if serial else ""
    if len(normalized) != 17:
        return {}

    info = {}

    vin_year = decode_vin_year(normalized)
    if vin_year:
        info["year"] = vin_year

    wmi_info = decode_wmi(normalized) or {}
    if wmi_info:
        info.update({k: v for k, v in wmi_info.items() if v})

    return info


@lru_cache(maxsize=1)
def _dataset_lookup_table():
    if not DATASET_PATH.exists():
        return {}
    try:
        df = pd.read_csv(
            DATASET_PATH,
            usecols=["serial_number", "make", "model", "year"],
        )
    except Exception:
        return {}

    df = df.dropna(subset=["serial_number"])
    df["serial_number"] = df["serial_number"].astype(str).str.upper().str.strip()

    lookup = {}
    for row in df.itertuples(index=False):
        serial_value = getattr(row, "serial_number", "")
        if not serial_value:
            continue
        lookup[serial_value] = {
            "make": getattr(row, "make", None),
            "model": getattr(row, "model", None),
            "year": getattr(row, "year", None),
        }
    return lookup


def _dataset_lookup(serial):
    normalized = serial.strip().upper() if serial else ""
    if not normalized:
        return {}
    return _dataset_lookup_table().get(normalized, {})


def serial_number_module(serial):
    model_data = decode_model(serial) or {}

    ml_data = ml_serial_lookup(serial)
    ml_make = (ml_data.get("make") or {}).get("label") if ml_data else None
    ml_make_conf = (ml_data.get("make") or {}).get("confidence") if ml_data else 0.0
    ml_model = (ml_data.get("model") or {}).get("label") if ml_data else None
    ml_model_conf = (ml_data.get("model") or {}).get("confidence") if ml_data else 0.0
    ml_year = (ml_data.get("year") or {}).get("label") if ml_data else None
    ml_year_conf = (ml_data.get("year") or {}).get("confidence") if ml_data else 0.0
    ml_overall = ml_data.get("overall_confidence", 0.0) if ml_data else 0.0

    vin_data = _vin_lookup(serial)
    vin_year = vin_data.get("year")
    vin_manufacturer = vin_data.get("manufacturer") or vin_data.get("make")

    dataset_match = _dataset_lookup(serial)
    dataset_make = dataset_match.get("make") if dataset_match else None
    dataset_model = dataset_match.get("model") if dataset_match else None
    dataset_year = dataset_match.get("year") if dataset_match else None

    decoded = {}
    decoder_source = "pattern_only"
    try:
        decoded = legacy_decode_serial(serial) or {}
        if decoded:
            decoder_source = "legacy_decoder"
    except Exception as exc:  # pragma: no cover - defensive guard
        decoded = {"error": str(exc)}
        decoder_source = "pattern_only"

    manufacturer = decoded.get("manufacturer")
    if manufacturer == "Unknown":
        manufacturer = None

    if dataset_make:
        manufacturer = dataset_make

    if not manufacturer and ml_make and ml_make_conf >= 0.55:
        manufacturer = ml_make

    if not manufacturer and vin_manufacturer:
        manufacturer = vin_manufacturer

    pattern_manufacturer = detect_manufacturer_prefix(serial)
    if not manufacturer and pattern_manufacturer:
        manufacturer = pattern_manufacturer

    if manufacturer == "Unknown":
        manufacturer = vin_manufacturer or None

    brand = decoded.get("brand") or manufacturer

    decoded_model = decoded.get("model")
    pattern_model = model_data.get("model")
    inferred_model = dataset_model or decoded_model
    if pattern_model:
        # Prefer richer pattern-derived labels (e.g., "8R 410" over "8410")
        if not decoded_model or len(pattern_model) > len(str(decoded_model)):
            inferred_model = pattern_model
    if ml_model and ml_model_conf >= 0.6:
        if not inferred_model or ml_model_conf >= ml_overall:
            inferred_model = ml_model
    inferred_series = model_data.get("series")
    approx_hp = model_data.get("approx_hp")

    decoded_year = decoded.get("year")
    coerced_year = (
        _coerce_year(dataset_year)
        or
        _coerce_year(decoded_year)
        or _coerce_year(model_data.get("year"))
        or (_coerce_year(ml_year) if ml_year_conf >= 0.55 else None)
        or _coerce_year(vin_year)
        or decode_year(serial)
    )

    pattern_valid = validate_serial_pattern(serial)
    serial_score = serial_confidence(serial)
    if decoded.get("manufacturer") and decoded.get("model"):
        serial_score = min(1.0, serial_score + 0.12)
    elif dataset_match:
        serial_score = min(1.0, serial_score + 0.15)
    elif ml_overall >= 0.5 and (ml_make or ml_model):
        serial_score = min(1.0, serial_score + 0.1 * ml_overall)
    elif vin_manufacturer and inferred_model:
        serial_score = min(1.0, serial_score + 0.08)

    if vin_manufacturer and not manufacturer:
        manufacturer = vin_manufacturer
        if not brand:
            brand = vin_manufacturer
    if dataset_make and not brand:
        brand = dataset_make
    elif ml_make and not brand and ml_make_conf >= 0.55:
        brand = ml_make

    metadata = {
        "decoder_source": decoder_source,
        "raw_decoder": decoded,
        "pattern_valid": pattern_valid,
    }

    if manufacturer in TOP_MANUFACTURERS:
        metadata["top_manufacturer"] = True
    if brand:
        metadata["brand"] = brand
    if vin_data:
        metadata["vin_fallback"] = vin_data
    if ml_data:
        metadata["ml_inference"] = ml_data
    if dataset_match:
        metadata["dataset_match"] = dataset_match
        if decoder_source == "legacy_decoder":
            metadata["decoder_source"] = "dataset_augmented"

    return {
        "serial": serial,
        "manufacturer": manufacturer,
        "decoded_year": coerced_year,
        "valid_format": pattern_valid,
        "model": inferred_model,
        "series": inferred_series,
        "approx_hp": approx_hp,
        "confidence": round(min(serial_score, 1.0), 2),
        "metadata": metadata,
    }
