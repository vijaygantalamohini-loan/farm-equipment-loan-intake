from services.ocr_service import _extract_lines_from_azure_result
from services.ocr_parser import parse_id_fields_with_confidence, apply_confidence_threshold
from services.invoice_parser import extract_invoice_details_with_confidence


def test_id_ocr_confidence_thresholds():
    azure_result = {
        "regions": [
            {
                "lines": [
                    {
                        "words": [
                            {"text": "DOE,", "confidence": 0.95},
                            {"text": "JOHN", "confidence": 0.9},
                        ]
                    },
                    {
                        "words": [
                            {"text": "DOB", "confidence": 0.7},
                            {"text": "01/02/1980", "confidence": 0.62},
                        ]
                    },
                    {
                        "words": [
                            {"text": "SSN", "confidence": 0.5},
                            {"text": "123-45-6789", "confidence": 0.4},
                        ]
                    },
                    {
                        "words": [
                            {"text": "123", "confidence": 0.8},
                            {"text": "MAIN", "confidence": 0.82},
                            {"text": "ST", "confidence": 0.79},
                        ]
                    },
                    {
                        "words": [
                            {"text": "OMAHA,", "confidence": 0.78},
                            {"text": "NE", "confidence": 0.8},
                            {"text": "68102", "confidence": 0.83},
                        ]
                    },
                ]
            }
        ]
    }

    lines = _extract_lines_from_azure_result(azure_result)
    fields = parse_id_fields_with_confidence(lines)
    fields, needs_review = apply_confidence_threshold(fields, threshold=0.7)

    assert fields["firstName"]["value"] == "John"
    assert fields["lastName"]["value"] == "Doe"
    assert fields["ssn"]["needs_review"] is True
    assert any(item["field"] == "ssn" for item in needs_review)


def test_invoice_confidence_flags_low_price():
    lines = [
        {"text": "Serial No: ABC123", "confidence": 0.92},
        {"text": "Price: $120,000", "confidence": 0.55},
        {"text": "Invoice # INV-100", "confidence": 0.88},
    ]

    details = extract_invoice_details_with_confidence(lines)
    fields, needs_review = apply_confidence_threshold(details["fields"], threshold=0.7)

    assert fields["price"]["value"] == "$120,000"
    assert fields["price"]["needs_review"] is True
    assert any(item["field"] == "price" for item in needs_review)
