"""
Serial Number Decoder Service

Focused on the top farm equipment manufacturers (per 2025 NA market share reports):
- John Deere
- Case IH
- New Holland
- Kubota
- Massey Ferguson (AGCO)

Additional coverage is included for AGCO/Fendt variants, Claas equipment, and Versatile machines.

Each manufacturer uses tailored decoding logic tuned to common serial layouts.
"""

import re
from datetime import datetime


TOP_MANUFACTURERS = (
    "John Deere",
    "Case IH",
    "New Holland",
    "Kubota",
    "Massey Ferguson",
)


def decode_john_deere_serial(serial: str) -> dict:
    """
    Decode John Deere serial number to extract year and model info.
    
    Modern 17-character format examples:
    - 1M08345PXXY789012 (M-series)
    - 1LV3032ECRS153871 (Compact tractor)
    - 1PY5100MLMB000854 (Combine)
    
    Format: 1XX####YZZZ######
    - 1XX = Prefix (1M0, 1LV, 1PY, etc.)
    - #### = Model (3032, 5100, 8345, etc.)
    - Y = Year code at position 7
    - ZZZ = Plant/month code
    - ###### = Sequence
    
    Older format: Position 9 or 10 may have year code
    
    Year codes: A=2010, B=2011, C=2012, D=2013, E=2014, F=2015, G=2016,
    H=2017, J=2018, K=2019, L=2020, M=2021, N=2022, P=2023, R=2024,
    S=2025, T=2026 (I, O, Q skipped)
    
    Args:
        serial: John Deere serial number
        
    Returns:
        Dictionary with year and model
    """
    normalized = serial.strip().upper() if serial else ""

    year_codes = {
        'A': '2010', 'B': '2011', 'C': '2012', 'D': '2013', 'E': '2014', 'F': '2015', 'G': '2016',
        'H': '2017', 'J': '2018', 'K': '2019', 'L': '2020', 'M': '2021', 'N': '2022', 'P': '2023',
        'R': '2024', 'S': '2025', 'T': '2026', 'U': '2027', 'V': '2028', 'W': '2029', 'X': '2030',
        'Y': '2031', '0': '2000', '1': '2001', '2': '2002', '3': '2003', '4': '2004', '5': '2005',
        '6': '2006', '7': '2007', '8': '2008', '9': '2009'
    }
    
    year = None
    model = None
    
    # Modern 17-character format: 1XX####Y...
    if len(normalized) == 17 and normalized[0] == '1' and normalized[1:3].isalpha():
        # Extract 4-digit model (positions 3-6)
        model_part = normalized[3:7]
        if model_part.isdigit():
            model = model_part

            trailing = normalized[7:12]
            for candidate in ("RX", "RT", "R", "M", "E"):
                if candidate in trailing:
                    model = f"{model_part[0]}{candidate} {model_part[1:]}"
                    break

        # Model year code typically lives at position 10 (VIN-style) on modern equipment
        if len(normalized) >= 10:
            year_char = normalized[9]
            year = year_codes.get(year_char)

        # Some legacy 17-character numbers embed the year at position 8
        if not year and len(normalized) >= 8:
            year_char = normalized[7]
            year = year_codes.get(year_char)

    # Fallbacks for non-17-character serials or legacy equipment
    if not year:
        if len(normalized) >= 10:
            year_char = normalized[9]
            year = year_codes.get(year_char)

    if not year and len(normalized) >= 8:
        year_char = normalized[7]
        year = year_codes.get(year_char)
    
    # Try to extract model from serial if not found
    if not model:
        model_match = re.search(r'[0-9]{4}', normalized[:10])
        model = model_match.group(0) if model_match else None
    
    return {"year": year, "model": model, "brand": "John Deere"}


def decode_case_ih_serial(serial: str) -> dict:
    """
    Decode Case IH serial number.
    
    Format: JJC prefix + digits often encode year in position 4-5
    Example: JJC0316262 - positions 3-4 are '03' = 2003
    
    Args:
        serial: Case IH serial number
        
    Returns:
        Dictionary with year and model
    """
    normalized = serial.strip().upper() if serial else ""
    year = None
    model = None

    if len(normalized) >= 5 and normalized.startswith(("JJC", "JJA", "JDB", "CBJ", "HAJ")):
        try:
            year_digits = normalized[3:5]
            if year_digits.isdigit():
                year_num = int(year_digits)
                year = str(1900 + year_num) if year_num >= 90 else str(2000 + year_num)

                current_year = datetime.now().year
                if int(year) > current_year + 1:
                    year = str(int(year) - 100)
        except Exception:
            year = None

        # Provide a simple model hint (e.g., "Series 316" -> 316 from sequence)
        sequence = normalized[3:]
        model_match = re.search(r"(\d{3,4})", sequence)
        if model_match:
            digits = model_match.group(1).lstrip("0") or model_match.group(1)
            model = f"Series {digits}"

    return {"year": year, "model": model, "brand": "Case IH"}


