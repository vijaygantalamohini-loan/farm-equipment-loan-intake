import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

LOGGER = logging.getLogger(__name__)
REPO_ROOT = Path(__file__).resolve().parents[3]
SCRAPED_DATA_PATH = REPO_ROOT / "scraper_module" / "output" / "rbauction_listings.json"


def _safe_int(value: Any) -> Optional[int]:
    if value in (None, "", "null"):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return None


def _parse_sale_date(value: Any) -> Optional[pd.Timestamp]:
    if value in (None, ""):
        return None
    for converter in (
        lambda v: pd.to_datetime(v, unit="ms", utc=True, errors="coerce"),
        lambda v: pd.to_datetime(v, utc=True, errors="coerce"),
    ):
        result = converter(value)
        if pd.notna(result):
            try:
                return result.tz_convert(None)
            except AttributeError:
                return result
    return None


def _load_scraped_rows(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        LOGGER.warning("Ritchie Bros scraped data not found at %s", path)
        return []

    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        LOGGER.warning("Failed to parse Ritchie Bros scraped JSON: %s", exc)
        return []

    if not isinstance(raw, list):
        LOGGER.warning("Unexpected Ritchie Bros data format: expected list, got %s", type(raw))
        return []

    return raw


def _normalise_record(record: Dict[str, Any], timestamp: datetime) -> Dict[str, Any]:
    sale_date = _parse_sale_date(record.get("sale_date"))

    return {
        "make": record.get("make") or None,
        "model": record.get("model") or None,
        "year": _safe_int(record.get("year")),
        "hours": record.get("hours"),
        "price": record.get("price"),
        "location": record.get("location") or None,
        "condition": record.get("condition"),
        "serial_number": record.get("serial_number") or None,
        "source": "RitchieBros",
        "timestamp": timestamp,
        "listing_id": record.get("listing_id"),
        "title": record.get("title"),
        "asset_type": record.get("asset_type"),
        "auction": record.get("auction"),
        "sale_date": sale_date,
        "buying_format": record.get("buying_format"),
        "image_url": record.get("image_url"),
        "source_url": record.get("source_url"),
    }


def scrape_ritchie_bros() -> pd.DataFrame:
    rows = _load_scraped_rows(SCRAPED_DATA_PATH)
    if not rows:
        return pd.DataFrame(
            columns=[
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
                "asset_type",
                "auction",
                "sale_date",
                "buying_format",
                "image_url",
                "source_url",
            ]
        )

    timestamp = datetime.utcnow()
    normalised = [_normalise_record(record, timestamp) for record in rows]
    df = pd.DataFrame(normalised)

    if "sale_date" in df.columns:
        df["sale_date"] = pd.to_datetime(df["sale_date"], errors="coerce")

    return df
