"""
One-click submission orchestrator.

Runs OCR, AI prequalification, equipment intelligence, fraud detection,
lender matching, and final submission.
"""

from __future__ import annotations

import asyncio
import re
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime
from typing import Any, Dict, Optional

from database import LoanApplication
from schemas.loan import LoanSubmissionRequest
from services.ai_prequal_service import run_prequalification
from services.equipment_intelligence_orchestrator import run_equipment_intelligence
from services.fraud_detection import compute_behavioral_signals, evaluate_fraud_flags
from services.invoice_ocr_service import extract_invoice_data
from services.loans import submit as submit_service
from services.loans.matching import rank_lenders_with_scores
from services.ocr_parser import (
    apply_confidence_threshold,
    find_address,
    find_dob,
    find_name,
    parse_id_fields_with_confidence,
)
from services.ocr_service import extract_text_from_id


_DB_CONTEXT: ContextVar[Any] = ContextVar("one_click_db", default=None)
_SALESPERSON_CONTEXT: ContextVar[Any] = ContextVar("one_click_salesperson", default=None)


@contextmanager
def one_click_context(db, salesperson):
    token_db = _DB_CONTEXT.set(db)
    token_sp = _SALESPERSON_CONTEXT.set(salesperson)
    try:
        yield
    finally:
        _DB_CONTEXT.reset(token_db)
        _SALESPERSON_CONTEXT.reset(token_sp)


async def _read_bytes(source: Any) -> bytes:
    if source is None:
        return b""
    if isinstance(source, (bytes, bytearray)):
        return bytes(source)
    read_fn = getattr(source, "read", None)
    if read_fn is None:
        return b""
    if asyncio.iscoroutinefunction(read_fn):
        return await read_fn()
    return read_fn()


def _safe_float(value: Any) -> float:
    try:
        return float(str(value).replace(",", "").replace("$", ""))
    except (TypeError, ValueError):
        return 0.0


def _safe_int(value: Any) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _split_name(name: Optional[str]) -> Dict[str, str]:
    if not name:
        return {"first": "", "last": ""}
    text = name.strip()
    if "," in text:
        last, first = [part.strip() for part in text.split(",", 1)]
        return {"first": first, "last": last}
    parts = text.split()
    if len(parts) == 1:
        return {"first": parts[0], "last": ""}
    return {"first": parts[0], "last": " ".join(parts[1:])}


def _extract_ssn(lines: list[str]) -> Optional[str]:
    for line in lines:
        match = re.search(r"\b(\d{3}-\d{2}-\d{4})\b", line)
        if match:
            return match.group(1)
        match = re.search(r"\b(\d{9})\b", line)
        if match:
            raw = match.group(1)
            return f"{raw[:3]}-{raw[3:5]}-{raw[5:]}"
        match = re.search(r"\bSSN[:\s]*([0-9Xx\-]{4,11})\b", line)
        if match:
            return match.group(1)
    return None


def _derive_equipment_type(make: Optional[str], model: Optional[str]) -> str:
    label = "Equipment"
    combined = f"{make or ''} {model or ''}".strip()
    if combined:
        label = combined.split()[0]
    return label


