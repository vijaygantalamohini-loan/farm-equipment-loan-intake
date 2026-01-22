"""
OCR routes for ID, invoice, and barcode scanning
"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from services.ocr_service import extract_text_from_image, detect_barcode_from_image, extract_text_from_id
from services.ocr_parser import (
    find_name,
    find_dob,
    find_address,
    parse_id_fields_with_confidence,
    apply_confidence_threshold,
)
from services.invoice_parser import extract_invoice_details, extract_invoice_details_with_confidence

router = APIRouter(prefix="/ocr", tags=["ocr"])


@router.post("/id")
async def ocr_id(file: UploadFile = File(...)):
    """
    OCR endpoint for ID card scanning.
    Extracts name, date of birth, and address information.
    """
    image_data = await file.read()
    
    # Use the modular OCR service
    ocr_result = await extract_text_from_id(image_data)
    
    if "error" in ocr_result:
        raise HTTPException(status_code=502, detail=ocr_result["error"])
    
    extracted_text = ocr_result.get("rawText", [])
    line_entries = ocr_result.get("lines") or extracted_text
    fields = parse_id_fields_with_confidence(line_entries)
    fields, needs_review = apply_confidence_threshold(fields, threshold=0.7)

    # Parse structured values using helper functions from ocr_parser (backward compatible)
    first_name = fields["firstName"]["value"] or find_name(extracted_text)[0]
    last_name = fields["lastName"]["value"] or find_name(extracted_text)[1]
    date_of_birth = fields["dateOfBirth"]["value"] or find_dob(extracted_text)
    street = fields["address"]["street"]["value"]
    city = fields["address"]["city"]["value"]
    state = fields["address"]["state"]["value"]
    zip_code = fields["address"]["zip"]["value"]

    return {
        "rawText": extracted_text,
        "firstName": first_name,
        "lastName": last_name,
        "dateOfBirth": date_of_birth,
        "street": street,
        "city": city,
        "state": state,
        "zip": zip_code,
        "fields": fields,
        "needs_review": needs_review,
    }


@router.post("/asset")
async def ocr_asset(file: UploadFile = File(...)):
    """
    OCR endpoint for invoice/asset document scanning.
    Extracts equipment details, serial numbers, prices, etc.
    """
    image_data = await file.read()
    
    # Use the modular OCR service
    ocr_result = await extract_text_from_image(image_data)
    
    if not ocr_result or "error" in ocr_result:
        raise HTTPException(status_code=502, detail=ocr_result.get("error", "OCR failed"))
    
    raw_text = ocr_result.get("text", "")
    lines = ocr_result.get("lines") or raw_text.split("\n")
    
    # Use shared invoice parser service
    invoice_details = extract_invoice_details(lines)
    invoice_details_with_conf = extract_invoice_details_with_confidence(lines)
    fields, needs_review = apply_confidence_threshold(invoice_details_with_conf["fields"], threshold=0.7)
    
    return {
        "rawText": raw_text.split("\n"),
        "extractedData": invoice_details,
        "fields": fields,
        "needs_review": needs_review,
        "lineCount": len(lines)
    }


@router.post("/barcode")
async def ocr_barcode(file: UploadFile = File(...)):
    """
    OCR endpoint for barcode scanning.
    Detects and decodes barcodes from images.
    """
    image_data = await file.read()
    
    # Use the modular barcode detection service
    barcode_result = await detect_barcode_from_image(image_data)
    
    if not barcode_result or "error" in barcode_result:
        raise HTTPException(status_code=502, detail=barcode_result.get("error", "Barcode detection failed"))
    
    return barcode_result
