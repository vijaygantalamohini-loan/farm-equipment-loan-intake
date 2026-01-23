"""
OCR Service for document and barcode processing

Provides OCR (Optical Character Recognition) capabilities using Azure Computer Vision.
Supports:
- Invoice text extraction
- Barcode detection
- Document field extraction
"""

import httpx
import os
from io import BytesIO
from typing import Optional, List, Dict, Any, Iterable

from dotenv import load_dotenv

try:
    from PIL import Image, UnidentifiedImageError
except Exception:  # pragma: no cover - optional dependency in some environments
    Image = None
    UnidentifiedImageError = Exception


load_dotenv()

# Azure credentials from environment variables
AZURE_ENDPOINT = os.getenv("AZURE_ENDPOINT")
AZURE_KEY = os.getenv("AZURE_KEY")

print(f"[OCR_SERVICE] AZURE_ENDPOINT loaded: {AZURE_ENDPOINT}")
print(f"[OCR_SERVICE] AZURE_KEY loaded: {AZURE_KEY[:20] if AZURE_KEY else None}...")

if not AZURE_ENDPOINT or not AZURE_KEY:
    raise ValueError(
        "Missing AZURE_ENDPOINT and/or AZURE_KEY in environment. Please set them in loan-intake-backend/.env"
    )

def _safe_float(value: Any) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _avg_confidence(values: Iterable[Optional[float]]) -> Optional[float]:
    cleaned = [v for v in values if v is not None]
    if not cleaned:
        return None
    return sum(cleaned) / len(cleaned)


def _build_line_entry(text: str, words: List[Dict[str, Any]]) -> Dict[str, Any]:
    word_confidences = [_safe_float(word.get("confidence")) for word in words]
    return {
        "text": text,
        "confidence": _avg_confidence(word_confidences),
        "words": [
            {
                "text": word.get("text", ""),
                "confidence": _safe_float(word.get("confidence")),
            }
            for word in words
        ],
    }


def _extract_lines_from_azure_result(result: Dict[str, Any]) -> List[Dict[str, Any]]:
    lines: List[Dict[str, Any]] = []

    for region in result.get("regions", []):
        for line in region.get("lines", []):
            words = line.get("words", [])
            text = " ".join([word.get("text", "") for word in words]).strip()
            if text:
                lines.append(_build_line_entry(text, words))

    if lines:
        return lines

    read_results = (
        result.get("recognitionResults")
        or result.get("readResults")
        or result.get("analyzeResult", {}).get("readResults")
        or []
    )
    for page in read_results:
        for line in page.get("lines", []):
            words = line.get("words", [])
            text = line.get("text", "")
            if text:
                entry = _build_line_entry(text, words)
                if entry["confidence"] is None:
                    entry["confidence"] = _safe_float(line.get("confidence"))
                lines.append(entry)

    return lines

def _analyze_image_metadata(image_data: bytes) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "possible_tampering": False,
        "tampering_score": 0.0,
        "tampering_reasons": [],
        "width": None,
        "height": None,
        "format": None,
        "has_exif": None,
    }

    if not image_data:
        result["possible_tampering"] = True
        result["tampering_score"] = 1.0
        result["tampering_reasons"].append("empty_image")
        return result

    if Image is None:
        result["tampering_reasons"].append("metadata_unavailable")
        return result

    try:
        with Image.open(BytesIO(image_data)) as img:
            width, height = img.size
            result["width"] = width
            result["height"] = height
            result["format"] = img.format
            exif = img.getexif() if hasattr(img, "getexif") else None
            result["has_exif"] = bool(exif)

            score = 0.0
            if width < 300 or height < 300:
                score += 0.6
                result["tampering_reasons"].append("low_resolution")

            aspect_ratio = max(width / max(height, 1), height / max(width, 1))
            if aspect_ratio > 3.5:
                score += 0.5
                result["tampering_reasons"].append("extreme_aspect_ratio")

            if not result["has_exif"]:
                score += 0.1
                result["tampering_reasons"].append("missing_exif")

            result["tampering_score"] = min(score, 1.0)
            result["possible_tampering"] = result["tampering_score"] >= 0.6
            return result
    except UnidentifiedImageError:
        result["possible_tampering"] = True
        result["tampering_score"] = 1.0
        result["tampering_reasons"].append("unreadable_image")
        return result
    except Exception:
        result["possible_tampering"] = True
        result["tampering_score"] = 0.7
        result["tampering_reasons"].append("metadata_parse_error")
        return result


