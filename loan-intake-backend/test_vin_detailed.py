import httpx

def test_vin():
    vin = "1HGBH41JXMN109186"
    url = f"https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/{vin}?format=json"

    with httpx.Client(timeout=10.0) as client:
        response = client.get(url)
        data = response.json()
        results = data.get("Results", [])

    print(f"=== Testing VIN: {vin} ===\n")
    print("All relevant fields from NHTSA:")
    for item in results:
        var_name = item.get("Variable")
        value = item.get("Value")
        if var_name in ['Make', 'Model', 'Model Year', 'Vehicle Type', 'Error Code', 'Error Text']:
            print(f"  {var_name}: '{value}'")

    info = {}
    error_text = None
    for item in results:
        var_name = item.get("Variable")
        value = item.get("Value")

        if var_name == "Error Text":
            error_text = value

        if value and value not in ["Not Applicable", "None", ""]:
            if var_name == "Make":
                info["make"] = value
            elif var_name == "Model":
                info["model"] = value
            elif var_name == "Model Year":
                info["year"] = value

    print("\n=== What backend would return ===")
    print(f"  make: {info.get('make')}")
    print(f"  model: {info.get('model')}")
    print(f"  year: {info.get('year')}")
