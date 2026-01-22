import asyncio
from typing import List, Dict, Optional
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import logging

from fetch import Fetcher
from extract import extract_year, extract_make_model, extract_serial_number, extract_optional_fields
from ocr import extract_serial_number_ocr

BASE_URL = 'https://www.tractorhouse.com'
logger = logging.getLogger(__name__)


def is_block_page(content: Optional[str]) -> bool:
    if not content:
        return False
    snippet = content[:4096]
    return 'Pardon Our Interruption' in snippet or 'distil_referrer' in snippet

async def extract_listing_blocks(html: str) -> List[str]:
    soup = BeautifulSoup(html, 'html.parser')
    blocks = soup.select(
        'article[data-listing-id], div.listing-card, div[data-result-id], li[data-qa="result"]'
    )
    logger.debug(f'Found {len(blocks)} listing blocks')
    return [str(block) for block in blocks]

async def parse_listing_block(block_html: str) -> Dict:
    soup = BeautifulSoup(block_html, 'html.parser')

    title_el = soup.select_one('h1[itemprop="name"], h2.listing-title')
    title = title_el.get_text(strip=True) if title_el else ''
    logger.debug(f'Parsing listing with title: {title}')

    year = extract_year(title)
    make, model = extract_make_model(title)

    serial_number = extract_serial_number(
        soup,
        spec_table_selector='table.specifications, table.specs',
        description_selector='div#description, div.description'
    )
    logger.debug(f'Extracted serial number from page: {serial_number}')

    serial_plate_url = None
    for sel in ['img.serial-plate', 'img#serialImage', 'div.serial img']:
        img = soup.select_one(sel)
        if img and img.get('src'):
            serial_plate_url = urljoin(BASE_URL, img['src'])
            logger.debug(f'Found serial plate image URL: {serial_plate_url}')
            break

    if serial_plate_url:
        try:
            ocr_serial = await extract_serial_number_ocr(serial_plate_url)
            if ocr_serial:
                serial_number = ocr_serial
                logger.debug(f'OCR extracted serial number: {serial_number}')
        except Exception as e:
            logger.warning(f'OCR extraction failed: {e}')

    optional_fields = extract_optional_fields(soup)

    source_url_el = soup.select_one('link[rel=canonical], a.detail-link, a.listing-link')
    source_url = urljoin(BASE_URL, source_url_el['href']) if source_url_el else ''

    return {
        'year': year,
        'make': make,
        'model': model,
        'serial_number': serial_number,
        'optional': optional_fields,
        'source_url': source_url,
        'title': title,
    }

def normalize_listing(data: Dict) -> Dict:
    # Placeholder normalization. Adjust as needed.
    return data

async def discover_listing_urls(fetcher: Fetcher) -> List[str]:
    sitemap_url = f'{BASE_URL}/sitemap.xml'
    sitemap_xml = await fetcher.get(sitemap_url)
    urls = []
    if sitemap_xml and not is_block_page(sitemap_xml):
        from xml.etree import ElementTree as ET
        try:
            root = ET.fromstring(sitemap_xml)
            for url in root.findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc'):
                loc = url.text or ''
                if '/equipment/' in loc:
                    urls.append(loc)
            logger.debug(f'Discovered {len(urls)} URLs via sitemap.xml')
        except ET.ParseError as exc:
            logger.warning(f'sitemap.xml parse failed: {exc}; falling back to category crawl')
    else:
        if sitemap_xml and is_block_page(sitemap_xml):
            logger.warning('Blocked while requesting sitemap.xml — switching to fallback crawl')
        # Fallback category crawl
        fallback_sources = [
            f'{BASE_URL}/equipment/farm-equipment',
            f'{BASE_URL}/',
        ]

        for category_url in fallback_sources:
            page_html = await fetcher.get(category_url)
            if not page_html or is_block_page(page_html):
                logger.warning(f'Failed to load category page {category_url}')
                continue

            soup = BeautifulSoup(page_html, 'html.parser')
            links = soup.select('a[data-listing-id], a[data-analytics-listing-id], a.listing-link, a[href*="/listings/"]')
            for link in links:
                href = link.get('href')
                if not href:
                    continue
                full_url = urljoin(BASE_URL, href)
                urls.append(full_url)

        if urls:
            logger.debug(f'Discovered {len(urls)} URLs via category crawl')
        else:
            logger.warning('Fallback crawl produced no listing URLs')
    return urls

async def main():
    logging.basicConfig(level=logging.DEBUG)
    async with Fetcher() as fetcher:
        listing_urls = await discover_listing_urls(fetcher)
        listing_data = []
        for url in listing_urls:
            logger.info(f'Processing {url}')
            html = await fetcher.get(url)
            if not html or is_block_page(html):
                logger.warning(f'Skipping {url} because request was blocked')
                continue
            if html:
                blocks = await extract_listing_blocks(html)
                for block_html in blocks:
                    data = await parse_listing_block(block_html)
                    normalized = normalize_listing(data)
                    listing_data.append(normalized)
        import json
        print(json.dumps(listing_data, indent=2))

if __name__ == '__main__':
    asyncio.run(main())