async def extract_text_from_id(image_data: bytes) -> dict:
    """
    Extract text from an ID card using Azure Computer Vision Read API 3.1.
    This is compatible with older Computer Vision resources.
    
    Args:
        image_data: Binary image data
        
    Returns:
        Dictionary with raw extracted text lines
    """
    headers = {
        "Ocp-Apim-Subscription-Key": AZURE_KEY,
        "Content-Type": "application/octet-stream"
    }
    # Use Computer Vision 3.1 Read API - works with older CV resources
    read_url = AZURE_ENDPOINT.rstrip("/") + "/vision/v3.1/read/analyze"

    tampering = _analyze_image_metadata(image_data)
    
    print("=" * 80)
    print("[OCR_SERVICE] ===== AZURE OCR REQUEST START =====")
    print(f"[OCR_SERVICE] Endpoint: {AZURE_ENDPOINT}")
    print(f"[OCR_SERVICE] Full URL: {read_url}")
    print(f"[OCR_SERVICE] API Key (first 20 chars): {AZURE_KEY[:20]}...")
    print(f"[OCR_SERVICE] API Key (last 10 chars): ...{AZURE_KEY[-10:]}")
    print(f"[OCR_SERVICE] Image size: {len(image_data)} bytes")
    print(f"[OCR_SERVICE] Headers: {{'Ocp-Apim-Subscription-Key': '***', 'Content-Type': '{headers['Content-Type']}'}}")
    print("=" * 80)
    
    try:
        # Step 1: Submit the image for analysis
        print(f"[OCR_SERVICE] Sending POST request to Azure...")
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(read_url, headers=headers, content=image_data)
        
        print(f"[OCR_SERVICE] Response Status Code: {resp.status_code}")
        print(f"[OCR_SERVICE] Response Headers: {dict(resp.headers)}")
        print(f"[OCR_SERVICE] Response Body Preview: {resp.text[:500]}")
        
        if resp.status_code >= 400:
            try:
                err = resp.json()
            except Exception:
                err = resp.text
            print(f"[OCR_SERVICE] Azure Read API error: {err}")
            return {
                "error": f"Azure OCR failed (HTTP {resp.status_code}): {err}",
                **tampering,
            }

        # Step 2: Get the operation location from headers to poll for results
        operation_location = resp.headers.get("Operation-Location")
        if not operation_location:
            print(f"[OCR_SERVICE] ERROR: No Operation-Location header found!")
            print(f"[OCR_SERVICE] Available headers: {list(resp.headers.keys())}")
            return {
                "error": "No Operation-Location header in Azure response",
                **tampering,
            }
        
        print(f"[OCR_SERVICE] ✓ Operation submitted successfully")
        print(f"[OCR_SERVICE] Operation Location: {operation_location}")
        print(f"[OCR_SERVICE] Starting to poll for results...")
        
        # Step 3: Poll for results
        import asyncio
        max_attempts = 10
        for attempt in range(max_attempts):
            await asyncio.sleep(1)  # Wait 1 second between polls
            
            print(f"[OCR_SERVICE] Poll attempt {attempt + 1}/{max_attempts}...")
            async with httpx.AsyncClient(timeout=30.0) as client:
                result_resp = await client.get(operation_location, headers={"Ocp-Apim-Subscription-Key": AZURE_KEY})
            
            print(f"[OCR_SERVICE] Poll response status: {result_resp.status_code}")
            if result_resp.status_code != 200:
                print(f"[OCR_SERVICE] Poll failed with status {result_resp.status_code}, retrying...")
                continue
                
            result = result_resp.json()
            status = result.get("status")
            print(f"[OCR_SERVICE] Operation status: {status}")
            
            if status == "succeeded":
                # Extract text from Read API response
                line_entries = []
                extracted_text = []
                
                print(f"[OCR_SERVICE] ✓ OCR succeeded! Extracting text...")
                for read_result in result.get("analyzeResult", {}).get("readResults", []):
                    for line in read_result.get("lines", []):
                        text = line.get("text", "")
                        if text:
                            extracted_text.append(text)
                            line_entries.append({
                                "text": text,
                                "confidence": None,
                                "words": []
                            })
                
                print(f"[OCR_SERVICE] Extracted {len(extracted_text)} lines of text")
                print(f"[OCR_SERVICE] Sample text: {extracted_text[:3] if extracted_text else 'None'}")
                print("=" * 80)
                
                return {
                    "rawText": extracted_text,
                    "lines": line_entries,
                    **tampering,
                }
            elif status == "failed":
                print(f"[OCR_SERVICE] ✗ Azure operation failed")
                print(f"[OCR_SERVICE] Failure details: {result}")
                return {
                    "error": f"Azure Read API failed: {result}",
                    **tampering,
                }
        
        print(f"[OCR_SERVICE] ✗ Timeout after {max_attempts} polling attempts")
        print("=" * 80)
        return {
            "error": "Timeout waiting for Azure Read API results",
            **tampering,
        }
    
    except httpx.RequestError as e:
        print(f"[OCR_SERVICE] ✗ Network error: {str(e)}")
        print("=" * 80)
        return {
            "error": f"Network error contacting Azure: {str(e)}",
            **tampering,
        }
    except Exception as e:
        import traceback
        print(f"[OCR_SERVICE] ✗ Unexpected exception:")
        print(traceback.format_exc())
        print("=" * 80)
        return {
            "error": f"OCR processing error: {str(e)}",
            **tampering,
        }