async def run_one_click_submission(id_image, invoice_image) -> Dict[str, Any]:
    db = _DB_CONTEXT.get()
    salesperson = _SALESPERSON_CONTEXT.get()
    if db is None or salesperson is None:
        raise RuntimeError("One-click submission context is missing database or salesperson.")

    id_bytes = await _read_bytes(id_image)
    invoice_bytes = await _read_bytes(invoice_image)

    id_ocr = await extract_text_from_id(id_bytes)
    if "error" in id_ocr:
        raise RuntimeError(id_ocr["error"])
    id_lines = id_ocr.get("rawText") or []
    id_fields = parse_id_fields_with_confidence(id_ocr.get("lines") or id_lines)
    id_fields, id_needs_review = apply_confidence_threshold(id_fields, threshold=0.7)

    first_name = id_fields["firstName"]["value"] or find_name(id_lines)[0]
    last_name = id_fields["lastName"]["value"] or find_name(id_lines)[1]
    date_of_birth = id_fields["dateOfBirth"]["value"] or find_dob(id_lines)
    street = id_fields["address"]["street"]["value"]
    city = id_fields["address"]["city"]["value"]
    state = id_fields["address"]["state"]["value"]
    zip_code = id_fields["address"]["zip"]["value"]
    ssn = id_fields["ssn"]["value"] or _extract_ssn(id_lines) or "0000"

    invoice_data = await extract_invoice_data(invoice_bytes)

    buyer_name = invoice_data.get("buyer_name")
    if (not first_name or not last_name) and buyer_name:
        split = _split_name(buyer_name)
        first_name = first_name or split["first"]
        last_name = last_name or split["last"]

    borrower_payload = {
        "firstName": first_name,
        "lastName": last_name,
        "dateOfBirth": date_of_birth,
        "ssn": ssn,
        "address": {
            "street": street,
            "city": city,
            "state": state,
            "zip": zip_code,
        },
    }

    make = invoice_data.get("make")
    model = invoice_data.get("model")
    year = _safe_int(invoice_data.get("year"))
    serial_number = invoice_data.get("serial_number")
    hours = _safe_float(invoice_data.get("hours"))
    price = _safe_float(invoice_data.get("price"))
    taxes = _safe_float(invoice_data.get("taxes"))
    fees = _safe_float(invoice_data.get("fees"))
    trade_in_value = _safe_float(invoice_data.get("trade_in_value"))
    down_payment = _safe_float(invoice_data.get("down_payment"))
    total_financed_amount = _safe_float(invoice_data.get("total_financed_amount"))

    purchase_asset = {
        "make": make,
        "model": model,
        "year": year,
        "serialNumber": serial_number,
        "condition": "Good",
        "valueEstimate": price,
    }
    trade_ins = []
    if trade_in_value > 0:
        trade_ins.append({
            "make": None,
            "model": None,
            "year": None,
            "serialNumber": None,
            "condition": "Unknown",
            "valueEstimate": trade_in_value,
        })

    equipment_type = _derive_equipment_type(make, model)
    computed_amount = max(0.0, price - trade_in_value - down_payment)
    loan_amount = total_financed_amount if total_financed_amount > 0 else computed_amount

    loan_payload = {
        "equipmentType": equipment_type,
        "make": make,
        "model": model,
        "year": year,
        "serialNumber": serial_number,
        "condition": "Good",
        "purchasePrice": price,
        "cashDown": down_payment,
        "termMonths": 60,
        "amount": loan_amount,
        "hasTradeIn": bool(trade_ins),
        "purchaseAssets": [purchase_asset],
        "tradeIns": trade_ins,
    }

    dealer_payload = {
        "dealershipName": invoice_data.get("dealer_name"),
    }

    current_year = datetime.utcnow().year
    equipment_value = max(price, 1.0)
    is_new = bool(year and year >= current_year - 1)
    prequal_payload = {
        "loan_amount": max(loan_amount, 1.0),
        "equipment_list": [{
            "type": equipment_type,
            "year": year or current_year,
            "value": equipment_value,
            "isNew": is_new,
            "serialNumber": serial_number,
        }],
        "borrower_income": _safe_float(borrower_payload.get("annualIncome") or 60000),
        "credit_score": int(_safe_float(borrower_payload.get("creditScore") or 680)),
        "down_payment": down_payment,
        "naics_code": borrower_payload.get("naicsCode") or "1111",
        "state": (state or dealer_payload.get("state") or "IA"),
        "trade_in_present": bool(trade_ins),
        "loan_term_months": 60,
    }
    prequalification = await run_prequalification(prequal_payload)

    equipment_intelligence = await run_equipment_intelligence(make, model, year, hours, serial_number)

    invoice_fields = invoice_data.get("fields") or {}
    invoice_fields, invoice_needs_review = apply_confidence_threshold(invoice_fields, threshold=0.7)
    needs_review = [
        {
            "field": f"id.{item['field']}",
            "confidence": item["confidence"],
            "value": item.get("value"),
        }
        for item in id_needs_review
    ] + [
        {
            "field": f"invoice.{item['field']}",
            "confidence": item["confidence"],
            "value": item.get("value"),
        }
        for item in invoice_needs_review
    ]

    fraud_payload = {
        "serial_number": serial_number,
        "year": year,
        "hours": hours,
        "price": price,
        "taxes": taxes,
        "fees": fees,
        "trade_in_value": trade_in_value,
        "down_payment": down_payment,
        "total_financed_amount": total_financed_amount,
        "comparables": equipment_intelligence.get("comparables") if isinstance(equipment_intelligence, dict) else [],
        "image_tampering": {
            "id": {
                "possible_tampering": id_ocr.get("possible_tampering"),
                "tampering_score": id_ocr.get("tampering_score"),
                "tampering_reasons": id_ocr.get("tampering_reasons"),
            },
            "invoice": {
                "possible_tampering": invoice_data.get("possible_tampering"),
                "tampering_score": invoice_data.get("tampering_score"),
                "tampering_reasons": invoice_data.get("tampering_reasons"),
            },
        },
    }
    behavioral_context = {
        "salesperson_id": getattr(salesperson, "id", None),
        "borrower_ssn": ssn,
        "borrower_email": borrower_payload.get("email"),
        "device_fingerprint": None,
        "user_agent": None,
        "ip_address": None,
        "upload_retry_count": 0,
    }
    fraud_payload["behavioral_signals"] = compute_behavioral_signals(behavioral_context).to_dict()
    fraud_flags = evaluate_fraud_flags(fraud_payload)

    temp_app = LoanApplication(
        salesperson_id=getattr(salesperson, "id", None),
        location_id=getattr(salesperson, "location_id", None),
        borrower_data=borrower_payload,
        loan_data=loan_payload,
        dealer_data=dealer_payload,
        application_number="ONECLICK",
        status="submitted",
    )
    matched_lenders = rank_lenders_with_scores(db, temp_app, prequalification, equipment_intelligence)

    submission_request = LoanSubmissionRequest(
        borrower_type="individual",
        has_coborrower=False,
        borrower_data=borrower_payload,
        loan_data=loan_payload,
        dealer_data=dealer_payload,
    )
    submission_response = submit_service.submit(db, salesperson, submission_request)

    return {
        "borrower": borrower_payload,
        "equipment": purchase_asset,
        "trade_in": trade_ins,
        "loan": loan_payload,
        "ai_prequal": prequalification,
        "equipment_intelligence": equipment_intelligence,
        "fraud_flags": fraud_flags,
        "ocr_confidence": {
            "id": id_fields,
            "invoice": invoice_fields,
            "needs_review": needs_review,
        },
        "matched_lenders": matched_lenders,
        "submission": submission_response,
    }
