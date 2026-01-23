"""
Invoice parsing service

Extracts structured data from invoice OCR text.
"""

import re
from typing import Dict, List, Optional, Any, Iterable, Tuple


def _normalize_ocr_lines(lines: Iterable[Any]) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    for line in lines or []:
        if isinstance(line, dict):
            normalized.append(
                {
                    "text": str(line.get("text") or ""),
                    "confidence": line.get("confidence"),
                }
            )
        else:
            normalized.append({"text": str(line or ""), "confidence": None})
    return normalized


def extract_invoice_details_with_confidence(lines: List[Any]) -> Dict[str, Any]:
    """
    Extract structured data from invoice OCR text.
    
    Args:
        lines: List of text lines from OCR
        
    Returns:
        Dictionary with extracted invoice fields
    """
    invoice_data = {
        "make": None,
        "manufacturer": None,
        "model": None,
        "year": None,
        "serialNumber": None,
        "price": None,
        "dealerName": None,
        "dealerAddress": None,
        "invoiceNumber": None,
        "invoiceDate": None
    }
    field_confidence = {key: None for key in invoice_data.keys()}
    normalized_lines = _normalize_ocr_lines(lines)

    for line in normalized_lines:
        text = line["text"]
        confidence = line.get("confidence")
        # Serial number patterns - handle "Serial No:", "Serial Number:", "S/N:", "SN:", etc.
        serial_match = re.search(r"(?:serial\s*(?:no|number|num)?|s\s*/\s*n|sn)[:\s]+([A-Z0-9-]+)", text, re.I)
        if serial_match and not invoice_data["serialNumber"]:
            serial_candidate = serial_match.group(1)
            # Ensure we captured actual serial number, not just "No" or "Number"
            if serial_candidate.upper() not in ["NO", "NUMBER", "NUM", "N"]:
                invoice_data["serialNumber"] = serial_candidate
                field_confidence["serialNumber"] = confidence
        
        # Year patterns
        year_match = re.search(r"(?:year|model year)[:\s]+(\d{4})", text, re.I)
        if year_match and not invoice_data["year"]:
            invoice_data["year"] = year_match.group(1)
            field_confidence["year"] = confidence
        
        # Model patterns
        model_match = re.search(r"(?:model)[:\s]+([A-Z0-9\-]+)", text, re.I)
        if model_match and not invoice_data["model"]:
            invoice_data["model"] = model_match.group(1)
            field_confidence["model"] = confidence
        
        # Price patterns (dollar amounts)
        price_match = re.search(r"\$[\d,]+(?:\.\d{2})?", text)
        if price_match:
            invoice_data["price"] = price_match.group()
            field_confidence["price"] = confidence
        
        # Invoice number
        inv_match = re.search(r"(?:invoice|inv)[#:\s]+([A-Z0-9-]+)", text, re.I)
        if inv_match and not invoice_data["invoiceNumber"]:
            invoice_data["invoiceNumber"] = inv_match.group(1)
            field_confidence["invoiceNumber"] = confidence
        
        # Date patterns
        date_match = re.search(r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})", text)
        if date_match and not invoice_data["invoiceDate"]:
            invoice_data["invoiceDate"] = date_match.group(1)
            field_confidence["invoiceDate"] = confidence

    fields = {
        key: {"value": invoice_data[key], "confidence": field_confidence[key]}
        for key in invoice_data
    }
    return {
        "values": invoice_data,
        "fields": fields,
    }


def extract_invoice_details(lines: List[Any]) -> Dict[str, Optional[str]]:
    details = extract_invoice_details_with_confidence(lines)
    return details["values"]
