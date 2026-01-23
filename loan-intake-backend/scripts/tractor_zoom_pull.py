"""Utility script to pull Tractor Zoom auction data.

Usage:
    python scripts/tractor_zoom_pull.py [--limit 25]

On the first run it creates data/tractor_zoom/auctions.json.
Subsequent runs merge new auctions (by ID) and append only the
previously unseen ones.
"""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
from typing import Any, Dict, List

from services.tractor_zoom_service import get_recent_auctions

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "tractor_zoom"
OUTPUT_FILE = DATA_DIR / "auctions.json"


def _load_existing() -> Dict[str, Dict[str, Any]]:
    if not OUTPUT_FILE.exists():
        return {}
    try:
        with OUTPUT_FILE.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except json.JSONDecodeError:
        return {}
    auctions = payload.get("auctions") if isinstance(payload, dict) else payload
    if not isinstance(auctions, list):
        return {}
    return {str(item.get("id")): item for item in auctions if item.get("id") is not None}


def _write_file(records: List[Dict[str, Any]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with OUTPUT_FILE.open("w", encoding="utf-8") as handle:
        json.dump({"count": len(records), "auctions": records}, handle, indent=2)


async def _fetch(limit: int) -> Dict[str, Any]:
    return await get_recent_auctions(limit=limit)


async def run(limit: int) -> Dict[str, Any]:
    existing = _load_existing()
    latest = await _fetch(limit)
    combined = existing.copy()
    new_records = []
    for item in latest.get("auctions", []):
        key = str(item.get("id")) if item.get("id") is not None else None
        if key and key not in combined:
            combined[key] = item
            new_records.append(item)
    all_records = list(combined.values())
    # Keep most recent first by event date when available
    def sort_key(entry: Dict[str, Any]):
        return entry.get("event_date") or ""
    all_records.sort(key=sort_key, reverse=True)
    _write_file(all_records)
    return {
        "stored_total": len(all_records),
        "new_records": len(new_records),
        "output": str(OUTPUT_FILE.relative_to(Path.cwd())),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Pull Tractor Zoom recent auctions")
    parser.add_argument("--limit", type=int, default=25, help="How many recent auctions to fetch")
    args = parser.parse_args()
    result = asyncio.run(run(limit=args.limit))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
