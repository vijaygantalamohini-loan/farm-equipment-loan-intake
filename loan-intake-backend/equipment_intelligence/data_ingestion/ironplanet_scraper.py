import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

LOGGER = logging.getLogger(__name__)
REPO_ROOT = Path(__file__).resolve().parents[3]
SCRAPED_DATA_PATH = REPO_ROOT / "scraper_module" / "output" / "ironplanet_listings.json"

COLUMNS = [
    "make",
    "model",
    "year",
    "hours",
    "price",
    "location",
    "condition",
    "serial_number",
    "source",
    "timestamp",
    "listing_id",
    "title",
    "auction_type",
    "buy_now",
    "buy_now_text",
    "features",
    "image_url",
    "source_url",
]


def _safe_float(value: Any) -> Optional[float]:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _safe_int(value: Any) -> Optional[int]:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return None


def _load_raw(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        LOGGER.warning("IronPlanet scraped data not found at %s", path)
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        LOGGER.warning("Failed to parse IronPlanet scraped JSON: %s", exc)
        return []
    if not isinstance(data, list):
        LOGGER.warning("Unexpected IronPlanet data format: %s", type(data))
        return []
    return data


def _normalise_record(record: Dict[str, Any], timestamp: datetime) -> Dict[str, Any]:
    return {
        "make": record.get("make") or None,
        "model": record.get("model") or None,
        "year": _safe_int(record.get("year")),
        "hours": _safe_float(record.get("hours")),
        "price": _safe_float(record.get("price")),
        "location": record.get("location") or None,
        "condition": None,
        "serial_number": record.get("serial_number") or None,
        "source": "IronPlanet",
        "timestamp": timestamp,
        "listing_id": record.get("listing_id"),
        "title": record.get("title"),
        "auction_type": record.get("auction_type"),
        "buy_now": record.get("buy_now"),
        "buy_now_text": record.get("buy_now_text"),
        "features": record.get("features"),
        "image_url": record.get("image_url"),
        "source_url": record.get("source_url"),
    }


def scrape_ironplanet() -> pd.DataFrame:
    raw = _load_raw(SCRAPED_DATA_PATH)
    if not raw:
        return pd.DataFrame(columns=COLUMNS)

    timestamp = datetime.utcnow()
    normalised = [_normalise_record(record, timestamp) for record in raw]
    df = pd.DataFrame(normalised)
    return df
