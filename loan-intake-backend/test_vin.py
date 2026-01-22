import httpx

r = httpx.get('https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/1HGBH41JXMN109186?format=json', timeout=10)
data = r.json()
results = data.get('Results', [])

print('=== NHTSA API Response for VIN: 1HGBH41JXMN109186 ===\n')
for item in results:
    var_name = item.get('Variable')
    value = item.get('Value')
    if var_name in ['Make', 'Model', 'Model Year']:
        print(f"{var_name}: '{value}'")
