"""Test serial number decoding for all supported manufacturers."""
import requests
import json

# Test serials for different manufacturers
test_serials = {
    "John Deere": [
        "1M08345PXXY789012",  # Should decode year from position 10
        "1M06420PXXY123456",  # Mock DB entry
        "1RW7330ABC123456",   # Different prefix
    ],
    "Case IH": [
        "JJC0316262",  # Mock DB entry - should be 2003
        "JJC1822345",  # Should be 2018
        "JJA0515789",  # Should be 2005
    ],
    "New Holland": [
        "NH123456789",     # Mock DB entry
        "ZBJFH12345678",   # ZBJF format with year code H (2017)
        "ZBJEK98765432",   # ZBJE format with year code K (2019)
    ],
    "Kubota": [
        "L4330-12345",     # Model L4330
        "B265015987",      # Model B2650
        "M7060-23456",     # Model M7060
    ],
    "Massey Ferguson": [
        "MF772012345",     # MF 7720 model
        "MFGC230018456",   # MF GC2300 model from 2018
        "MF5710-21789",    # MF 5710 from 2021
    ],
    "AGCO/Fendt": [
        "WF2025-12345",    # Fendt with embedded year
        "TF2022-98765",    # Fendt Favorit 2022
        "AGCO2024ABC123",  # AGCO with embedded year
    ]
}

print("=" * 80)
print("TESTING SERIAL NUMBER DECODERS FOR ALL MANUFACTURERS")
print("=" * 80)

for manufacturer, serials in test_serials.items():
    print(f"\n{'='*80}")
    print(f"TESTING: {manufacturer}")
    print(f"{'='*80}")
    
    for serial in serials:
        print(f"\n📋 Serial: {serial}")
        print("-" * 80)
        
        try:
            response = requests.get(f"http://localhost:8000/lookup/serial/{serial}", timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("found"):
                    print(f"✅ FOUND")
                    print(f"   Make:  {data.get('make', 'N/A')}")
                    print(f"   Model: {data.get('model', 'N/A')}")
                    print(f"   Year:  {data.get('year', 'N/A')}")
                    if data.get('valueEstimate'):
                        print(f"   Value: ${data.get('valueEstimate'):,}")
                    if data.get('note'):
                        print(f"   Note:  {data.get('note')}")
                    if data.get('source'):
                        print(f"   Source: {data.get('source')}")
                else:
                    print(f"❌ NOT FOUND")
                    print(f"   Message: {data.get('message', 'Unknown')}")
            else:
                print(f"❌ ERROR: HTTP {response.status_code}")
                print(f"   {response.text}")
                
        except Exception as e:
            print(f"❌ EXCEPTION: {e}")

print("\n" + "=" * 80)
print("TEST COMPLETE")
print("=" * 80)
