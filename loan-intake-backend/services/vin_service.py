"""
NHTSA VIN Lookup Service

Provides vehicle identification number (VIN) lookup using the free NHTSA API.
Extracts make, model, year, and vehicle type information.
Also includes fallback VIN decoding for basic year extraction.
"""

import httpx


def decode_vin_year(vin: str) -> str:
    """
    Decode model year from VIN (10th character).
    Works even when NHTSA API fails.
    
    Args:
        vin: 17-character VIN
        
    Returns:
        Year as string, or None if can't decode
    """
    if len(vin) != 17:
        return None
    
    # 10th character is model year code
    year_char = vin[9].upper()
    
    # Year codes for VINs (30-year cycle)
    # Current cycle: 2010-2039
    year_codes = {
        'A': 2010, 'B': 2011, 'C': 2012, 'D': 2013, 'E': 2014, 'F': 2015, 'G': 2016,
        'H': 2017, 'J': 2018, 'K': 2019, 'L': 2020, 'M': 2021, 'N': 2022, 'P': 2023,
        'R': 2024, 'S': 2025, 'T': 2026, 'U': 2027, 'V': 2028, 'W': 2029, 'X': 2030,
        'Y': 2031, '1': 2001, '2': 2002, '3': 2003, '4': 2004, '5': 2005, '6': 2006,
        '7': 2007, '8': 2008, '9': 2009,
    }
    
    year = year_codes.get(year_char)
    return str(year) if year else None


def decode_wmi(vin: str) -> dict:
    """
    Decode World Manufacturer Identifier (first 3 characters).
    Returns manufacturer info based on common WMI codes.
    
    Args:
        vin: 17-character VIN
        
    Returns:
        Dictionary with manufacturer info
    """
    if len(vin) < 3:
        return {}
    
    wmi = vin[:3].upper()
    
    # Common WMI codes for farm equipment and vehicles
    wmi_database = {
        # John Deere (equipment WMIs)
        '1JD': 'John Deere',
        '1DJ': 'John Deere',
        # Case IH
        '4JJ': 'Case IH',
        'JJC': 'Case IH',
        # New Holland
        '4JN': 'New Holland',
        'YNH': 'New Holland',
        # Kubota
        '5KC': 'Kubota',
        'JKB': 'Kubota',
        'AG3': 'AGCO',
        'AGC': 'AGCO',
        # AGCO
        '4JA': 'AGCO',
        'YA5': 'AGCO',
        # Common vehicle manufacturers (cars/light trucks)
        '4T1': 'Toyota',
        '5YJ': 'Tesla',
        '1G1': 'Chevrolet',
        '1FT': 'Ford Trucks',
        '1FA': 'Ford',
        '1HD': 'Harley-Davidson',
        '1HG': 'Honda',
        '2HG': 'Honda',
        '3VW': 'Volkswagen',
        'WAU': 'Audi',
        'WBA': 'BMW',
        'JHM': 'Honda',
        'JTD': 'Toyota',
        'KBU': 'Kubota',
    }
    
    manufacturer = wmi_database.get(wmi)
    if manufacturer:
        return {"make": manufacturer, "manufacturer": manufacturer}
    
    # If not in database, try to identify by first character (country code)
    return {}


async def lookup_vin(vin: str) -> dict:
    """
    Look up vehicle VIN using free NHTSA API with fallback decoding.
    
    Args:
        vin: Vehicle Identification Number (17 characters)
        
    Returns:
        Dictionary with vehicle information:
        - found: bool
        - source: str
        - note: str
        - make: str
        - model: str
        - year: str
        - vehicleType: str (if available)
        Returns None if lookup fails
    """
    
    # First, try to decode basic info from VIN structure
    fallback_info = {}
    if len(vin) == 17:
        year = decode_vin_year(vin)
        if year:
            fallback_info["year"] = year
        
        wmi_info = decode_wmi(vin)
        if wmi_info:
            fallback_info.update(wmi_info)
    
    # Try NHTSA API
    try:
        url = f"https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/{vin}?format=json"
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            if response.status_code == 200:
                data = response.json()
                results = data.get("Results", [])
                
                # Extract relevant fields
                info = {}
                error_text = None
                for item in results:
                    var_name = item.get("Variable")
                    value = item.get("Value")
                    
                    # Track error messages
                    if var_name == "Error Text":
                        error_text = value
                    
                    # Filter out empty/invalid values
                    if value and value not in ["Not Applicable", "None", ""]:
                        if var_name == "Make":
                            info["make"] = value
                        elif var_name == "Model":
                            info["model"] = value
                        elif var_name == "Model Year":
                            info["year"] = value
                        elif var_name == "Vehicle Type":
                            info["vehicleType"] = value
                
                if info.get("make"):
                    # NHTSA returned good data
                    note = "Vehicle VIN decoded"
                    if error_text and "No detailed data" in error_text:
                        note += " (limited data available)"
                    return {"found": True, "source": "NHTSA VIN", "note": note, **info}
                
                # NHTSA failed, but we have fallback data
                if fallback_info:
                    note = "VIN decoded from structure (NHTSA couldn't verify)"
                    if error_text:
                        note += f" - {error_text.split(';')[0]}"
                    return {"found": True, "source": "VIN structure", "note": note, **fallback_info}
                    
    except Exception as e:
        print(f"NHTSA VIN lookup error: {e}")
        
        # Return fallback data if NHTSA failed
        if fallback_info:
            return {"found": True, "source": "VIN structure", 
                   "note": "NHTSA unavailable, decoded from VIN structure", **fallback_info}
    
    return None
