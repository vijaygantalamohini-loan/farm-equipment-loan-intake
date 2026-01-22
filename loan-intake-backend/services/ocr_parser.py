"""
OCR Parsing Helper Functions

Provides parsing and extraction logic for OCR results.
Used to extract structured data from ID cards and invoices.
"""

import re
from typing import Any, Dict, Iterable, List, Optional, Tuple


DEFAULT_CONFIDENCE = 0.6


def _normalize_ocr_lines(lines: Iterable[Any]) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    for line in lines or []:
        if isinstance(line, dict):
            normalized.append(
                {
                    "text": str(line.get("text") or ""),
                    "confidence": line.get("confidence"),
                    "words": line.get("words") or [],
                }
            )
        else:
            normalized.append({"text": str(line or ""), "confidence": None, "words": []})
    return normalized


def _avg_confidence(values: Iterable[Optional[float]]) -> Optional[float]:
    cleaned = [v for v in values if isinstance(v, (int, float))]
    if not cleaned:
        return None
    return float(sum(cleaned) / len(cleaned))


def _line_confidence(line: Dict[str, Any]) -> Optional[float]:
    conf = line.get("confidence")
    if isinstance(conf, (int, float)):
        return float(conf)
    words = line.get("words") or []
    return _avg_confidence([w.get("confidence") for w in words if isinstance(w, dict)])


def _confidence_for_value(lines: List[Dict[str, Any]], value: Optional[str]) -> float:
    if not value:
        return 0.0
    candidates = []
    target = str(value).strip().lower()
    if not target:
        return 0.0
    for line in lines:
        text = str(line.get("text") or "").lower()
        if target in text:
            conf = _line_confidence(line)
            if conf is not None:
                candidates.append(conf)
    if candidates:
        return float(sum(candidates) / len(candidates))
    return DEFAULT_CONFIDENCE


def _coerce_lines_to_text(lines: Iterable[Any]) -> List[str]:
    return [str(line.get("text")) if isinstance(line, dict) else str(line) for line in lines or []]


def find_name(lines: list) -> tuple:
    """
    Extract first and last name from OCR lines using various heuristics.
    
    Args:
        lines: List of text lines from OCR
        
    Returns:
        Tuple of (first_name, last_name) or (None, None) if not found
    """
    # 1) LAST, FIRST[/MIDDLE] (comma-delimited)
    lines = _coerce_lines_to_text(lines)
    for l in lines:
        s = l.strip()
        m = re.match(r'^([A-Z][A-Z\s\-\']+),\s*([A-Z][A-Z\s\-\']+)$', s)
        if m:
            last = m.group(1).title()
            first = m.group(2).split()[0].title()
            return first, last

    # 2) Capitalized words (First Last or First Middle Last)
    for l in lines:
        s = l.strip()
        if re.match(r'^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}$', s):
            parts = s.split()
            return parts[0], parts[-1]

    # 3) ALL CAPS lines with 2-3 words (common on many IDs), but exclude common words like "No"
    for l in lines:
        s = l.strip()
        if re.match(r'^[A-Z][A-Z\s\-\']{2,}$', s) and len(s.split()) <= 3 and len(s.split()) >= 2:
            parts = [p.title() for p in s.split()]
            # filter out single-letter parts and common short words
            if all(len(p) > 2 or p.lower() not in ['no', 'or', 'is', 'of'] for p in parts):
                return parts[0], parts[-1]

    # 4) 'Name: First Last' or similar labels
    for l in lines:
        m = re.search(r'Name[:\s]+([A-Za-z]+)\s+([A-Za-z]+)', l, re.I)
        if m:
            return m.group(1).title(), m.group(2).title()

    # 5) Fallback: first line containing two words with letters (require 4+ char names for real names)
    for l in lines:
        s = l.strip()
        parts = re.findall(r"[A-Za-z'-]+", s)
        if len(parts) >= 2 and all(len(p) >= 3 for p in parts[:2]):  # require 3+ char names
            return parts[0].title(), parts[1].title()

    return None, None


