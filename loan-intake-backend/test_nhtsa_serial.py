import requests

serial = "1M08345PXXY789012"
nhtsa_url = f"https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/{serial}?format=json"

print(f"Testing if NHTSA has data for: {serial}")
print(f"URL: {nhtsa_url}\n")

response = requests.get(nhtsa_url, timeout=10)
data = response.json()
results = data.get("Results", [])

# Check for errors and key fields
for item in results:
    var_name = item.get("Variable")
    value = item.get("Value")
    if var_name in ['Error Code', 'Error Text', 'Make', 'Model', 'Model Year', 'Vehicle Type']:
        print(f"{var_name}: {value}")
