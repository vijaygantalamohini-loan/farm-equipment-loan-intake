from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
import re
import httpx

load_dotenv()

# Enforce credentials from .env; no hardcoded defaults
AZURE_ENDPOINT = os.getenv("AZURE_ENDPOINT")
AZURE_KEY = os.getenv("AZURE_KEY")

if not AZURE_ENDPOINT or not AZURE_KEY:
    raise ValueError(
        "Missing AZURE_ENDPOINT and/or AZURE_KEY in environment. "
        "Please set them in loan-intake-backend/.env"
    )

app = FastAPI(title="Loan Intake OCR API")

# Allow local frontend during development to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for borrower persistence
class BorrowerAddress(BaseModel):
    street: str = None
    city: str = None
    state: str = None
    zip: str = None

class BorrowerInfo(BaseModel):
    firstName: str = None
    lastName: str = None
    dateOfBirth: str = None
    ssn: str = None
    email: str = None
    phone: str = None
    address: BorrowerAddress = BorrowerAddress()
    employerName: str = None
    annualIncome: str = None
    status: str = None

# In-memory storage (replace with DB in production)
borrower_storage = {}


# ============ Helper functions for parsing OCR results ============

def find_name(lines):
    """Extract first and last name from OCR lines using various heuristics."""
    # 1) LAST, FIRST[/MIDDLE] (comma-delimited)
    for l in lines:
        s = l.strip()
        m = re.match(r'^([A-Z][A-Z\s\-\']+),\s*([A-Z][A-Z\s\-\']+)$', s)
        if m:
            last = m.group(1).title()
            first = m.group(2).split()[0].title()
            return first, last

    # 2) Capitalized words (First Last or First Middle Last)
    for l in lines:
        s = l.strip()
        if re.match(r'^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}$', s):
            parts = s.split()
            return parts[0], parts[-1]

    # 3) ALL CAPS lines with 2-3 words (common on many IDs), but exclude common words like "No"
    for l in lines:
        s = l.strip()
        if re.match(r'^[A-Z][A-Z\s\-\']{2,}$', s) and len(s.split()) <= 3 and len(s.split()) >= 2:
            parts = [p.title() for p in s.split()]
            # filter out single-letter parts and common short words
            if all(len(p) > 2 or p.lower() not in ['no', 'or', 'is', 'of'] for p in parts):
                return parts[0], parts[-1]

    # 4) 'Name: First Last' or similar labels
    for l in lines:
        m = re.search(r'Name[:\s]+([A-Za-z]+)\s+([A-Za-z]+)', l, re.I)
        if m:
            return m.group(1).title(), m.group(2).title()

    # 5) Fallback: first line containing two words with letters (require 4+ char names for real names)
    for l in lines:
        s = l.strip()
        parts = re.findall(r"[A-Za-z'-]+", s)
        if len(parts) >= 2 and all(len(p) >= 3 for p in parts[:2]):  # require 3+ char names
            return parts[0].title(), parts[1].title()

    return None, None


