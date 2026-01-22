import pytesseract
from PIL import Image
import re
import tempfile
import aiohttp
import asyncio
from typing import Optional

async def download_image(url: str) -> Optional[str]:
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as resp:
                if resp.status == 200:
                    data = await resp.read()
                    tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
                    tmp.write(data)
                    tmp.close()
                    return tmp.name
    except Exception:
        return None


def tesseract_ocr(image_path: str) -> str:
    img = Image.open(image_path)
    return pytesseract.image_to_string(img)


def extract_serial_from_text(text: str) -> Optional[str]:
    # Example pattern: alphanumeric, between 5 and 20 chars
    matches = re.findall(r'\b[A-Z0-9\-]{5,20}\b', text, re.I)
    if matches:
        serial = matches[0]
        # Normalize serial number
        serial = serial.strip().upper().replace(' ', '').replace('\n', '')
        return serial
    return None


async def extract_serial_number_ocr(image_url: str) -> Optional[str]:
    image_path = await download_image(image_url)
    if not image_path:
        return None
    text = tesseract_ocr(image_path)
    serial = extract_serial_from_text(text)
    return serial