def find_dob(lines: list) -> str:
    """
    Extract date of birth from OCR lines.
    
    Args:
        lines: List of text lines from OCR
        
    Returns:
        Date string or None if not found
    """
    lines = _coerce_lines_to_text(lines)
    for l in lines:
        # common formats YYYY-MM-DD (check first)
        m2 = re.search(r'(\d{4}-\d{2}-\d{2})', l)
        if m2:
            return m2.group(1)
        # MM/DD/YYYY or M/D/YY or MM-DD-YYYY
        m = re.search(r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', l)
        if m:
            return m.group(1)
    return None


def find_address(lines: list) -> tuple:
    """
    Extract street, city, state, and zip from OCR lines.
    
    Args:
        lines: List of text lines from OCR
        
    Returns:
        Tuple of (street, city, state, zip_code)
    """
    zip_code = None

    # 1) Look for lines like "City, ST 12345" or "City, State 12345"
    city_state_zip_re = re.compile(r"(?P<city>[A-Za-z .\-']+),\s*(?P<state>[A-Za-z]{2}|[A-Za-z .'-]{3,})\s+(?P<zip>\d{5}(?:-\d{4})?)")
    city_state_zip_re2 = re.compile(r"(?P<city>[A-Za-z .\-']+)\s+(?P<state>[A-Z]{2})\s+(?P<zip>\d{5}(?:-\d{4})?)")
    lines = _coerce_lines_to_text(lines)
    for i, l in enumerate(lines):
        s = l.strip()
        m = city_state_zip_re.search(s) or city_state_zip_re2.search(s)
        if m:
            zip_code = m.group('zip')
            city = m.group('city').strip()
            state = m.group('state').strip()
            # try to find a street line immediately before this one
            street = None
            if i > 0 and not city_state_zip_re.search(lines[i-1]):
                street = lines[i-1].strip()
            return street, city, state, zip_code

    # 2) Check adjacent lines: street line followed by "City, ST ZIP"
    for i in range(len(lines)-1):
        next_line = lines[i+1].strip()
        m = city_state_zip_re.search(next_line) or city_state_zip_re2.search(next_line)
        if m:
            street = lines[i].strip()
            zip_code = m.group('zip')
            city = m.group('city').strip()
            state = m.group('state').strip()
            return street, city, state, zip_code

    # 3) Fallback: look for a zip anywhere and return that line as address
    for l in lines:
        m = re.search(r"\b(\d{5}(?:-\d{4})?)\b", l)
        if m:
            zip_code = m.group(1)
            # try to split city/state from the same line
            parts = re.split(r'[,\n]', l)
            if len(parts) >= 2:
                city_state = parts[-2].strip()
                m2 = re.match(r"(?P<city>[A-Za-z .\-']+)\s+(?P<state>[A-Z]{2})", city_state)
                if m2:
                    return None, m2.group('city').strip(), m2.group('state').strip(), zip_code
            return l.replace(zip_code, '').strip(' ,'), None, None, zip_code

    # 4) fallback: look for street keywords
    for l in lines:
        if re.search(r'\b(St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Ln|Lane)\b', l, re.I):
            return l.strip(), None, None, zip_code

    return None, None, None, None


def find_ssn(lines: list) -> Optional[str]:
    lines = _coerce_lines_to_text(lines)
    for line in lines:
        match = re.search(r"\b(\d{3}-\d{2}-\d{4})\b", line)
        if match:
            return match.group(1)
        match = re.search(r"\b(\d{9})\b", line)
        if match:
            raw = match.group(1)
            return f"{raw[:3]}-{raw[3:5]}-{raw[5:]}"
        match = re.search(r"\bSSN[:\s]*([0-9Xx\-]{4,11})\b", line, re.I)
        if match:
            return match.group(1)
    return None


def parse_id_fields_with_confidence(lines: Iterable[Any]) -> Dict[str, Any]:
    normalized = _normalize_ocr_lines(lines)
    line_texts = [line.get("text", "") for line in normalized]

    first_name, last_name = find_name(line_texts)
    date_of_birth = find_dob(line_texts)
    street, city, state, zip_code = find_address(line_texts)
    ssn = find_ssn(line_texts)

    first_conf = _confidence_for_value(normalized, first_name)
    last_conf = _confidence_for_value(normalized, last_name)
    dob_conf = _confidence_for_value(normalized, date_of_birth)
    ssn_conf = _confidence_for_value(normalized, ssn)
    street_conf = _confidence_for_value(normalized, street)
    city_conf = _confidence_for_value(normalized, city)
    state_conf = _confidence_for_value(normalized, state)
    zip_conf = _confidence_for_value(normalized, zip_code)

    return {
        "firstName": {"value": first_name, "confidence": first_conf},
        "lastName": {"value": last_name, "confidence": last_conf},
        "dateOfBirth": {"value": date_of_birth, "confidence": dob_conf},
        "ssn": {"value": ssn, "confidence": ssn_conf},
        "address": {
            "street": {"value": street, "confidence": street_conf},
            "city": {"value": city, "confidence": city_conf},
            "state": {"value": state, "confidence": state_conf},
            "zip": {"value": zip_code, "confidence": zip_conf},
        },
    }


def apply_confidence_threshold(
    fields: Dict[str, Any],
    threshold: float = 0.7,
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    flagged: List[Dict[str, Any]] = []

    def _walk(node: Dict[str, Any], prefix: str = "") -> Dict[str, Any]:
        updated: Dict[str, Any] = {}
        for key, value in node.items():
            path = f"{prefix}{key}"
            if isinstance(value, dict) and "value" in value and "confidence" in value:
                confidence = value.get("confidence")
                needs_review = (
                    confidence is not None
                    and isinstance(confidence, (int, float))
                    and confidence < threshold
                )
                updated_value = dict(value)
                updated_value["needs_review"] = bool(needs_review)
                updated[key] = updated_value
                if needs_review and updated_value.get("value") not in (None, ""):
                    flagged.append(
                        {
                            "field": path,
                            "confidence": float(confidence),
                            "value": updated_value.get("value"),
                        }
                    )
            elif isinstance(value, dict):
                updated[key] = _walk(value, prefix=f"{path}.")
            else:
                updated[key] = value
        return updated

    return _walk(fields), flagged
