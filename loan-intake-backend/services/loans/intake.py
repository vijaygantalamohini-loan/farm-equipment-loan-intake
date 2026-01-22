"""Normalization helpers for borrower intake payloads."""

from __future__ import annotations

import json
from typing import Any, Iterable

from models.loan_application import apply_borrower_field_defaults

_FLOAT_FIELDS = {"acresOwned", "acresLeased", "existingFarmDebt", "personalDebt"}
_INT_FIELDS = {"yearsInOperation"}


def _try_cast(value: Any, caster: type) -> Any:
    try:
        if value in ("", None):
            return None
        return caster(value)
    except (TypeError, ValueError):
        return None


def _normalize_income_history(raw: Any) -> list[dict[str, Any]]:
    if raw in (None, ""):
        return []

    data: Iterable[Any]
    parsed = raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return []

    if isinstance(parsed, dict):
        intermediate = []
        for key, value in parsed.items():
            year = _try_cast(key, int)
            if year is None:
                continue
            if isinstance(value, dict):
                entry = {"year": year, **value}
            else:
                entry = {"year": year, "income": value}
            intermediate.append(entry)
        data = intermediate
    elif isinstance(parsed, list):
        data = parsed
    else:
        return []

    normalized_entries: list[dict[str, Any]] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        year = _try_cast(item.get("year") or item.get("Year") or item.get("yearValue"), int)
        if year is None:
            continue
        not_filed = bool(item.get("notFiled") or item.get("not_filed") or item.get("notfiled"))
        income_raw = item.get("income") or item.get("amount") or item.get("value")
        income_value = None if not_filed else _try_cast(income_raw, float)
        normalized_entries.append(
            {
                "year": year,
                "income": income_value,
                "notFiled": not_filed,
            }
        )

    normalized_entries.sort(key=lambda entry: entry.get("year", 0), reverse=True)
    return normalized_entries


def normalize_borrower_payload(payload: dict[str, Any] | None) -> dict[str, Any]:
    """Trim whitespace and coerce borrower intake fields for downstream storage."""
    normalized = apply_borrower_field_defaults(payload)

    for key, value in list(normalized.items()):
        if isinstance(value, str):
            normalized[key] = value.strip() or None

    for field in _FLOAT_FIELDS:
        if field in normalized:
            normalized[field] = _try_cast(normalized.get(field), float)

    for field in _INT_FIELDS:
        if field in normalized:
            normalized[field] = _try_cast(normalized.get(field), int)

    income_history_source = payload.get("farmIncomeLast3Years") if isinstance(payload, dict) else None
    normalized["farmIncomeLast3Years"] = _normalize_income_history(income_history_source)

    return normalized
