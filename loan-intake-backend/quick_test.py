import requests
import json

# Test the serial lookup directly
serial = "1M08345PXXY789012"
url = f"http://127.0.0.1:8000/lookup/serial/{serial}"

try:
    response = requests.get(url, timeout=5)
    data = response.json()
    
    print(f"Testing serial: {serial}")
    print(f"Year returned: {data.get('year')}")
    print(f"Full response:")
    print(json.dumps(data, indent=2))
except Exception as e:
    print(f"Error: {e}")