def decode_new_holland_serial(serial: str) -> dict:
    """
    Decode New Holland serial number.
    
    Formats:
    - NH prefix + numbers
    - ZBJF/ZBJE + year code + numbers
    - Z + 10+ characters with embedded year
    
    Args:
        serial: New Holland serial number
        
    Returns:
        Dictionary with year and model
    """
    normalized = serial.strip().upper() if serial else ""
    year = None
    model = None

    if normalized.startswith(("ZBJF", "ZBJE")) and len(normalized) >= 5:
        try:
            year_char = normalized[4]
            if year_char.isalpha():
                year_codes = {
                    'A': '2010', 'B': '2011', 'C': '2012', 'D': '2013', 'E': '2014', 'F': '2015', 'G': '2016',
                    'H': '2017', 'J': '2018', 'K': '2019', 'L': '2020', 'M': '2021', 'N': '2022', 'P': '2023',
                    'R': '2024', 'S': '2025', 'T': '2026'
                }
                year = year_codes.get(year_char)
            elif year_char.isdigit():
                # Digit 0-9 might be 2010-2019
                year = str(2010 + int(year_char))
        except:
            pass

    elif normalized.startswith("NH") and len(normalized) >= 8:
        try:
            for i in range(2, min(6, len(normalized) - 1)):
                year_digits = normalized[i:i + 2]
                if year_digits.isdigit():
                    year_num = int(year_digits)
                    if 90 <= year_num <= 99:
                        year = str(1900 + year_num)
                        break
                    elif 0 <= year_num <= 30:
                        year = str(2000 + year_num)
                        break
        except:
            pass

    # Model hints from prefix + digits (e.g., ZBJFH123 -> ZBJFH123)
    model_match = re.match(r"^(ZBJF|ZBJE|NH)([A-Z0-9]{3,6})", normalized)
    if model_match:
        prefix, body = model_match.groups()
        digits = re.search(r"\d{3,4}", body)
        if digits:
            model = f"{prefix} {digits.group(0)}"
        else:
            model = f"{prefix} {body}"

    return {"year": year, "model": model, "brand": "New Holland"}


def decode_kubota_serial(serial: str) -> dict:
    """
    Decode Kubota serial number.
    
    Format: Usually starts with model code (letters) + numbers
    Example: L4330-12345 or B2650-98765
    Year often encoded in first digits after model code
    
    Args:
        serial: Kubota serial number
        
    Returns:
        Dictionary with year and model
    """
    normalized = serial.strip().upper() if serial else ""
    year = None
    model = None

    if normalized:
        model = normalized.split("-", 1)[0]
        clean_serial = normalized.replace("-", "")
        model_match = re.match(r'^([A-Z]+\d{3,4})', clean_serial)
        if model_match:
            model = model_match.group(1)

        if len(clean_serial) >= 6:
            try:
                for i in range(0, min(8, len(clean_serial) - 1)):
                    year_digits = clean_serial[i:i + 2]
                    if year_digits.isdigit():
                        year_num = int(year_digits)
                        if 75 <= year_num <= 99:
                            year = str(1900 + year_num)
                            break
                        if 0 <= year_num <= 30:
                            candidate = 2000 + year_num
                            current_year = datetime.now().year
                            if candidate <= current_year + 1:
                                year = str(candidate)
                                break
            except Exception:
                year = None

    return {"year": year, "model": model, "brand": "Kubota"}


def decode_massey_ferguson_serial(serial: str) -> dict:
    """
    Decode Massey Ferguson serial number.
    
    Format: MF prefix or model code + serial
    Example: MF7720-12345 or MFGC2300-98765
    
    Args:
        serial: Massey Ferguson serial number
        
    Returns:
        Dictionary with year and model
    """
    normalized = serial.strip().upper() if serial else ""
    year = None
    model = None

    if normalized.startswith("MF"):
        model_match = re.match(r'^MF([A-Z]*\d{3,4})', normalized)
        if model_match:
            model = model_match.group(1)

    year_match = re.search(r'(20\d{2})', normalized)
    if year_match:
        year = year_match.group(1)
    else:
        trailing_digits = re.search(r'(\d{2})(?!.*\d)', normalized)
        if trailing_digits:
            year_candidate = int(trailing_digits.group(1))
            if 80 <= year_candidate <= 99:
                year = str(1900 + year_candidate)
            elif 0 <= year_candidate <= 30:
                year = str(2000 + year_candidate)

    return {"year": year, "model": model, "brand": "Massey Ferguson"}


