# One-Click Submission Sequence

This document reflects the actual execution flow in `services/submit_application.py`
and the supporting services it calls.

## Execution order (code-accurate)

1. `POST /loans/one-click-submit` enters `routers/loan_routes.py`.
2. `one_click_context` injects DB + salesperson into `submit_application.run_one_click_submission`.
3. ID OCR:
   - `services/ocr_service.extract_text_from_id` sends the image to Azure Computer Vision OCR.
   - `services/ocr_parser.find_name`, `find_dob`, `find_address`, plus `_extract_ssn` parse fields.
4. Invoice OCR:
   - `services/invoice_ocr_service.extract_invoice_data` calls Azure Read API and normalizes invoice fields.
5. Auto-fill payloads are constructed for borrower, equipment, loan, dealer.
6. AI prequalification:
   - `services/ai_prequal_service.run_prequalification` calls `POST /prequalify` and normalizes the response.
7. Equipment intelligence:
   - `services/equipment_intelligence_orchestrator.run_equipment_intelligence` runs valuation,
     Tractor Zoom comparables, Ritchie Bros comparables, depreciation curves, and an internal fraud check.
8. Fraud detection:
   - `services/fraud_detection.evaluate_fraud_flags` runs invoice-based rules.
9. Lender matching:
   - `services/loans/matching.rank_lenders_with_scores` scores active lenders using LTV, type, NAICS,
     dealer state, and risk tier.
10. Final submission:
    - `services/loans/submit.submit` persists the application.
11. Response returns borrower, equipment, trade-in, AI prequal, intelligence, fraud flags,
    lender matches, and submission payload.

## Sequence diagram (Mermaid)

```mermaid
sequenceDiagram
    autonumber
    participant UI as Frontend
    participant Loans as /loans/one-click-submit
    participant Orchestrator as submit_application.run_one_click_submission
    participant IdOCR as ocr_service.extract_text_from_id
    participant Azure as Azure Computer Vision
    participant InvOCR as invoice_ocr_service.extract_invoice_data
    participant PrequalSvc as ai_prequal_service.run_prequalification
    participant PrequalAPI as /prequalify
    participant Equip as equipment_intelligence_orchestrator.run_equipment_intelligence
    participant Val as valuation_module
    participant TZ as tractor_zoom_service.get_comparables
    participant RB as ritchie_bros_scraper.fetch_multiple
    participant Dep as depreciation_rules
    participant Fraud as fraud_detection.evaluate_fraud_flags
    participant Match as matching.rank_lenders_with_scores
    participant Submit as loans.submit.submit
    participant DB as Database

    UI->>Loans: POST id_image + invoice_image
    Loans->>Orchestrator: run_one_click_submission

    Orchestrator->>IdOCR: extract_text_from_id(bytes)
    IdOCR->>Azure: OCR (ID)
    Azure-->>IdOCR: rawText
    IdOCR-->>Orchestrator: rawText lines

    Orchestrator->>InvOCR: extract_invoice_data(bytes)
    InvOCR->>Azure: Read API (invoice)
    Azure-->>InvOCR: readResults
    InvOCR-->>Orchestrator: invoice fields

    Orchestrator->>PrequalSvc: run_prequalification(payload)
    PrequalSvc->>PrequalAPI: POST /prequalify
    PrequalAPI-->>PrequalSvc: approval + risk + optimal_structure
    PrequalSvc-->>Orchestrator: approval_probability + risk_tier + flags + recommendations

    Orchestrator->>Equip: run_equipment_intelligence
    par valuation
        Equip->>Val: valuation_module(...)
        Val-->>Equip: valuation
    and Tractor Zoom comparables
        Equip->>TZ: get_comparables(...)
        TZ-->>Equip: comparables
    and Ritchie Bros comparables
        Equip->>RB: fetch_multiple(...) or sample
        RB-->>Equip: comparables
    end
    Equip->>Dep: apply depreciation curve
    Equip->>Fraud: evaluate_fraud_flags (comparables-based)
    Equip-->>Orchestrator: valuation + comparables + resale + fraud_flags

    Orchestrator->>Fraud: evaluate_fraud_flags (invoice-based)
    Fraud-->>Orchestrator: fraud flags

    Orchestrator->>Match: rank_lenders_with_scores
    Match->>DB: query lenders/preferences
    DB-->>Match: lenders
    Match-->>Orchestrator: ranked matches

    Orchestrator->>Submit: submit(...)
    Submit->>DB: insert LoanApplication
    DB-->>Submit: committed
    Submit-->>Orchestrator: submission response

    Orchestrator-->>Loans: one-click payload
    Loans-->>UI: response
```