async def extract_text_from_image(image_data: bytes) -> Optional[dict]:
    """
    Extract text from an image using Azure Computer Vision OCR.
    
    Args:
        image_data: Binary image data
        
    Returns:
        Dictionary with extracted text and status, or None if failed
    """
    try:
        analyze_url = f"{AZURE_ENDPOINT}vision/v3.2/read/analyze"
        headers = {
            'Ocp-Apim-Subscription-Key': AZURE_KEY,
            'Content-Type': 'application/octet-stream'
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Submit the image for analysis
            response = await client.post(analyze_url, headers=headers, content=image_data)
            
            if response.status_code != 202:
                return {"error": f"Azure OCR failed with status {response.status_code}"}
            
            # Get the operation location
            operation_url = response.headers.get('Operation-Location')
            if not operation_url:
                return {"error": "No operation URL returned from Azure"}
            
            # Poll for results
            import asyncio
            max_attempts = 10
            for _ in range(max_attempts):
                await asyncio.sleep(1)
                result_response = await client.get(
                    operation_url,
                    headers={'Ocp-Apim-Subscription-Key': AZURE_KEY}
                )
                result = result_response.json()
                
                if result.get('status') == 'succeeded':
                    # Extract all text
                    all_lines = []
                    for read_result in result.get('analyzeResult', {}).get('readResults', []):
                        for line in read_result.get('lines', []):
                            words = line.get("words", [])
                            text = line.get("text", "")
                            if text:
                                entry = _build_line_entry(text, words)
                                if entry["confidence"] is None:
                                    entry["confidence"] = _safe_float(line.get("confidence"))
                                all_lines.append(entry)

                    return {
                        "status": "success",
                        "text": "\n".join([line["text"] for line in all_lines]),
                        "lines": all_lines,
                        "lineCount": len(all_lines)
                    }
                elif result.get('status') == 'failed':
                    return {"error": "Azure OCR processing failed"}
            
            return {"error": "OCR processing timeout"}
    
    except Exception as e:
        return {"error": f"OCR service error: {str(e)}"}


async def detect_barcode_from_image(image_data: bytes) -> Optional[dict]:
    """
    Detect and decode barcodes from an image using Azure Computer Vision.
    
    Args:
        image_data: Binary image data
        
    Returns:
        Dictionary with barcode value and format, or None if no barcode found
    """
    try:
        analyze_url = f"{AZURE_ENDPOINT}vision/v3.2/read/analyze"
        headers = {
            'Ocp-Apim-Subscription-Key': AZURE_KEY,
            'Content-Type': 'application/octet-stream'
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Submit the image for analysis
            response = await client.post(analyze_url, headers=headers, content=image_data)
            
            if response.status_code != 202:
                return {"error": f"Azure barcode detection failed with status {response.status_code}"}
            
            # Get the operation location
            operation_url = response.headers.get('Operation-Location')
            if not operation_url:
                return {"error": "No operation URL returned from Azure"}
            
            # Poll for results
            import asyncio
            max_attempts = 10
            for _ in range(max_attempts):
                await asyncio.sleep(1)
                result_response = await client.get(
                    operation_url,
                    headers={'Ocp-Apim-Subscription-Key': AZURE_KEY}
                )
                result = result_response.json()
                
                if result.get('status') == 'succeeded':
                    # Look for barcode-like patterns in text
                    all_text = []
                    for read_result in result.get('analyzeResult', {}).get('readResults', []):
                        for line in read_result.get('lines', []):
                            text = line.get('text', '')
                            all_text.append(text)
                            # Simple barcode detection: long alphanumeric strings
                            if len(text) >= 8 and (text.isalnum() or text.replace('-', '').isalnum()):
                                return {
                                    "found": True,
                                    "value": text,
                                    "format": "detected"
                                }
                    
                    # Return all text if no clear barcode found
                    return {
                        "found": False,
                        "allText": all_text,
                        "note": "No clear barcode detected, returning all text"
                    }
                elif result.get('status') == 'failed':
                    return {"error": "Azure barcode detection failed"}
            
            return {"error": "Barcode detection timeout"}
    
    except Exception as e:
        return {"error": f"Barcode detection error: {str(e)}"}
