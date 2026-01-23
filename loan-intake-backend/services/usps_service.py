"""
USPS Address Validation Service

Provides address validation and standardization using USPS API.
"""

import httpx
from typing import Optional, Dict
import xml.etree.ElementTree as ET


# USPS API Configuration
# Register for free at: https://www.usps.com/business/web-tools-apis/
USPS_USER_ID = "YOUR_USPS_USER_ID"  # Replace with actual USPS User ID
USPS_API_URL = "https://secure.shippingapis.com/ShippingAPI.dll"


async def validate_address(street: str, city: str, state: str, zip_code: str) -> Optional[Dict]:
    """
    Validate and standardize an address using USPS API.
    
    Args:
        street: Street address
        city: City name
        state: State abbreviation (e.g., "CA", "NY")
        zip_code: ZIP code (5 or 9 digits)
        
    Returns:
        Dictionary with validated address or error information
    """
    
    # If USPS API is not configured, return a mock validation
    if USPS_USER_ID == "YOUR_USPS_USER_ID":
        return {
            "validated": False,
            "message": "USPS API not configured",
            "original": {
                "street": street,
                "city": city,
                "state": state,
                "zip": zip_code
            },
            "suggested": None
        }
    
    try:
        # Build USPS XML request
        xml_request = f"""
        <AddressValidateRequest USERID="{USPS_USER_ID}">
            <Revision>1</Revision>
            <Address ID="0">
                <Address1></Address1>
                <Address2>{street}</Address2>
                <City>{city}</City>
                <State>{state}</State>
                <Zip5>{zip_code[:5]}</Zip5>
                <Zip4></Zip4>
            </Address>
        </AddressValidateRequest>
        """
        
        params = {
            "API": "Verify",
            "XML": xml_request.strip()
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(USPS_API_URL, params=params)
            
            if response.status_code != 200:
                return {
                    "validated": False,
                    "error": f"USPS API error: {response.status_code}",
                    "original": {"street": street, "city": city, "state": state, "zip": zip_code}
                }
            
            # Parse XML response
            root = ET.fromstring(response.content)
            
            # Check for errors
            error = root.find(".//Error")
            if error is not None:
                error_desc = error.find("Description")
                return {
                    "validated": False,
                    "error": error_desc.text if error_desc is not None else "Unknown error",
                    "original": {"street": street, "city": city, "state": state, "zip": zip_code}
                }
            
            # Extract validated address
            address = root.find(".//Address")
            if address is not None:
                validated_street = address.find("Address2")
                validated_city = address.find("City")
                validated_state = address.find("State")
                validated_zip5 = address.find("Zip5")
                validated_zip4 = address.find("Zip4")
                
                validated_zip = validated_zip5.text if validated_zip5 is not None else ""
                if validated_zip4 is not None and validated_zip4.text:
                    validated_zip += f"-{validated_zip4.text}"
                
                suggested = {
                    "street": validated_street.text if validated_street is not None else street,
                    "city": validated_city.text if validated_city is not None else city,
                    "state": validated_state.text if validated_state is not None else state,
                    "zip": validated_zip or zip_code
                }
                
                # Check if address was changed
                original_normalized = f"{street} {city} {state} {zip_code}".lower().replace(" ", "")
                suggested_normalized = f"{suggested['street']} {suggested['city']} {suggested['state']} {suggested['zip']}".lower().replace(" ", "")
                
                return {
                    "validated": True,
                    "changed": original_normalized != suggested_normalized,
                    "original": {"street": street, "city": city, "state": state, "zip": zip_code},
                    "suggested": suggested
                }
            
            return {
                "validated": False,
                "error": "No address returned from USPS",
                "original": {"street": street, "city": city, "state": state, "zip": zip_code}
            }
    
    except Exception as e:
        return {
            "validated": False,
            "error": f"Address validation error: {str(e)}",
            "original": {"street": street, "city": city, "state": state, "zip": zip_code}
        }


async def lookup_zip_code(city: str, state: str) -> Optional[Dict]:
    """
    Look up ZIP code for a city and state using USPS API.
    
    Args:
        city: City name
        state: State abbreviation
        
    Returns:
        Dictionary with ZIP code information or None if not found
    """
    
    if USPS_USER_ID == "YOUR_USPS_USER_ID":
        return {
            "found": False,
            "message": "USPS API not configured"
        }
    
    try:
        xml_request = f"""
        <CityStateLookupRequest USERID="{USPS_USER_ID}">
            <ZipCode ID="0">
                <City>{city}</City>
                <State>{state}</State>
            </ZipCode>
        </CityStateLookupRequest>
        """
        
        params = {
            "API": "CityStateLookup",
            "XML": xml_request.strip()
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(USPS_API_URL, params=params)
            
            if response.status_code != 200:
                return {"found": False, "error": f"USPS API error: {response.status_code}"}
            
            root = ET.fromstring(response.content)
            
            error = root.find(".//Error")
            if error is not None:
                return {"found": False, "error": error.find("Description").text}
            
            zipcode = root.find(".//Zip5")
            found_city = root.find(".//City")
            found_state = root.find(".//State")
            
            if zipcode is not None:
                return {
                    "found": True,
                    "zip": zipcode.text,
                    "city": found_city.text if found_city is not None else city,
                    "state": found_state.text if found_state is not None else state
                }
            
            return {"found": False, "error": "No ZIP code found"}
    
    except Exception as e:
        return {"found": False, "error": f"ZIP lookup error: {str(e)}"}
