"""
Dealer routes for searching farm equipment dealers
"""

from fastapi import APIRouter, Query
from services.google_places_service import search_dealers, get_dealer_details

router = APIRouter(prefix="/dealers", tags=["dealers"])


@router.get("/search")
async def search_for_dealers(
    query: str = Query(default="farm equipment dealer", description="Search query"),
    location: str = Query(default=None, description="Location (city, state or zip code)"),
    radius: int = Query(default=50000, description="Search radius in meters")
):
    """
    Search for farm equipment dealers near a location.
    
    Examples:
    - /dealers/search?location=Des Moines, IA
    - /dealers/search?query=John Deere dealer&location=50315
    - /dealers/search?query=tractor dealer&location=New York&radius=80000
    """
    result = await search_dealers(query=query, location=location, radius=radius)
    return result


@router.get("/details/{place_id}")
async def get_dealer_info(place_id: str):
    """
    Get detailed information about a specific dealer.
    
    Args:
        place_id: Google Places ID from search results
    """
    result = await get_dealer_details(place_id)
    return result


@router.get("/nearby")
async def get_nearby_dealers(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    radius: int = Query(default=25000, description="Search radius in meters")
):
    """
    Find dealers near specific coordinates.
    
    Example: /dealers/nearby?lat=41.5868&lng=-93.6250&radius=50000
    """
    # Convert lat/lng to location string for the search
    location = f"{lat},{lng}"
    result = await search_dealers(
        query="farm equipment dealer",
        location=location,
        radius=radius
    )
    return result
