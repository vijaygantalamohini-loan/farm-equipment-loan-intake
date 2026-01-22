import asyncio
import json
import logging
from pathlib import Path
from typing import Dict, List, Optional

from bs4 import BeautifulSoup

from fetch import Fetcher
from extract import extract_year, extract_make_model

BASE_URL = 'https://www.rbauction.com'
CATEGORY_URLS = [f'{BASE_URL}/cp/agricultural-tractors']
logger = logging.getLogger(__name__)


def _ensure_query_separator(url: str) -> str:
    return '&' if '?' in url else '?'


async def fetch_category_records(fetcher: Fetcher, category_url: str, max_pages: int = 20) -> List[Dict]:
    records: List[Dict] = []
    seen_ids = set()
    offset = 0

    for _ in range(max_pages):
        page_url = category_url
        if offset:
            page_url = f"{category_url}{_ensure_query_separator(category_url)}from={offset}"

        logger.debug('Fetching category page %s', page_url)
        html = await fetcher.get(page_url)
        if not html:
            logger.warning('No HTML returned for %s', page_url)
            break

        soup = BeautifulSoup(html, 'html.parser')
        script = soup.find('script', id='__NEXT_DATA__')
        if not script:
            logger.warning('__NEXT_DATA__ script missing for %s', page_url)
            break

        try:
            payload = json.loads(script.string or '{}')
        except json.JSONDecodeError as exc:
            logger.warning('Failed to parse __NEXT_DATA__ JSON for %s: %s', page_url, exc)
            break

        page_props = payload.get('props', {}).get('pageProps', {})
        results = (page_props.get('data') or {}).get('results') or {}
        page_records = results.get('records') or []

        if not page_records:
            logger.debug('No records found on %s', page_url)
            break

        new_records = []
        for record in page_records:
            listing_id = record.get('listingId')
            if listing_id and listing_id not in seen_ids:
                seen_ids.add(listing_id)
                new_records.append(record)

        logger.debug('Found %d new records (total=%d)', len(new_records), len(records) + len(new_records))
        records.extend(new_records)

        returned = results.get('returnedAmount') or len(page_records)
        total = results.get('totalAmount') or len(records)
        offset += returned

        if offset >= total or returned == 0:
            break

    return records


def normalize_record(record: Dict, category_url: str) -> Dict:
    title = record.get('assetDescription') or ''
    year = record.get('manufactureYear') or extract_year(title)
    manufacturer = record.get('manufacturerLocalized') or record.get('manufacturer')
    model = record.get('modelLocalized') or record.get('model')

    if (not manufacturer or not model) and title:
        extracted_make, extracted_model = extract_make_model(title)
    else:
        extracted_make, extracted_model = (None, None)

    make = manufacturer or extracted_make or ''
    model = model or extracted_model or ''

    location_parts = [record.get('locationCity'), record.get('locationState'), record.get('locationCountry')]
    location = ', '.join(part for part in location_parts if part)

    return {
        'listing_id': record.get('listingId'),
        'title': title,
        'year': year,
        'make': make,
        'model': model,
        'serial_number': record.get('serialNumber') or '',
        'asset_type': record.get('assetTypeLocalized') or record.get('assetType') or '',
        'location': location,
        'auction': record.get('saleEventName') or record.get('eventAdvertisedName') or '',
        'sale_date': record.get('eventStartDate') or record.get('eventStartDateTime'),
        'buying_format': record.get('buyingFormat') or record.get('buyingFormatFacetLabel') or '',
        'image_url': record.get('imageUrl') or '',
        'source_url': category_url,
    }


async def main(output_path: Optional[str] = None, emit_stdout: bool = True) -> List[Dict]:
    logging.basicConfig(level=logging.DEBUG)
    async with Fetcher() as fetcher:
        listings: List[Dict] = []
        for url in CATEGORY_URLS:
            logger.info('Collecting listings from %s', url)
            records = await fetch_category_records(fetcher, url)
            normalized = [normalize_record(record, url) for record in records]
            listings.extend(normalized)

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