def decode_agco_fendt_serial(serial: str) -> dict:
    """
    Decode AGCO/Fendt serial number.
    
    Formats:
    - Fendt: WF (Farmer) or TF (Favorit) prefix
    - AGCO modern: AGCMD530VPB047074
      AGC = AGCO prefix
      MD530 = Model (e.g., Massey Ferguson GC1705 or similar)
      V = Year code
      PB = Plant code
      047074 = Sequence
    
    Args:
        serial: AGCO/Fendt serial number
        
    Returns:
        Dictionary with year and model
    """
    year = None
    model = None
    brand = "AGCO/Fendt"
    serial_upper = serial.strip().upper() if serial else ""
    serial_clean = serial_upper.replace("-", "")
    
    # Modern AGCO format: AGC + model + year code
    if serial_upper.startswith("AGC") and len(serial_upper) >= 10:
        brand = "AGCO"
        # Extract model (after AGC, before year code)
        model_part = serial_upper[3:8].rstrip('ABCDEFGHIJKLMNOPQRSTUVWXYZ')
        if model_part:
            model = model_part
        
        if len(serial_upper) >= 9:
            year_char = serial_upper[8]
            year_codes = {
                'A': '2010', 'B': '2011', 'C': '2012', 'D': '2013', 'E': '2014',
                'F': '2015', 'G': '2016', 'H': '2017', 'J': '2018', 'K': '2019',
                'L': '2020', 'M': '2021', 'N': '2022', 'P': '2023', 'R': '2024',
                'S': '2025', 'T': '2026', 'U': '2027', 'V': '2028', 'W': '2029'
            }
            year = year_codes.get(year_char)
    
    # Fallback: Try to extract year from various positions
    if not year and len(serial_upper) >= 6:
        try:
            # Look for 2-digit or 4-digit year
            # Check for 4-digit year first
            year_match = re.search(r'(20\d{2})', serial_upper)
            if year_match:
                year = year_match.group(1)
            else:
                # Look for 2-digit year
                for i in range(0, min(10, len(serial_upper) - 1)):
                    year_digits = serial_upper[i:i + 2]
                    if year_digits.isdigit():
                        year_num = int(year_digits)
                        if 90 <= year_num <= 99:
                            year = str(1900 + year_num)
                            break
                        elif 0 <= year_num <= 30:
                            year = str(2000 + year_num)
                            break
        except Exception:
            year = None

    if serial_upper.startswith(("WF", "TF")):
        brand = "Fendt"

    if not model and serial_clean:
        fallback_model = serial_clean[:6]
        model = fallback_model

    return {"year": year, "model": model, "brand": brand}


def decode_claas_serial(serial: str) -> dict:
    """Decode Claas serial numbers (combine, forage harvester, etc.)."""

    normalized = serial.strip().upper() if serial else ""
    year = None
    model = None

    if not normalized:
        return {"year": year, "model": model, "brand": "Claas"}

    year_match = re.search(r'(20\d{2})', normalized)
    if year_match:
        year = year_match.group(1)
    else:
        trailing_digits = re.search(r'(\d{2})(?!.*\d)', normalized)
        if trailing_digits:
            year_candidate = int(trailing_digits.group(1))
            if 80 <= year_candidate <= 99:
                year = str(1900 + year_candidate)
            elif 0 <= year_candidate <= 35:
                year = str(2000 + year_candidate)

    prefix_match = re.match(r'CLAAS[-_]?([A-Z0-9]+)', normalized)
    if prefix_match:
        code = prefix_match.group(1)
        digits_match = re.search(r'(\d{3,4})', code)
        if digits_match:
            digits = digits_match.group(1)
            label_prefix = code[:digits_match.start()].strip("-")
            if label_prefix:
                model = f"{label_prefix.title()} {digits}"
            else:
                model = f"Series {digits}"
        else:
            model = code

    return {"year": year, "model": model, "brand": "Claas"}


