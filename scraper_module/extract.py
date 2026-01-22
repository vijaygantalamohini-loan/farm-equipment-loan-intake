import re
from typing import Dict, Optional, List
from bs4 import BeautifulSoup

# Manufacturer dictionary for makes (sample subset, extend as needed)
MANUFACTURERS = {
    "John Deere", "Caterpillar", "Kubota", "CASE", "Massey Ferguson", "New Holland", "Bobcat", 
    "Komatsu", "AGCO", "Claas", "Volvo", "Hitachi", "JCB", "Liebherr"
}

YEAR_REGEX = re.compile(r'(19|20)\d{2}')

def extract_year(text: str) -> Optional[str]:
    match = YEAR_REGEX.search(text)
    if match:
        return match.group(0)
    return None

def extract_make_model(title: str) -> (Optional[str], Optional[str]):
    tokens = title.split()
    for idx, token in enumerate(tokens):
        if token in MANUFACTURERS:
            make = token
            model = tokens[idx+1] if idx+1 < len(tokens) else None
            return make, model
    # Fallback: first token is make, second is model
    if len(tokens) >= 2:
        return tokens[0], tokens[1]
    return None, None

def extract_serial_number(soup: BeautifulSoup, spec_table_selector: str, description_selector: str) -> Optional[str]:
    # Try spec table extraction
    serial_number = None
    spec_table = soup.select_one(spec_table_selector)  # TODO: site specific selector
    if spec_table:
        for row in spec_table.select('tr'):
            cells = row.find_all(['td', 'th'])
            if len(cells) >= 2:
                th_text = cells[0].get_text(strip=True).lower()
                if 'serial' in th_text or 'serial number' in th_text:
                    serial_number = cells[1].get_text(strip=True)
                    break
    # If not found, try description text regex search for serial number pattern
    if not serial_number:
        description = soup.select_one(description_selector)  # TODO: site specific selector
        if description:
            text = description.get_text(separator=' ', strip=True)
            # Approximate serial no pattern: alphanumeric, 5-20 chars
            matches = re.findall(r'\b[A-Z0-9\-]{5,20}\b', text, re.I)
            if matches:
                serial_number = matches[0]
    return serial_number

def extract_optional_fields(soup: BeautifulSoup) -> Dict[str, Optional[str]]:
    optional = {}

    # Hours
    hours = None
    hours_selector = 'div.hours'  # TODO: site specific
    el = soup.select_one(hours_selector)
    if el:
        hours = el.get_text(strip=True)
    optional['hours'] = hours

    # Price
    price = None
    price_selector = 'span.price'  # TODO: site specific
    el = soup.select_one(price_selector)
    if el:
        price = el.get_text(strip=True)
    optional['price'] = price

    # Location
    location = None
    location_selector = 'div.location'  # TODO: site specific
    el = soup.select_one(location_selector)
    if el:
        location = el.get_text(strip=True)
    optional['location'] = location

    # Category/subcategory
    category = None
    cat_selector = 'div.category'  # TODO: site specific
    el = soup.select_one(cat_selector)
    if el:
        category = el.get_text(strip=True)
    optional['category'] = category

    # Media URLs
    media = []
    media_selector = 'img.media'  # TODO: site specific
    for img in soup.select(media_selector):
        src = img.get('src')
        if src:
            media.append(src)
    optional['media_urls'] = media if media else None

    # Spec table fields (generalized)
    specs = {}
    spec_table = soup.select_one('table.specs')  # TODO: site specific
    if spec_table:
        for row in spec_table.select('tr'):
            cells = row.find_all(['td', 'th'])
            if len(cells) >= 2:
                key = cells[0].get_text(strip=True).lower()
                val = cells[1].get_text(strip=True)
                specs[key] = val
    optional['spec_table_fields'] = specs if specs else None

    return optional
