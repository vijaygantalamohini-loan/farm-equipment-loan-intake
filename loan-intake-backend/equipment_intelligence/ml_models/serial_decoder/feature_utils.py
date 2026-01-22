from __future__ import annotations

from typing import List

from services.serial_decoder import decode_serial_number


def build_serial_feature_string(serial: str | None) -> str:
    """Combine raw serial text with guidance tokens from the legacy decoder."""
    base = (serial or "").strip().upper()
    tokens: List[str] = []

    if base:
        tokens.append(base)

    try:
        decoded = decode_serial_number(serial) or {}
    except Exception:  # pragma: no cover - defensive guard
        decoded = {}

    manufacturer = decoded.get("manufacturer") or decoded.get("brand")
    if manufacturer and manufacturer != "Unknown":
        tokens.append("DEC_MAKE_" + manufacturer.upper().replace(" ", "_"))

    decoded_model = decoded.get("model")
    if decoded_model:
        tokens.append("DEC_MODEL_" + str(decoded_model).upper().replace(" ", "_"))

    decoded_year = decoded.get("year")
    if decoded_year:
        tokens.append("DEC_YEAR_" + str(decoded_year))

    return " ".join(token for token in tokens if token)
