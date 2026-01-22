import re

def decode_john_deere_serial(serial: str):
    """Decode John Deere serial number to extract year and model info."""
    year_codes = {'A':'2010','B':'2011','C':'2012','D':'2013','E':'2014','F':'2015','G':'2016',
                  'H':'2017','J':'2018','K':'2019','L':'2020','M':'2021','N':'2022','P':'2023',
                  'R':'2024','S':'2025','T':'2026','U':'2027','V':'2028','W':'2029','X':'2030',
                  'Y':'2031','0':'2000','1':'2001','2':'2002','3':'2003','4':'2004','5':'2005',
                  '6':'2006','7':'2007','8':'2008','9':'2009'}
    
    year = None
    if len(serial) >= 10:
        year_char = serial[9] if len(serial) > 9 else None
        decoded_year = year_codes.get(year_char)
        
        # Validate year - if it's more than 1 year in the future, it's likely a recycled code
        if decoded_year:
            year_int = int(decoded_year)
            current_year = 2025
            if year_int > current_year + 1:
                # Year code has cycled - likely from previous cycle
                year_int -= 30
            year = str(year_int)
    
    # Try to extract model from prefix
    model_match = re.search(r'[0-9]{4}', serial[:7])
    model = model_match.group(0) if model_match else None
    
    return {"year": year, "model": model}

# Test cases
test_serials = [
    "1M08345PXXY789012",  # Your example - X at position 10
    "1M06420PPXY123456",  # P = 2023
    "1M06420PSXY123456",  # S = 2025
    "1M06420PTXY123456",  # T = 2026
]

print("=== John Deere Serial Decoding ===\n")
for serial in test_serials:
    result = decode_john_deere_serial(serial)
    year_char = serial[9] if len(serial) > 9 else None
    print(f"Serial: {serial}")
    print(f"  Position 10 char: '{year_char}'")
    print(f"  Decoded Year: {result['year']}")
    print(f"  Model: {result['model']}")
    print()
