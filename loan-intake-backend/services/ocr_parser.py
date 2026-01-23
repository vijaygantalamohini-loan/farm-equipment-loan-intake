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
    Enhanced for driver's license formats.
    
    Args:
        lines: List of text lines from OCR
        
    Returns:
        Tuple of (first_name, last_name) or (None, None) if not found
    """
    lines = _coerce_lines_to_text(lines)
    
    # Skip common ID card headers and document type labels
    exclude_patterns = [
        r'WASHINGTON\s+STATE',
        r'USA\s+WASHINGTON',  # Country + State header
        r'DRIVER\s*LICENSE',
        r'IDENTIFICATION\s*CARD',
        r'STATE\s+OF\s+\w+',
        r'DEPARTMENT\s+OF',
        r'MOTOR\s+VEHICLES?',
        r'DMV',
        r'CLASS\s+[A-Z]',
        r'DONOR',
        r'VETERAN',
        r'NEW\s*$',
        r'REAL\s*ID',
        r'^\s*\.\s*$',  # Lines with just periods
        r'^Include\s+Empty$',  # UI form fields
        r'^First\s+Name$',  # Form labels
        r'^Last\s+Name$',  # Form labels
        r'^Middle\s+Name$',  # Form labels
        r'^Document\s+Type',  # Form labels
        r'^Document\s+Number',  # Form labels
        r'\.jpeg',  # Filenames
        r'Fiokis',  # UI elements
        r'^JSON$',  # UI elements
        r'^DONE$',  # UI buttons
        r'visitPA\.com',  # Website URLs
    ]
    
    filtered_lines = []
    for line in lines:
        skip = False
        for pattern in exclude_patterns:
            if re.search(pattern, line, re.I):
                skip = True
                break
        if not skip:
            filtered_lines.append(line)
    
    lines = filtered_lines
    
    # 0) PRIORITY: Look for standard numbered fields (AAMVA format)
    # 1 = First Name, 2 = Last Name, 3 = DOB, 8 = Address
    first_name_candidates = []
    last_name_candidates = []
    
    for i, l in enumerate(lines):
        s = l.strip()
        
        # Look for "1 FIRSTNAME" or "1. FIRSTNAME" at start of line
        match_1 = re.match(r'^1\.?\s+([A-Z][A-Z\s\-\']+?)(?:\s*$|\s+2\.)', s, re.I)
        if match_1:
            first_name_candidates.append(match_1.group(1).strip().title())
        
        # Look for "2 LASTNAME" or "2. LASTNAME" or "2 FIRST LAST"
        match_2 = re.match(r'^2\.?\s+([A-Z][A-Z\s\-\']+?)(?:\s*$|\s+3\.)', s, re.I)
        if match_2:
            last_name_candidates.append(match_2.group(1).strip().title())
    
    # If we found field 2 but not field 1, look for SAMPLE near field 2 as first name
    if not first_name_candidates and last_name_candidates:
        for i, l in enumerate(lines):
            s = l.strip()
            # Look for standalone "SAMPLE" that's likely a first name
            if s == "SAMPLE" and i > 0:
                # Check if it's near the "2 LASTNAME" line (within 10 lines)
                for j, check_line in enumerate(lines):
                    if check_line.strip().startswith("2 ") or check_line.strip().startswith("2."):
                        if abs(i - j) <= 10:  # Within 10 lines of field 2
                            first_name_candidates.append("Sample")
                            break
                if first_name_candidates:
                    break
    
    # If we found both numbered fields, return them
    if first_name_candidates and last_name_candidates:
        return first_name_candidates[0], last_name_candidates[0]
    
    # 1) Look for explicit driver's license name fields with labels (Washington format: "1a LN", "2", ".")
    for i, l in enumerate(lines):
        s = l.strip()
        
        # Look for line starting with just ". " followed by name (Washington format: ". TEST")
        period_name_match = re.match(r'^\.\s+([A-Z][A-Z\s\-\']+)$', s, re.I)
        if period_name_match:
            first = period_name_match.group(1).strip().title()
            # Look for "2 LASTNAME" or "2 FIRSTNAME LASTNAME" on next lines
            for j in range(i, min(i + 3, len(lines))):
                next_s = lines[j].strip()
                # Pattern: "2 PERSON HUMAN" where everything after "2 " is full name
                num_name_match = re.match(r'^2\s+([A-Z][A-Z\s\-\']+)$', next_s, re.I)
                if num_name_match:
                    last = num_name_match.group(1).strip().title()
                    return first, last
        
        # Washington State format: "1a LN TEST" where TEST is last name
        last_match = re.search(r'(?:1a?\s*LN|1a?\.\s*LN)[:\s]+([A-Z][A-Z\s\-\']+?)(?:\s+1\s|$)', s, re.I)
        if last_match:
            last = last_match.group(1).strip().title()
            # Look for "1 FIRSTNAME LASTNAME" or "2 FIRSTNAME LASTNAME" pattern on next line or later
            for j in range(i, min(i + 3, len(lines))):
                next_s = lines[j].strip()
                # Pattern: "2 PERSON HUMAN" where everything after number is full name
                first_match = re.match(r'^[12]\s+([A-Z][A-Z\s\-\']+)$', next_s, re.I)
                if first_match:
                    # Everything after the number is the full name (could be first + last)
                    full_name = first_match.group(1).strip()
                    name_parts = full_name.split()
                    if len(name_parts) >= 1:
                        first = name_parts[0].title()
                        # Combine remaining parts as last name
                        if len(name_parts) > 1:
                            last_combined = ' '.join(name_parts[1:]).title()
                            return first, last_combined
                        return first, last
        
        # Standard format: "1. LAST NAME" or "LN:" followed by last name
        if re.search(r'\b(?:1\.|LN|LAST\s*NAME)[:\s]', s, re.I):
            last_match = re.search(r'(?:1\.|LN|LAST\s*NAME)[:\s]+([A-Z][A-Z\s\-\']+?)(?:\s*2\.|$)', s, re.I)
            if last_match:
                last = last_match.group(1).strip().title()
                # Look for first name on same line or next line
                first_match = re.search(r'(?:2\.|FN|FIRST\s*NAME)[:\s]+([A-Z\-\'\s]+?)(?:\s*3\.|$)', s, re.I)
                if first_match:
                    first = first_match.group(1).strip().title()
                    return first, last
                # Check next line for first name
                if i + 1 < len(lines):
                    next_line = lines[i + 1].strip()
                    first_match = re.search(r'(?:2\.|FN|FIRST\s*NAME)[:\s]+([A-Z\-\'\s]+?)(?:\s*3\.|$)', next_line, re.I)
                    if first_match:
                        first = first_match.group(1).strip().title()
                        return first, last
    
    # Look for labeled fields
    for l in lines:
        s = l.strip()
        # "LAST NAME: SMITH" or "LN: SMITH"
        last_match = re.search(r'(?:LAST\s*NAME|LN)[:\s]+([A-Z][A-Z\-\'\s]+?)(?:\s+(?:FIRST|FN)|$)', s, re.I)
        first_match = re.search(r'(?:FIRST\s*NAME|FN)[:\s]+([A-Z][A-Z\-\'\s]+?)(?:\s+(?:MIDDLE|MN)|$)', s, re.I)
        if last_match and first_match:
            return first_match.group(1).strip().title(), last_match.group(1).strip().title()
    
    # 1) LAST, FIRST[/MIDDLE] or LASTNAME, FIRSTNAME (comma-delimited - most common on DLs)
    for l in lines:
        s = l.strip()
        # Handle formats like "SMITH, JOHN" or "SMITH,JOHN" or "SMITH, JOHN MICHAEL"
        m = re.match(r'^([A-Z][A-Z\s\-\']+?),\s*([A-Z][A-Z\s\-\']+?)(?:\s+[A-Z]\.?)?$', s)
        if m:
            last = m.group(1).strip().title()
            first_parts = m.group(2).strip().split()
            first = first_parts[0].title() if first_parts else ""
            # Exclude if it looks like an address or other data
            if last and first and len(last) > 1 and len(first) > 1:
                return first, last

    # 2) Capitalized words (First Last or First Middle Last)
    for l in lines:
        s = l.strip()
        if re.match(r'^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}$', s):
            parts = s.split()
            if len(parts) >= 2:
                return parts[0], parts[-1]

    # 3) ALL CAPS lines with 2-3 words (common on many IDs), but exclude common words
    for l in lines:
        s = l.strip()
        # Skip lines that look like addresses or have numbers
        if re.search(r'\d', s):
            continue
        if re.match(r'^[A-Z][A-Z\s\-\']{2,}$', s) and len(s.split()) >= 2 and len(s.split()) <= 3:
            parts = [p.title() for p in s.split()]
            # filter out single-letter parts and common short words
            if all(len(p) > 2 or p.lower() not in ['no', 'or', 'is', 'of', 'dr', 'st', 'rd', 'ave'] for p in parts):
                # Exclude if it looks like a location (contains state abbreviations)
                us_states = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 
                            'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS',
                            'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK',
                            'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY']
                if not any(state in parts for state in us_states):
                    return parts[0], parts[-1]

    # 4) 'Name: First Last' or similar labels
    for l in lines:
        m = re.search(r'Name[:\s]+([A-Za-z]+)\s+([A-Za-z]+)', l, re.I)
        if m:
            return m.group(1).title(), m.group(2).title()

    # 5) Fallback: first line containing two words with letters (require 3+ char names for real names)
    for l in lines:
        s = l.strip()
        # Skip lines with numbers (likely addresses or dates)
        if re.search(r'\d', s):
            continue
        parts = re.findall(r"[A-Za-z'-]+", s)
        if len(parts) >= 2 and all(len(p) >= 3 for p in parts[:2]):  # require 3+ char names
            return parts[0].title(), parts[1].title()

    return None, None


def _normalize_date_to_iso(date_str: str) -> Optional[str]:
    """
    Convert various date formats to YYYY-MM-DD (ISO 8601 format).
    
    Args:
        date_str: Date string in various formats
        
    Returns:
        Date in YYYY-MM-DD format or None if parsing fails
    """
    if not date_str:
        return None
    
    date_str = date_str.strip()
    
    # Already in YYYY-MM-DD format
    if re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
        return date_str
    
    # Try MM/DD/YYYY or MM-DD-YYYY
    m = re.match(r'^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$', date_str)
    if m:
        month, day, year = m.groups()
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    
    # Try M/D/YY or MM-DD-YY (2-digit year)
    m = re.match(r'^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$', date_str)
    if m:
        month, day, year = m.groups()
        # Assume 19xx for years 30-99, 20xx for years 00-29
        full_year = f"19{year}" if int(year) >= 30 else f"20{year}"
        return f"{full_year}-{month.zfill(2)}-{day.zfill(2)}"
    
    # Try YYYY/MM/DD
    m = re.match(r'^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$', date_str)
    if m:
        year, month, day = m.groups()
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    
    # Try YYYYMMDD (no separators)
    m = re.match(r'^(\d{4})(\d{2})(\d{2})$', date_str)
    if m:
        year, month, day = m.groups()
        return f"{year}-{month}-{day}"
    
    # Try DD/MM/YYYY (European format) - less common in US IDs but possible
    # Only use this if month > 12, indicating it's likely DD/MM
    m = re.match(r'^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$', date_str)
    if m:
        first, second, year = m.groups()
        if int(first) > 12:  # Definitely day first
            return f"{year}-{second.zfill(2)}-{first.zfill(2)}"
    
    return None


def find_dob(lines: list) -> str:
    """
    Extract date of birth from OCR lines and normalize to YYYY-MM-DD format.
    Enhanced for driver's license formats with field labels.
    
    Args:
        lines: List of text lines from OCR
        
    Returns:
        Date string in YYYY-MM-DD format or None if not found
    """
    lines = _coerce_lines_to_text(lines)
    
    # PRIORITY: Look for standard numbered fields (AAMVA format)
    # 3 = DOB or "3 DOB DATE"
    for l in lines:
        s = l.strip()
        
        # Pattern: "3 DOB 08/04/1975" or "3. DOB 08/04/1975"
        dob_match = re.match(r'^3\.?\s+(?:DOB\s+)?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', s, re.I)
        if dob_match:
            return _normalize_date_to_iso(dob_match.group(1))
        
        # Pattern: "3 DOB: 08/04/1975" with colon
        dob_match = re.search(r'^3\.?\s+DOB[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', s, re.I)
        if dob_match:
            return _normalize_date_to_iso(dob_match.group(1))
    
    # Look for explicit DOB labels first (common on driver's licenses)
    for l in lines:
        s = l.strip()
        # Patterns like "2 DOB 06/15/1989" (Washington State format)
        dob_match = re.search(r'(?:2|3)\s+DOB\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', s, re.I)
        if dob_match:
            return _normalize_date_to_iso(dob_match.group(1))
        
        # Patterns like "3. DOB 08/15/1989" or "DOB: 08/15/1989" or "DATE OF BIRTH 08/15/1989"
        dob_match = re.search(r'(?:DOB|DATE\s*OF\s*BIRTH|BIRTH\s*DATE|3\.)[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', s, re.I)
        if dob_match:
            return _normalize_date_to_iso(dob_match.group(1))
        
        # Also check for YYYY-MM-DD format with labels
        dob_match = re.search(r'(?:DOB|DATE\s*OF\s*BIRTH|BIRTH\s*DATE|3\.)[:\s]+(\d{4}-\d{2}-\d{2})', s, re.I)
        if dob_match:
            return _normalize_date_to_iso(dob_match.group(1))
    
    # Look for dates near age or sex indicators (common DL layout)
    for i, l in enumerate(lines):
        s = l.strip()
        # Check if line contains sex/gender indicator (M, F, MALE, FEMALE)
        if re.search(r'\b(?:SEX|GENDER|4\.)[:\s]*[MF]\b', s, re.I):
            # Check same line or adjacent lines for dates
            for check_line in [s] + ([lines[i-1]] if i > 0 else []) + ([lines[i+1]] if i < len(lines)-1 else []):
                date_match = re.search(r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', check_line)
                if date_match:
                    return _normalize_date_to_iso(date_match.group(1))
    
    # Standard date search without labels
    for l in lines:
        # common formats YYYY-MM-DD (check first)
        m2 = re.search(r'(\d{4}-\d{2}-\d{2})', l)
        if m2:
            return _normalize_date_to_iso(m2.group(1))
        # MM/DD/YYYY or M/D/YY or MM-DD-YYYY
        m = re.search(r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', l)
        if m:
            return _normalize_date_to_iso(m.group(1))
    return None


def find_address(lines: list) -> tuple:
    """
    Extract street, city, state, and zip from OCR lines.
    Enhanced for driver's license address formats.
    
    Args:
        lines: List of text lines from OCR
        
    Returns:
        Tuple of (street, city, state, zip_code)
    """
    zip_code = None
    lines = _coerce_lines_to_text(lines)
    
    # PRIORITY: Look for standard numbered field 8 (AAMVA format)
    # 8 = Address
    for i, l in enumerate(lines):
        s = l.strip()
        
        # Pattern: "8 123 MAIN STREET" or "8. 123 MAIN STREET" or "# 123 MAIN STREET"
        addr_match = re.match(r'^(?:8\.?|#)\s+(.+)$', s, re.I)
        if addr_match:
            addr_text = addr_match.group(1).strip()
            
            # Check if complete address is on one line: "123 MAIN STREET, HARRISBURG, PA 17101"
            full_addr_match = re.search(r'^(.*?),?\s+([A-Z][A-Za-z\s]+),\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$', addr_text)
            if full_addr_match:
                street = full_addr_match.group(1).strip()
                city = full_addr_match.group(2).strip()
                state = full_addr_match.group(3).strip()
                zip_code = full_addr_match.group(4).strip()
                return street, city, state, zip_code
            
            # Check if city, state, zip are on the same line without comma after street
            full_addr_match2 = re.search(r'^(.*?)\s+([A-Z][A-Za-z\s]+)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$', addr_text)
            if full_addr_match2:
                street = full_addr_match2.group(1).strip()
                city = full_addr_match2.group(2).strip()
                state = full_addr_match2.group(3).strip()
                zip_code = full_addr_match2.group(4).strip()
                return street, city, state, zip_code
            
            # Otherwise, street is on this line, check next line for city/state/zip
            if i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                city_match = re.search(r'^([A-Z][A-Za-z\s]+),?\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$', next_line)
                if city_match:
                    city = city_match.group(1).strip()
                    state = city_match.group(2).strip()
                    zip_code = city_match.group(3).strip()
                    return addr_text, city, state, zip_code
    
    # Look for explicit address field labels (common on driver's licenses)
    for i, l in enumerate(lines):
        s = l.strip()
        # Patterns like "8. ADDRESS" or "ADDR:" or "RESIDENCE ADDRESS" or just "8"
        if re.search(r'(?:8\.?|ADDR(?:ESS)?|RESIDENCE|RES)[:\s]', s, re.I):
            # Address might be on same line or next line(s)
            addr_text = re.sub(r'(?:8\.?|ADDR(?:ESS)?|RESIDENCE|RES)[:\s]+', '', s, flags=re.I).strip()
            
            # Check if address content is on the same line
            # Washington format: "8 406 BLACK LAKE BLVD SW" followed by "OLYMPIA WA 98502-5048"
            if addr_text and len(addr_text) > 5:
                # Try to parse single-line format with everything together
                # Pattern: "406 BLACK LAKE BLVD SW OLYMPIA WA 98502-5048"
                full_addr_match = re.search(r'^(.*?)\s+([A-Z][A-Za-z\s]+)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$', addr_text)
                if full_addr_match:
                    street = full_addr_match.group(1).strip()
                    city = full_addr_match.group(2).strip()
                    state = full_addr_match.group(3).strip()
                    zip_code = full_addr_match.group(4).strip()
                    return street, city, state, zip_code
                
                # Try to parse it normally
                zip_match = re.search(r'(\d{5}(?:-\d{4})?)', addr_text)
                if zip_match:
                    zip_code = zip_match.group(1)
                    # Try to extract city, state from same line
                    city_state_match = re.search(r'([A-Za-z\s]+),?\s+([A-Z]{2})\s+\d{5}', addr_text)
                    if city_state_match:
                        city = city_state_match.group(1).strip()
                        state = city_state_match.group(2).strip()
                        # Street is everything before city
                        street = re.sub(r'[,\s]*' + re.escape(city) + r'.*$', '', addr_text).strip()
                        return street, city, state, zip_code
            
            # Multi-line address: check next 2-3 lines
            if i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                # Next line might be street address or complete address
                if next_line and not re.search(r'(?:DOB|SEX|HGT|WGT|EYES|CLASS|EXP)', next_line, re.I):
                    # Check if it's a complete address on one line
                    full_match = re.search(r'^(.*?)\s+([A-Z][A-Za-z\s]+)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$', next_line)
                    if full_match:
                        return full_match.group(1).strip(), full_match.group(2).strip(), full_match.group(3).strip(), full_match.group(4).strip()
                    
                    # Otherwise treat as street, check next line for city/state/zip
                    street = next_line
                    # Check line after for city/state/zip
                    if i + 2 < len(lines):
                        city_line = lines[i + 2].strip()
                        zip_match = re.search(r'(\d{5}(?:-\d{4})?)', city_line)
                        if zip_match:
                            zip_code = zip_match.group(1)
                            city_state_match = re.search(r'([A-Za-z\s]+),?\s+([A-Z]{2})', city_line)
                            if city_state_match:
                                return street, city_state_match.group(1).strip(), city_state_match.group(2).strip(), zip_code

    # 1) Look for lines like "City, ST 12345" or "City, State 12345"
    city_state_zip_re = re.compile(r"(?P<city>[A-Za-z .\-']+),\s*(?P<state>[A-Za-z]{2}|[A-Za-z .'-]{3,})\s+(?P<zip>\d{5}(?:-\d{4})?)")
    city_state_zip_re2 = re.compile(r"(?P<city>[A-Za-z .\-']+)\s+(?P<state>[A-Z]{2})\s+(?P<zip>\d{5}(?:-\d{4})?)")
    
    for i, l in enumerate(lines):
        s = l.strip()
        m = city_state_zip_re.search(s) or city_state_zip_re2.search(s)
        if m:
            zip_code = m.group('zip')
            city = m.group('city').strip()
            state = m.group('state').strip()
            print(f"[PARSER_DEBUG] Found city/state/zip at line {i}: {s}")
            # try to find a street line in previous 1-3 lines (handles APT/SUITE between street and city)
            street = None
            street_lines = []
            
            # Look back up to 3 lines for street address components
            for j in range(1, min(4, i+1)):
                prev_line = lines[i-j].strip()
                print(f"[PARSER_DEBUG] Checking line {i-j} (j={j}): '{prev_line}'")
                # Skip empty lines, form labels, and common DL fields
                if not prev_line or len(prev_line) < 3:
                    print(f"[PARSER_DEBUG]   -> Skipping (empty or too short)")
                    continue
                if re.search(r'(?:DOB|SEX|HGT|WGT|EYES|CLASS|EXP|RESTR|END|Document\s+Type|Issue|Expiration)\b', prev_line, re.I):
                    print(f"[PARSER_DEBUG]   -> Breaking (DL field detected)")
                    break
                # Check if line looks like street address component
                # Starts with number, or has street keywords, or is short apt/suite line
                if (re.search(r'^\d+\s+', prev_line) or 
                    re.search(r'\b(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Dr|Drive|Ln|Lane|Way|Ct|Court|Pl|Place)\b', prev_line, re.I) or
                    re.search(r'^(?:APT|UNIT|STE|SUITE|#)[.\s#]*\d+', prev_line, re.I)):
                    print(f"[PARSER_DEBUG]   -> MATCH! Adding to street_lines")
                    street_lines.insert(0, prev_line)
                elif street_lines:
                    # If we've already found street components, stop when we hit unrelated text
                    print(f"[PARSER_DEBUG]   -> Breaking (unrelated text after finding street)")
                    break
                else:
                    print(f"[PARSER_DEBUG]   -> No match, continuing")
            
            # Combine all street components
            if street_lines:
                street = ' '.join(street_lines)
                print(f"[PARSER_DEBUG] Final street: '{street}'")
            else:
                print(f"[PARSER_DEBUG] No street found")
            
            return street, city, state, zip_code

    # 2) Check adjacent lines: street line followed by "City, ST ZIP"
    for i in range(len(lines)-1):
        current_line = lines[i].strip()
        next_line = lines[i+1].strip()
        
        # Check if current line looks like a street address
        if re.search(r'^\d+\s+[A-Za-z]', current_line):
            m = city_state_zip_re.search(next_line) or city_state_zip_re2.search(next_line)
            if m:
                street = current_line
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
