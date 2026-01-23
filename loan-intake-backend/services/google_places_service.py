"""
Google Places API Service

Search for farm equipment dealers using Google Places API.
"""

import httpx
import os
from typing import List, Dict, Optional


async def search_dealers(
    query: str = "farm equipment dealer",
    location: Optional[str] = None,
    radius: int = 50000  # 50km default radius
) -> List[Dict]:
    """
    Search for farm equipment dealers using Google Places API.
    
    Args:
        query: Search query (default: "farm equipment dealer")
        location: Location string (e.g., "New York, NY") or None for general search
        radius: Search radius in meters (default: 50km)
        
    Returns:
        List of dealer dictionaries with name, address, phone, etc.
    """
    api_key = os.getenv("GOOGLE_PLACES_API_KEY")
    
    if not api_key:
        return {
            "error": "Google Places API key not configured",
            "message": "Please set GOOGLE_PLACES_API_KEY environment variable",
            "dealers": []
        }
    
    try:
        # If location is provided, geocode it first
        lat, lng = None, None
        if location:
            geocode_url = f"https://maps.googleapis.com/maps/api/geocode/json"
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(geocode_url, params={
                    "address": location,
                    "key": api_key
                })
                geo_data = response.json()
                if geo_data.get("results"):
                    loc = geo_data["results"][0]["geometry"]["location"]
                    lat, lng = loc["lat"], loc["lng"]
        
        # Search for dealers using Text Search API
        search_url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
        params = {
            "query": query,
            "key": api_key,
            "type": "store"
        }
        
        # Add location if available
        if lat and lng:
            params["location"] = f"{lat},{lng}"
            params["radius"] = radius
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(search_url, params=params)
            data = response.json()
            
            if data.get("status") != "OK":
                return {
                    "error": data.get("status"),
                    "message": data.get("error_message", "Search failed"),
                    "dealers": []
                }
            
            # Parse results
            dealers = []
            for place in data.get("results", [])[:20]:  # Limit to 20 results
                dealer = {
                    "name": place.get("name"),
                    "address": place.get("formatted_address"),
                    "placeId": place.get("place_id"),
                    "rating": place.get("rating"),
                    "userRatingsTotal": place.get("user_ratings_total"),
                    "types": place.get("types", []),
                    "location": place.get("geometry", {}).get("location"),
                    "businessStatus": place.get("business_status")
                }
                
                # Filter out permanently closed businesses
                if dealer.get("businessStatus") != "CLOSED_PERMANENTLY":
                    dealers.append(dealer)
            
            return {
                "success": True,
                "count": len(dealers),
                "dealers": dealers,
                "query": query,
                "location": location
            }
            
    except Exception as e:
        print(f"Google Places API error: {e}")
        return {
            "error": "API Error",
            "message": str(e),
            "dealers": []
        }


async def get_dealer_details(place_id: str) -> Dict:
    """
    Get detailed information about a specific dealer.
    
    Args:
        place_id: Google Places ID
        
    Returns:
        Dictionary with detailed dealer information
    """
    api_key = os.getenv("GOOGLE_PLACES_API_KEY")
    
    if not api_key:
        return {
            "error": "Google Places API key not configured"
        }
    
    try:
        details_url = "https://maps.googleapis.com/maps/api/place/details/json"
        params = {
            "place_id": place_id,
            "key": api_key,
            "fields": "name,formatted_address,formatted_phone_number,website,opening_hours,rating,reviews,geometry"
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(details_url, params=params)
            data = response.json()
            
            if data.get("status") != "OK":
                return {
                    "error": data.get("status"),
                    "message": data.get("error_message", "Failed to get details")
                }
            
            result = data.get("result", {})
            return {
                "success": True,
                "name": result.get("name"),
                "address": result.get("formatted_address"),
                "phone": result.get("formatted_phone_number"),
                "website": result.get("website"),
                "rating": result.get("rating"),
                "openingHours": result.get("opening_hours"),
                "location": result.get("geometry", {}).get("location"),
                "reviews": result.get("reviews", [])[:5]  # Top 5 reviews
            }
            
    except Exception as e:
        print(f"Google Places Details API error: {e}")
        return {
            "error": "API Error",
            "message": str(e)
        }
