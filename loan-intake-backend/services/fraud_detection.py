"""
Fraud detection rules engine.

Evaluates common risk flags for equipment financing applications.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from hashlib import sha256
from typing import Any, Dict, Iterable, List, Optional, Mapping


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


def _normalize_serial(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip().upper()
    return text or None


def _unique(values: Iterable[str]) -> List[str]:
    seen = set()
    result = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


def _collect_serials(payload: Dict[str, Any]) -> List[str]:
    serials: List[str] = []
    for key in ("serial_number", "serialNumber", "serial"):
        if key in payload:
            serial = _normalize_serial(payload.get(key))
            if serial:
                serials.append(serial)
    list_keys = (
        "serials",
        "serial_numbers",
        "existing_serials",
        "known_serials",
        "trade_in_serials",
        "application_serials",
    )
    for key in list_keys:
        raw = payload.get(key)
        if not raw:
            continue
        if isinstance(raw, (list, tuple, set)):
            for item in raw:
                serial = _normalize_serial(item)
                if serial:
                    serials.append(serial)
    return serials


def _median(values: Iterable[float]) -> Optional[float]:
    values = sorted(v for v in values if v is not None)
    if not values:
        return None
    mid = len(values) // 2
    if len(values) % 2 == 0:
        return (values[mid - 1] + values[mid]) / 2
    return values[mid]


@dataclass(frozen=True)
class BehavioralFraudSignals:
    num_submissions_last_24h: int
    num_declined_apps_last_30d: int
    device_fingerprint: Optional[str]
    user_agent_hash: Optional[str]
    ip_address_risk_score: float
    upload_retry_count: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "num_submissions_last_24h": self.num_submissions_last_24h,
            "num_declined_apps_last_30d": self.num_declined_apps_last_30d,
            "device_fingerprint": self.device_fingerprint,
            "user_agent_hash": self.user_agent_hash,
            "ip_address_risk_score": self.ip_address_risk_score,
            "upload_retry_count": self.upload_retry_count,
        }


def _stable_int(value: str, max_value: int) -> int:
    digest = sha256(value.encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % max_value


def compute_behavioral_signals(context: Mapping[str, Any]) -> BehavioralFraudSignals:
    """
    Stubbed behavioral signals until real telemetry is available.

    Future data sources:
    - submissions / declines: LoanApplication records + audit logs
    - device fingerprint / user agent: frontend telemetry
    - IP risk score: external risk feeds (e.g., MaxMind, ThreatMetrix)
    - upload retries: upload service logs or API gateway metrics
    """
    salesperson_id = context.get("salesperson_id")
    borrower_key = context.get("borrower_ssn") or context.get("borrower_email") or "unknown"
    device_fingerprint = context.get("device_fingerprint")
    user_agent = context.get("user_agent")
    user_agent_hash = sha256(user_agent.encode("utf-8")).hexdigest() if user_agent else None
    ip_address = context.get("ip_address") or "0.0.0.0"

    seed = f"{salesperson_id}|{borrower_key}|{device_fingerprint}|{ip_address}"
    submissions = _stable_int(seed + "|submissions", 14)
    declines = _stable_int(seed + "|declines", 8)
    ip_risk_score = _stable_int(seed + "|iprisk", 100) / 100.0

    upload_retry_count = context.get("upload_retry_count")
    if upload_retry_count is None:
        upload_retry_count = _stable_int(seed + "|retries", 4)

    return BehavioralFraudSignals(
        num_submissions_last_24h=int(submissions),
        num_declined_apps_last_30d=int(declines),
        device_fingerprint=device_fingerprint,
        user_agent_hash=user_agent_hash,
        ip_address_risk_score=float(ip_risk_score),
        upload_retry_count=int(upload_retry_count),
    )


def _coerce_behavioral_signals(payload: Any) -> Optional[BehavioralFraudSignals]:
    if isinstance(payload, BehavioralFraudSignals):
        return payload
    if isinstance(payload, Mapping):
        return BehavioralFraudSignals(
            num_submissions_last_24h=int(payload.get("num_submissions_last_24h", 0)),
            num_declined_apps_last_30d=int(payload.get("num_declined_apps_last_30d", 0)),
            device_fingerprint=payload.get("device_fingerprint"),
            user_agent_hash=payload.get("user_agent_hash"),
            ip_address_risk_score=float(payload.get("ip_address_risk_score", 0.0)),
            upload_retry_count=int(payload.get("upload_retry_count", 0)),
        )
    return None


def evaluate_fraud_flags(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    flags: List[Dict[str, Any]] = []
    serials = _collect_serials(payload)

    if serials:
        unique_serials = _unique(serials)
        if len(unique_serials) < len(serials):
            flags.append({
                "code": "duplicate_serial",
                "message": "Duplicate serial numbers detected across assets or records.",
                "severity": "high",
            })

    hours = _safe_float(payload.get("hours"))
    year = _safe_int(payload.get("year"))
    if hours is not None:
        if hours < 0:
            flags.append({
                "code": "negative_hours",
                "message": "Reported hours are negative.",
                "severity": "high",
            })
        elif hours > 20000:
            flags.append({
                "code": "excessive_hours",
                "message": "Reported hours exceed typical usage ranges.",
                "severity": "high",
            })
        elif year:
            age_years = max(1, datetime.utcnow().year - year)
            hours_per_year = hours / age_years
            if hours_per_year > 1800:
                flags.append({
                    "code": "hours_inconsistent",
                    "message": "Hours per year exceed expected operating norms.",
                    "severity": "medium",
                })

    price = _safe_float(
        payload.get("price")
        or payload.get("invoice_price")
        or payload.get("purchase_price")
        or payload.get("value")
    )
    if price is not None and price <= 0:
        flags.append({
            "code": "invalid_price",
            "message": "Price is missing or non-positive.",
            "severity": "high",
        })

    comparables = payload.get("comparables") or []
    comparable_prices = [
        _safe_float(item.get("price"))
        for item in comparables
        if isinstance(item, dict)
    ]
    median_price = _median([p for p in comparable_prices if p is not None])
    if price is not None and median_price:
        if price < median_price * 0.4:
            flags.append({
                "code": "price_below_market",
                "message": "Price is significantly below comparable market listings.",
                "severity": "high",
            })
        elif price > median_price * 1.6:
            flags.append({
                "code": "price_above_market",
                "message": "Price is significantly above comparable market listings.",
                "severity": "medium",
            })

    invoice_text = payload.get("invoice_text") or payload.get("raw_text") or ""
    if invoice_text:
        lowered = str(invoice_text).lower()
        tamper_markers = ("void", "copy", "duplicate", "draft", "sample", "not valid", "altered", "edited")
        if any(marker in lowered for marker in tamper_markers):
            flags.append({
                "code": "invoice_tampering",
                "message": "Invoice contains markers commonly associated with non-final documents.",
                "severity": "medium",
            })

    total_financed = _safe_float(payload.get("total_financed_amount"))
    taxes = _safe_float(payload.get("taxes")) or 0.0
    fees = _safe_float(payload.get("fees")) or 0.0
    trade_in = _safe_float(payload.get("trade_in_value")) or 0.0
    down_payment = _safe_float(payload.get("down_payment")) or 0.0
    if total_financed is not None and price is not None:
        expected_total = price + taxes + fees - trade_in - down_payment
        if expected_total > 0:
            variance = abs(total_financed - expected_total) / expected_total
            if variance > 0.15:
                flags.append({
                    "code": "invoice_total_mismatch",
                    "message": "Total financed amount does not align with invoice line items.",
                    "severity": "medium",
                })

    serial = _normalize_serial(payload.get("serial_number") or payload.get("serialNumber"))
    if serial and invoice_text and serial not in str(invoice_text).upper():
        flags.append({
            "code": "serial_not_on_invoice",
            "message": "Serial number not found in invoice text.",
            "severity": "low",
        })

    behavioral = _coerce_behavioral_signals(payload.get("behavioral_signals"))
    if behavioral:
        submissions = behavioral.num_submissions_last_24h
        if submissions >= 10:
            flags.append({
                "code": "high_submission_volume",
                "message": "Unusually high submission volume in the last 24 hours.",
                "severity": "high",
            })
        elif submissions >= 6:
            flags.append({
                "code": "elevated_submission_volume",
                "message": "Elevated submission volume in the last 24 hours.",
                "severity": "medium",
            })

        declines = behavioral.num_declined_apps_last_30d
        if declines >= 5:
            flags.append({
                "code": "repeat_declines",
                "message": "Borrower has multiple declined applications in the last 30 days.",
                "severity": "high",
            })
        elif declines >= 3:
            flags.append({
                "code": "recent_declines",
                "message": "Borrower has recent declined applications in the last 30 days.",
                "severity": "medium",
            })

        if behavioral.upload_retry_count >= 4:
            flags.append({
                "code": "excessive_upload_retries",
                "message": "Multiple upload retries detected for document images.",
                "severity": "medium",
            })
        elif behavioral.upload_retry_count >= 2:
            flags.append({
                "code": "upload_retries",
                "message": "Repeated upload retries detected for document images.",
                "severity": "low",
            })

        if behavioral.ip_address_risk_score >= 0.85:
            flags.append({
                "code": "ip_risk_high",
                "message": "IP address risk score is elevated.",
                "severity": "medium",
            })

    tampering_payload = payload.get("image_tampering") or {}
    possible_tampering = bool(payload.get("possible_tampering"))
    tampering_score = _safe_float(payload.get("tampering_score")) or 0.0
    if isinstance(tampering_payload, dict):
        for doc in tampering_payload.values():
            if isinstance(doc, dict):
                possible_tampering = possible_tampering or bool(doc.get("possible_tampering"))
                tampering_score = max(tampering_score, _safe_float(doc.get("tampering_score")) or 0.0)

    if possible_tampering:
        severity = "high" if tampering_score >= 0.85 else "medium"
        flags.append({
            "code": "possible_image_tampering",
            "message": "Possible image tampering detected in uploaded documents.",
            "severity": severity,
        })

    return flags