def decode_versatile_serial(serial: str) -> dict:
    """
    Decode Versatile tractor serial number.
    
    Format: 1LV + model + year code + plant + sequence
    Example: 1LV3032ECRS153871
      1LV = Versatile prefix
      3032E = Model (e.g., 303 2WD or 4WD)
      C = Year code
      RS = Plant/production code
      153871 = Sequence number
    
    Args:
        serial: Versatile serial number
        
    Returns:
        Dictionary with year and model
    """
    year = None
    model = None
    
    if len(serial) >= 9:
        # Extract model (characters 3-7, e.g., "3032E")
        model_part = serial[3:8] if len(serial) >= 8 else serial[3:7]
        model = f"Versatile {model_part.rstrip('ABCDEFGHIJKLMNOPQRSTUVWXYZ')}"
        
        # Year code is typically after the model
        if len(serial) >= 9:
            year_char = serial[8].upper()
            # Versatile year codes (similar to VIN codes)
            year_codes = {
                'A': '2010', 'B': '2011', 'C': '2012', 'D': '2013', 'E': '2014',
                'F': '2015', 'G': '2016', 'H': '2017', 'J': '2018', 'K': '2019',
                'L': '2020', 'M': '2021', 'N': '2022', 'P': '2023', 'R': '2024',
                'S': '2025', 'T': '2026'
            }
            year = year_codes.get(year_char)
    
    return {"year": year, "model": model, "brand": "Versatile"}


MANUFACTURER_DECODERS = {
    "John Deere": decode_john_deere_serial,
    "Case IH": decode_case_ih_serial,
    "New Holland": decode_new_holland_serial,
    "Kubota": decode_kubota_serial,
    "Massey Ferguson": decode_massey_ferguson_serial,
    "AGCO/Fendt": decode_agco_fendt_serial,
    "Claas": decode_claas_serial,
    "Versatile": decode_versatile_serial,
}


def identify_manufacturer_by_pattern(serial: str) -> str:
    """
    Identify manufacturer based on serial number pattern.
    
    Args:
        serial: Equipment serial number
        
    Returns:
        Manufacturer name or None
    """
    serial_upper = serial.strip().upper() if serial else ""
    
    # Check for farm equipment patterns first (even if 17 chars)
    # John Deere modern format: specific prefixes like 1LV, 1PY, 1RW, 1M0, 1L0, 1P0
    jd_prefixes = ("1LV", "1PY", "1RW", "1M0", "1L0", "1P0")
    if len(serial_upper) == 17:
        if serial_upper.startswith(jd_prefixes):
            # Likely John Deere equipment (not a vehicle VIN)
            return "John Deere"
        # Otherwise treat as vehicle VIN and defer to VIN decoder
        return None
    
    # Priority order to avoid conflicts (e.g., Massey Ferguson before Kubota)
    if serial_upper.startswith("MF"):
        return "Massey Ferguson"
    if serial_upper.startswith("CLAAS"):
        return "Claas"
    elif serial_upper.startswith(("JJC", "JJA", "JDB", "CBJ", "HAJ")):
        return "Case IH"
    elif serial_upper.startswith(("ZBJF", "ZBJE", "NH")):
        return "New Holland"
    elif re.match(r'^[A-Z]+\d{3,4}', serial_upper) and not serial_upper.startswith("MF"):
        # Model-number pattern (but not MF which we already checked)
        return "Kubota"
    elif serial_upper.startswith(("WF", "TF", "AGCO", "AGC")):
        return "AGCO/Fendt"
    elif len(serial) >= 10 and re.match(r'^\w+\d{4}\w{2,}', serial_upper):
        # Common John Deere pattern: letters+4digits+letters
        # This is kept last as it's a broad pattern
        return "John Deere"
    
    return None


def decode_serial_number(serial: str) -> dict:
    """
    Decode serial number using appropriate decoder based on pattern.
    
    Args:
        serial: Equipment serial number
        
    Returns:
        Dictionary with manufacturer, year, and model information
    """
    # Identify manufacturer
    manufacturer = identify_manufacturer_by_pattern(serial)
    
    result = {"year": None, "model": None, "brand": None}

    decoder = MANUFACTURER_DECODERS.get(manufacturer)
    if decoder:
        try:
            decoded = decoder(serial) or {}
        except Exception as exc:  # pragma: no cover - defensive guard
            decoded = {"error": str(exc)}
        result.update(decoded)

    result["manufacturer"] = manufacturer
    if result.get("brand") is None and manufacturer:
        result["brand"] = manufacturer
    return result
