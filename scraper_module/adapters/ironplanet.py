import asyncio
import json
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from fetch import Fetcher
from extract import extract_year

BASE_URL = 'https://www.ironplanet.com'
CATEGORY_PATHS = [
    '/Agricultural+Tractors?ct=2',
]

logger = logging.getLogger(__name__)
QUICKVIEW_PATTERN = re.compile(r'quickviews\.push\((\{.*?\})\);', re.S)
NUMBER_PATTERN = re.compile(r'[\d,.]+')

MULTI_WORD_MAKES = [
    'John Deere',
    'Case IH',
    'New Holland',
    'Massey Ferguson',
    'International Harvester',
    'Agco Allis',
    'Versatile',
]
def _derive_make_model(title: str) -> tuple[Optional[str], Optional[str]]:
    if not title:
        return None, None

    cleaned = re.sub(r'[^A-Za-z0-9+./\-\s]', ' ', title).strip()
    tokens = cleaned.split()

    if tokens and tokens[0].isdigit() and len(tokens[0]) == 4:
        tokens = tokens[1:]

    if not tokens:
        return None, None

    lower_title = ' '.join(tokens).lower()

    for make in sorted(MULTI_WORD_MAKES, key=lambda m: len(m.split()), reverse=True):
        make_lower = make.lower()
        if lower_title.startswith(make_lower):
            make_tokens = make.split()
            model_tokens = tokens[len(make_tokens):]
            model = ' '.join(model_tokens).strip() or None
            return make, model

    make = tokens[0]
    model = ' '.join(tokens[1:]).strip() or None
    return make, model


def _parse_price(value: Optional[str]) -> Optional[float]:
    if not value:
        return None
    if '<' in value:
        text = BeautifulSoup(value, 'html.parser').get_text(' ', strip=True)
    else:
        text = value
    normalized = NUMBER_PATTERN.findall(text)
    if not normalized:
        return None
    digits = normalized[-1].replace(',', '')
    try:
        return float(digits)
    except ValueError:
        return None


def _parse_hours(value: Optional[str]) -> Optional[float]:
    if not value:
        return None
    match = NUMBER_PATTERN.search(value)
    if not match:
        return None
    digits = match.group(0).replace(',', '')
    try:
        return float(digits)
    except ValueError:
        return None


def _extract_quickviews(html: str) -> List[Dict[str, Any]]:
    records: List[Dict[str, Any]] = []
    for raw in QUICKVIEW_PATTERN.findall(html):
        try:
            records.append(json.loads(raw))
        except json.JSONDecodeError as exc:
            logger.debug('Failed to parse quickview JSON: %s', exc)
    return records


def _build_location(record: Dict[str, Any]) -> str:
    region = (record.get('eumeLocation') or '').strip()
    country = (record.get('flagPath') or '').strip()
    if region and country:
        return f'{region}, {country}'
    return region or country or ''


def normalize_record(record: Dict[str, Any], source_url: str) -> Dict[str, Any]:
    title = record.get('description') or ''
    year = extract_year(title)
    make, model = _derive_make_model(title)

    hours = _parse_hours(record.get('usage'))
    price = _parse_price(record.get('convPrice') or record.get('price'))

    auction_type_html = record.get('auctionType') or ''
    auction_type = BeautifulSoup(auction_type_html, 'html.parser').get_text(' ', strip=True) if auction_type_html else ''

    image_url = record.get('photoBigger') or record.get('photo') or record.get('photoThumb') or ''
    detail_path = record.get('itemPageUri') or record.get('bidUrl') or ''
    detail_url = urljoin(BASE_URL, detail_path)

    normalized = {
        'listing_id': record.get('equipId'),
        'title': title,
        'year': int(year) if year else None,
        'make': make,
        'model': model,
        'hours': hours,
        'price': price,
        'conv_price_text': record.get('convPrice'),
        'currency': record.get('currency'),
        'location': _build_location(record),
        'distance': record.get('distanceString'),
        'auction_type': auction_type,
        'buy_now': record.get('buyItNow'),
        'buy_now_text': record.get('buyItNowText'),
        'features': record.get('features'),
        'image_url': image_url,
        'source_url': detail_url or source_url,
        'lat': record.get('lat'),
        'lng': record.get('lng'),
        'source': 'IronPlanet',
        'timestamp': datetime.utcnow().isoformat(),
        'category_url': source_url,
    }

    return normalized


async def fetch_category_records(fetcher: Fetcher, category_path: str) -> List[Dict[str, Any]]:
    category_url = urljoin(BASE_URL, category_path)
    logger.info('Fetching IronPlanet category %s', category_url)
    html = await fetcher.get(category_url)
    if not html:
        logger.warning('No HTML returned for %s', category_url)
        return []

    records = _extract_quickviews(html)
    logger.debug('Extracted %d quickview records from %s', len(records), category_url)
    return [normalize_record(record, category_url) for record in records]


async def main(output_path: Optional[str] = None, emit_stdout: bool = True) -> List[Dict[str, Any]]:
    logging.basicConfig(level=logging.DEBUG)
    async with Fetcher() as fetcher:
        listings: List[Dict[str, Any]] = []
        seen_ids = set()

        for path in CATEGORY_PATHS:
            records = await fetch_category_records(fetcher, path)
            for record in records:
                listing_id = record.get('listing_id')
                if listing_id and listing_id in seen_ids:
                    continue
                if listing_id:
                    seen_ids.add(listing_id)
                listings.append(record)

        payload = json.dumps(listings, indent=2)

        if output_path:
            target = Path(output_path)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(payload, encoding='utf-8')
            logger.info('Wrote %d listings to %s', len(listings), target)

        if emit_stdout:
            print(payload)

        return listings


if __name__ == '__main__':
    asyncio.run(main())