def find_dob(lines):
    """Extract date of birth from OCR lines."""
    for l in lines:
        # common formats YYYY-MM-DD (check first)
        m2 = re.search(r'(\d{4}-\d{2}-\d{2})', l)
        if m2:
            return m2.group(1)
        # MM/DD/YYYY or M/D/YY or MM-DD-YYYY
        m = re.search(r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', l)
        if m:
            return m.group(1)
    return None


def find_address(lines):
    """Extract street, city, state, and zip from OCR lines."""
    zip_code = None

    # 1) Look for lines like "City, ST 12345" or "City, State 12345"
    city_state_zip_re = re.compile(r"(?P<city>[A-Za-z .\-']+),\s*(?P<state>[A-Za-z]{2}|[A-Za-z .'-]{3,})\s+(?P<zip>\d{5}(?:-\d{4})?)")
    city_state_zip_re2 = re.compile(r"(?P<city>[A-Za-z .\-']+)\s+(?P<state>[A-Z]{2})\s+(?P<zip>\d{5}(?:-\d{4})?)")
    for i, l in enumerate(lines):
        s = l.strip()
        m = city_state_zip_re.search(s) or city_state_zip_re2.search(s)
        if m:
            zip_code = m.group('zip')
            city = m.group('city').strip()
            state = m.group('state').strip()
            # try to find a street line immediately before this one
            street = None
            if i > 0 and not city_state_zip_re.search(lines[i-1]):
                street = lines[i-1].strip()
            return street, city, state, zip_code

    # 2) Check adjacent lines: street line followed by "City, ST ZIP"
    for i in range(len(lines)-1):
        next_line = lines[i+1].strip()
        m = city_state_zip_re.search(next_line) or city_state_zip_re2.search(next_line)
        if m:
            street = lines[i].strip()
            zip_code = m.group('zip')
            city = m.group('city').strip()
            state = m.group('state').strip()
            return street, city, state, zip_code

    # 3) Fallback: look for a zip anywhere and return that line as address
    for l in lines:
        m = re.search(r"\b(\d{5}(?:-\d{4})?)\b", l)
        if m:
            zip_code = m.group(1)
            # try to split city/state from the same line
            parts = re.split(r'[,\n]', l)
            if len(parts) >= 2:
                city_state = parts[-2].strip()
                m2 = re.match(r"(?P<city>[A-Za-z .\-']+)\s+(?P<state>[A-Z]{2})", city_state)
                if m2:
                    return None, m2.group('city').strip(), m2.group('state').strip(), zip_code
            return l.replace(zip_code, '').strip(' ,'), None, None, zip_code

    # 4) fallback: look for street keywords
    for l in lines:
        if re.search(r'\b(St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Ln|Lane)\b', l, re.I):
            return l.strip(), None, None, zip_code

    return None, None, None, None


# ============ FastAPI endpoints ============


@app.post("/ocr/id")
async def ocr_id(file: UploadFile = File(...)):
    image_data = await file.read()

    headers = {
        "Ocp-Apim-Subscription-Key": AZURE_KEY,
        "Content-Type": "application/octet-stream"
    }
    ocr_url = AZURE_ENDPOINT.rstrip("/") + "/vision/v3.2/ocr?language=en&detectOrientation=true"

    # Use an async HTTP client so we don't block the FastAPI event loop.
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(ocr_url, headers=headers, content=image_data)
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Error contacting CV service: {e}")

    # If CV service returns non-JSON or an error status, surface a useful message
    if resp.status_code >= 400:
        try:
            err = resp.json()
        except Exception:
            err = resp.text
        raise HTTPException(status_code=502, detail={"cv_error": err})

    try:
        result = resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Invalid JSON from CV service: {e}")

    extracted_text = []
    for region in result.get("regions", []):
        for line in region.get("lines", []):
            text = " ".join([w.get("text", "") for w in line.get("words", [])])
            if text:
                extracted_text.append(text)

    # Fallback: try newer OCR keys if service returned different structure
    if not extracted_text and isinstance(result, dict):
        # Some APIs return 'readResults' or 'analyzeResult'
        read_results = result.get("recognitionResults") or result.get("readResults") or result.get("analyzeResult", {}).get("readResults")
        if read_results:
            for page in read_results:
                for line in page.get("lines", []):
                    t = line.get("text")
                    if t:
                        extracted_text.append(t)

    # Parse structured values using helper functions
    first_name, last_name = find_name(extracted_text)
    date_of_birth = find_dob(extracted_text)
    street, city, state, zip_code = find_address(extracted_text)

    return {
        "rawText": extracted_text,
        "firstName": first_name,
        "lastName": last_name,
        "dateOfBirth": date_of_birth,
        "street": street,
        "city": city,
        "state": state,
        "zip": zip_code,
    }


@app.post("/borrower")
def save_borrower(borrower: BorrowerInfo):
    """Save borrower information from OCR or manual entry."""
    borrower_id = "current"  # simplified; in production use UUID or form ID
    borrower_storage[borrower_id] = borrower.dict()
    return {"status": "saved", "borrower_id": borrower_id}


@app.get("/borrower")
def get_borrower():
    """Retrieve saved borrower information."""
    borrower_id = "current"
    if borrower_id not in borrower_storage:
        return {"status": "not_found"}
    return borrower_storage[borrower_id]