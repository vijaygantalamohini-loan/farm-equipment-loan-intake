"""
Invoice OCR extraction service.

Uses Azure Computer Vision OCR to extract invoice fields.
"""

from __future__ import annotations

import asyncio
import datetime as dt
import re
from typing import Dict, List, Optional, Any, Tuple

import httpx

from services.ocr_service import AZURE_ENDPOINT, AZURE_KEY, _analyze_image_metadata


_MONEY_RE = re.compile(r"\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)")
_NUMBER_RE = re.compile(r"([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?)")


def _normalize_text(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    return re.sub(r"\s+", " ", value).strip()


def _extract_amount(text: str) -> Optional[float]:
    matches = _MONEY_RE.findall(text)
    if not matches:
        return None
    amount = matches[-1].replace(",", "")
    try:
        return float(amount)
    except ValueError:
        return None


def _extract_number(text: str) -> Optional[float]:
    matches = _NUMBER_RE.findall(text)
    if not matches:
        return None
    number = matches[-1].replace(",", "")
    try:
        return float(number)
    except ValueError:
        return None


def _find_labeled_value(lines: List[str], label_pattern: str) -> Optional[str]:
    label_re = re.compile(label_pattern, re.I)
    for idx, line in enumerate(lines):
        if not label_re.search(line):
            continue
        inline_match = re.search(label_pattern + r"[:#\s\-]*([A-Za-z0-9].+)$", line, re.I)
        if inline_match:
            return _normalize_text(inline_match.group(1))
        if idx + 1 < len(lines):
            return _normalize_text(lines[idx + 1])
    return None


def _find_labeled_amount(lines: List[str], label_pattern: str) -> Optional[float]:
    label_re = re.compile(label_pattern, re.I)
    for idx, line in enumerate(lines):
        if not label_re.search(line):
            continue
        amount = _extract_amount(line)
        if amount is not None:
            return amount
        if idx + 1 < len(lines):
            amount = _extract_amount(lines[idx + 1])
            if amount is not None:
                return amount
    return None


def _find_labeled_number(lines: List[str], label_pattern: str) -> Optional[float]:
    label_re = re.compile(label_pattern, re.I)
    for idx, line in enumerate(lines):
        if not label_re.search(line):
            continue
        number = _extract_number(line)
        if number is not None:
            return number
        if idx + 1 < len(lines):
            number = _extract_number(lines[idx + 1])
            if number is not None:
                return number
    return None


def _find_make(lines: List[str], full_text: str) -> Optional[str]:
    make = _find_labeled_value(lines, r"\b(make|manufacturer|brand|mfg)\b")
    if make:
        return make
    known_makes = [
        "John Deere",
        "Case IH",
        "New Holland",
        "Kubota",
        "Massey Ferguson",
        "Fendt",
        "Claas",
        "Deutz Fahr",
        "Caterpillar",
        "CAT",
        "Bobcat",
        "Komatsu",
        "JCB",
    ]
    for brand in known_makes:
        if re.search(r"\b" + re.escape(brand) + r"\b", full_text, re.I):
            return brand
    return None


def _find_model(lines: List[str], full_text: str) -> Optional[str]:
    model = _find_labeled_value(lines, r"\b(model|type)\b")
    if model:
        return model
    model_match = re.search(r"\b([A-Z]{0,2}\d{3,5}[A-Z]?)\b", full_text)
    if model_match:
        return model_match.group(1)
    return None


def _find_year(lines: List[str], full_text: str) -> Optional[str]:
    year_line = _find_labeled_value(lines, r"\b(year|model\s*year|mfg\.?\s*year|manufacture\s*year)\b")
    if year_line:
        year_match = re.search(r"\b(19\d{2}|20\d{2})\b", year_line)
        if year_match:
            return year_match.group(1)
    current_year = dt.datetime.utcnow().year + 1
    for match in re.findall(r"\b(19\d{2}|20\d{2})\b", full_text):
        year_int = int(match)
        if 1980 <= year_int <= current_year:
            return match
    return None


def _find_serial(lines: List[str], full_text: str) -> Optional[str]:
    serial = _find_labeled_value(lines, r"\b(serial\s*(?:no|number|#)?|s\/n|sn|vin|unit\s*no)\b")
    if serial:
        return serial.replace(" ", "").upper()
    serial_match = re.search(r"\b([A-Z0-9\-]{6,})\b", full_text, re.I)
    if serial_match:
        return serial_match.group(1).replace(" ", "").upper()
    return None


def _normalize_lines(lines: List[Any]) -> Tuple[List[str], List[Optional[float]]]:
    cleaned: List[str] = []
    confidences: List[Optional[float]] = []
    for line in lines or []:
        if isinstance(line, dict):
            text = _normalize_text(line.get("text"))
            confidence = line.get("confidence")
        else:
            text = _normalize_text(str(line))
            confidence = None
        if text:
            cleaned.append(text)
            confidences.append(confidence)
    return cleaned, confidences


def _confidence_for_value(lines: List[str], confidences: List[Optional[float]], value: Optional[object]) -> Optional[float]:
    if value is None:
        return None
    target = str(value).strip().lower()
    if not target:
        return None
    matches = [
        confidences[idx]
        for idx, line in enumerate(lines)
        if target in line.lower() and confidences[idx] is not None
    ]
    if not matches:
        return None
    return sum(matches) / len(matches)


def _parse_invoice_lines(lines: List[Any]) -> Dict[str, Optional[object]]:
    cleaned, confidences = _normalize_lines(lines)
    full_text = " ".join(cleaned)

    dealer_name = _find_labeled_value(cleaned, r"\b(dealer|seller|vendor|sold\s*by|dealer\s*name)\b")
    buyer_name = _find_labeled_value(cleaned, r"\b(buyer|purchaser|customer|sold\s*to|bill\s*to|ship\s*to)\b")

    make = _find_make(cleaned, full_text)
    model = _find_model(cleaned, full_text)
    year = _find_year(cleaned, full_text)
    serial_number = _find_serial(cleaned, full_text)

    hours = _find_labeled_number(cleaned, r"\b(hours|hrs|hour\s*meter|engine\s*hours)\b")
    price = _find_labeled_amount(
        cleaned, r"\b(price|sale\s*price|purchase\s*price|cash\s*price|equipment\s*price|subtotal)\b"
    )
    taxes = _find_labeled_amount(cleaned, r"\b(tax|sales\s*tax)\b")
    fees = _find_labeled_amount(cleaned, r"\b(fees?|doc(?:umentation)?\s*fee|processing\s*fee|dealer\s*fee)\b")
    trade_in_value = _find_labeled_amount(cleaned, r"\b(trade\s*-?\s*in|trade\s*allowance|trade\s*value)\b")
    down_payment = _find_labeled_amount(cleaned, r"\b(down\s*payment|downpayment|cash\s*down|dp)\b")
    total_financed_amount = _find_labeled_amount(
        cleaned, r"\b(total\s*financed|amount\s*financed|total\s*amount\s*financed|amount\s*due|balance\s*due|total\s*due)\b"
    )

    values = {
        "dealer_name": dealer_name,
        "buyer_name": buyer_name,
        "make": make,
        "model": model,
        "year": year,
        "serial_number": serial_number,
        "hours": hours,
        "price": price,
        "taxes": taxes,
        "fees": fees,
        "trade_in_value": trade_in_value,
        "down_payment": down_payment,
        "total_financed_amount": total_financed_amount,
    }
    field_confidence = {
        key: _confidence_for_value(cleaned, confidences, values[key])
        for key in values
    }

    return {
        **values,
        "field_confidence": field_confidence,
        "fields": {
            key: {"value": values[key], "confidence": field_confidence[key]}
            for key in values
        },
    }


async def _extract_lines_from_azure(image_bytes: bytes) -> List[Dict[str, Any]]:
    analyze_url = f"{AZURE_ENDPOINT}vision/v3.2/read/analyze"
    headers = {
        "Ocp-Apim-Subscription-Key": AZURE_KEY,
        "Content-Type": "application/octet-stream",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(analyze_url, headers=headers, content=image_bytes)
        if response.status_code != 202:
            return []
        operation_url = response.headers.get("Operation-Location")
        if not operation_url:
            return []
        for _ in range(10):
            await asyncio.sleep(1)
            result_response = await client.get(
                operation_url,
                headers={"Ocp-Apim-Subscription-Key": AZURE_KEY},
            )
            result = result_response.json()
            status = result.get("status")
            if status == "succeeded":
                lines: List[Dict[str, Any]] = []
                for read_result in result.get("analyzeResult", {}).get("readResults", []):
                    for line in read_result.get("lines", []):
                        text = line.get("text")
                        if text:
                            words = line.get("words", [])
                            confidences = [
                                w.get("confidence")
                                for w in words
                                if isinstance(w, dict)
                            ]
                            avg_conf = sum(confidences) / len(confidences) if confidences else None
                            lines.append({
                                "text": text,
                                "confidence": avg_conf,
                                "words": words,
                            })
                return lines
            if status == "failed":
                return []
    return []


async def extract_invoice_data(image_bytes: bytes) -> Dict[str, Optional[object]]:
    """
    Extract structured invoice fields from an image.
    """
    tampering = _analyze_image_metadata(image_bytes)
    lines = await _extract_lines_from_azure(image_bytes)
    if not lines:
        empty_fields = {
            "dealer_name": None,
            "buyer_name": None,
            "make": None,
            "model": None,
            "year": None,
            "serial_number": None,
            "hours": None,
            "price": None,
            "taxes": None,
            "fees": None,
            "trade_in_value": None,
            "down_payment": None,
            "total_financed_amount": None,
        }
        return {
            **empty_fields,
            "field_confidence": {key: None for key in empty_fields},
            "fields": {key: {"value": None, "confidence": None} for key in empty_fields},
            "possible_tampering": tampering["possible_tampering"],
            "tampering_score": tampering["tampering_score"],
            "tampering_reasons": tampering["tampering_reasons"],
        }
    parsed = _parse_invoice_lines(lines)
    parsed["possible_tampering"] = tampering["possible_tampering"]
    parsed["tampering_score"] = tampering["tampering_score"]
    parsed["tampering_reasons"] = tampering["tampering_reasons"]
    return parsed
