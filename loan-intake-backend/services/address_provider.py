"""
Address autocomplete provider.

Uses stub suggestions by default. Can be swapped to a real provider (e.g., Mapbox/Places)
by setting ADDRESS_PROVIDER=mapbox and ADDRESS_API_KEY in environment.
"""

import os
from typing import List
import httpx

PROVIDER = os.getenv("ADDRESS_PROVIDER", "stub").lower()
API_KEY = os.getenv("ADDRESS_API_KEY")


async def autocomplete(query: str) -> List[dict]:
    if PROVIDER == "mapbox" and API_KEY:
        return await _mapbox_autocomplete(query)
    # Default stub suggestions
    return [
        {"text": f"{query} Main St, Anytown, NY 10001", "street": f"{query} Main St", "city": "Anytown", "state": "NY", "zip": "10001"},
        {"text": f"{query} Market St, Springfield, IL 62701", "street": f"{query} Market St", "city": "Springfield", "state": "IL", "zip": "62701"},
    ]


async def _mapbox_autocomplete(query: str) -> List[dict]:
    url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json"
    params = {
        "access_token": API_KEY,
        "autocomplete": "true",
        "limit": 5,
    }
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            features = data.get("features", [])
            results = []
            for f in features:
                place = f.get("place_name")
                context = {c.get("id", ""): c.get("text") for c in f.get("context", [])}
                props = f.get("properties", {})
                results.append(
                    {
                        "text": place,
                        "street": f.get("text"),
                        "city": context.get("place"),
                        "state": context.get("region"),
                        "zip": props.get("postalcode") or context.get("postcode"),
                    }
                )
            return results
    except Exception:
        return []
