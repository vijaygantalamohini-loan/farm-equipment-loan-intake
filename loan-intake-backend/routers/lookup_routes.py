"""
Lookup routes for serial numbers, NAICS codes, manufacturers, and VIN
"""

from fastapi import APIRouter
from services.serial_decoder import decode_serial_number
from services.naics_service import lookup_naics_code
from services.vin_service import lookup_vin
from services.manufacturer import load_manufacturers

router = APIRouter(prefix="/lookup", tags=["lookup"])

# Mock equipment database
equipment_db = {
    "JD1234567890": {
        "make": "John Deere",
        "model": "5075E",
        "year": "2020",
        "type": "Tractor"
    }
}


@router.get("/serial/{serial_number}")
async def lookup_serial(serial_number: str):
    """
    Look up equipment by serial number or VIN.
    
    Attempts multiple strategies prioritizing farm equipment:
    1. Check mock database for known serials
    2. Decode serial using manufacturer-specific decoders (farm equipment focus)
    3. Try NHTSA VIN lookup (for vehicles/trailers)
    
    Note: VINs and serial numbers are used interchangeably in this system.
    """
    # Strategy 1: Check mock database
    if serial_number in equipment_db:
        return {
            "found": True,
            "source": "database",
            **equipment_db[serial_number],
            "serialNumber": serial_number
        }

    # Strategy 2: Prefer farm equipment decoding even for 17-character identifiers.
    # This avoids misclassifying equipment serials (e.g., John Deere 1L0...) as generic VINs.
    decoded_info = decode_serial_number(serial_number)
    
    if decoded_info.get("manufacturer"):
        make = decoded_info["manufacturer"]
        manufacturer = decoded_info["manufacturer"]
        model = decoded_info.get("model")
        year = decoded_info.get("year")
        confidence = decoded_info.get("confidence")
        
        return {
            "found": True,
            "source": "serial_decoder",
            "equipmentType": "Agricultural Equipment",
            "make": make,
            "manufacturer": manufacturer,
            "model": model,
            "year": year,
            "serialNumber": serial_number,
            "note": f"Decoded as {manufacturer} equipment",
            "decodedInfo": decoded_info,
            "confidence": confidence
        }

    # Strategy 3: For 17-character VINs that are not farm equipment, fall back to VIN decoding
    if len(serial_number) == 17:
        vin_info = await lookup_vin(serial_number)
        
        if vin_info and vin_info.get("found"):
            return {
                "found": True,
                "source": vin_info.get("source", "vin_decoder"),
                "equipmentType": vin_info.get("vehicleType", "Vehicle"),
                "make": vin_info.get("make"),
                "manufacturer": vin_info.get("make"),
                "model": vin_info.get("model"),
                "year": vin_info.get("year"),
                "type": vin_info.get("vehicleType"),
                "serialNumber": serial_number,
                "note": vin_info.get("note", "VIN decoded"),
                "vinInfo": vin_info
            }

    # Not found in any source
    return {
        "found": False,
        "message": "Serial number/VIN not found in any database",
        "serialNumber": serial_number,
        "suggestions": [
            "Double-check the serial number for typos",
            "For farm equipment, check the serial plate on the machine",
            "For vehicles, verify this is a valid 17-character VIN",
            "You can enter the information manually"
        ]
    }


@router.get("/naics")
async def lookup_naics(keyword: str):
    """
    Look up NAICS code by business keyword or description.
    
    Example: /lookup/naics?keyword=farming
    """
    result = lookup_naics_code(keyword)
    return result


@router.get("/manufacturers")
async def get_manufacturers():
    """
    Get list of all supported equipment manufacturers.
    """
    manufacturers = load_manufacturers()
    return {
        "count": len(manufacturers),
        "manufacturers": manufacturers
    }
