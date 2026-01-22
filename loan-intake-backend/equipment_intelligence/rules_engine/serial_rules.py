import re

PREFIXES = {
    "1LV": "John Deere",
    "1L0": "John Deere",
    "1RW": "John Deere",
    "ZCAT": "Case IH",
    "CAT": "Caterpillar",
    "YTN": "New Holland",
    "CLAAS": "Claas",
    "KBU": "Kubota",
    "KBUL": "Kubota",
    "AG3": "AGCO",
    "AGC": "AGCO",
}

SERIES_SUFFIX_MAP = {
    "RX": "RX",
    "RT": "RT",
    "R": "R",
    "M": "M",
    "E": "E",
}

JD_YEAR_CODES = {
    "A": 2010,
    "B": 2011,
    "C": 2012,
    "D": 2013,
    "E": 2014,
    "F": 2015,
    "G": 2016,
    "H": 2017,
    "J": 2018,
    "K": 2019,
    "L": 2020,
    "M": 2021,
    "N": 2022,
    "P": 2023,
    "R": 2024,
    "S": 2025,
    "T": 2026,
    "U": 2027,
    "V": 2028,
    "W": 2029,
    "X": 2030,
    "Y": 2031,
}


def _normalize_serial(serial: str | None) -> str | None:
    if not serial:
        return None
    return serial.strip().upper()


def detect_manufacturer_prefix(serial):
    normalized = _normalize_serial(serial)
    if not normalized:
        return None
    for prefix, brand in PREFIXES.items():
        if normalized.startswith(prefix):
            return brand
    return "Unknown"


def _decode_john_deere_model(serial: str) -> tuple[str | None, dict[str, int | str] | None]:
    match = re.search(r"(?P<series>[4-9])(?P<model>\d{3})", serial)
    if not match:
        return None, None

    series_digit = int(match.group("series"))
    model_digits = match.group("model")
    model_end = match.end()
    trailing = serial[model_end:model_end + 4]

    suffix = None
    for candidate in ("RX", "RT", "R", "M", "E"):
        if candidate in trailing:
            suffix = SERIES_SUFFIX_MAP.get(candidate, candidate)
            break

    horsepower = int(model_digits) if model_digits.isdigit() else None

    if suffix:
        model_name = f"{series_digit}{suffix} {model_digits}"
    else:
        model_name = f"{series_digit}{model_digits}"

    info: dict[str, int | str] = {"series": series_digit}
    if horsepower:
        info["approx_hp"] = horsepower
    if suffix:
        info["suffix"] = suffix

    return model_name, info


def decode_year(serial):
    normalized = _normalize_serial(serial)
    if not normalized:
        return None

    manufacturer = detect_manufacturer_prefix(normalized)
    if manufacturer == "John Deere" and len(normalized) >= 10:
        year_code = JD_YEAR_CODES.get(normalized[9])
        if year_code:
            return year_code

    match = re.search(r"(\d{2})$", normalized)
    if match:
        year_code = int(match.group(1))
        if year_code > 80:
            return 1900 + year_code
        return 2000 + year_code
    return None


def decode_model(serial):
    normalized = _normalize_serial(serial)
    if not normalized:
        return None
    manufacturer = detect_manufacturer_prefix(normalized)
    if manufacturer == "John Deere":
        model, extras = _decode_john_deere_model(normalized)
        if model:
            return {
                "model": model,
                "series": extras.get("series") if extras else None,
                "approx_hp": extras.get("approx_hp") if extras else None,
            }
    return None


def validate_serial_pattern(serial):
    normalized = _normalize_serial(serial)
    if not normalized:
        return False
    return bool(re.match(r"^[A-Z0-9]{8,20}$", normalized))


def serial_confidence(serial):
    normalized = _normalize_serial(serial)
    score = 0.0
    if normalized:
        score += 0.4
    manufacturer = detect_manufacturer_prefix(normalized)
    if manufacturer and manufacturer != "Unknown":
        score += 0.25
    if validate_serial_pattern(normalized):
        score += 0.2
    model_data = decode_model(normalized)
    if model_data:
        score += 0.15
    return min(score, 1.0)
