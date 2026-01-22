"""
Address validation routes
"""

from fastapi import APIRouter, HTTPException, Query
from services.usps_service import validate_address, lookup_zip_code
from services.address_provider import autocomplete as address_autocomplete
from typing import List

router = APIRouter(prefix="/address", tags=["address"])


@router.post("/validate")
async def validate_address_endpoint(address: dict):
    """
    Validate and standardize a mailing address using USPS API.
    
    Request body:
    {
        "street": "123 Main St",
        "city": "New York",
        "state": "NY",
        "zip": "10001"
    }
    """
    street = address.get("street", "")
    city = address.get("city", "")
    state = address.get("state", "")
    zip_code = address.get("zip", "")
    
    if not all([street, city, state]):
        raise HTTPException(status_code=400, detail="Street, city, and state are required")
    
    result = await validate_address(street, city, state, zip_code)
    return result


@router.get("/lookup-zip")
async def lookup_zip_endpoint(city: str, state: str):
    """
    Look up ZIP code for a city and state.
    
    Query parameters:
    - city: City name
    - state: Two-letter state abbreviation
    """
    if not city or not state:
        raise HTTPException(status_code=400, detail="City and state are required")
    
    result = await lookup_zip_code(city, state)
    return result


@router.get("/autocomplete")
async def autocomplete_address(q: str = Query(..., description="Partial address or zip")) -> List[dict]:
    """
    Address autocomplete. Uses stub by default; can be backed by a provider via env.
    """
    return await address_autocomplete(q)
