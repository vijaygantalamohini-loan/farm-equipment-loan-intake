# Extending Platform

This guide describes how to extend the platform using existing code patterns.

## Add OCR fields

### ID OCR fields

1. Add parsing logic in `loan-intake-backend/services/ocr_parser.py` (new helper or extend `find_name`, `find_dob`, `find_address`).
2. Expose the new value in `loan-intake-backend/routers/ocr_routes.py` under `POST /ocr/id`.
3. Map the new field into the UI in `loan-intake-frontend/src/components/LoanApplicationWizard.js` (see `applyOcrResults`).
4. If the field should expose confidence, extend `parse_id_fields_with_confidence` and include it in the `fields` response.

### Invoice OCR fields

There are two invoice extraction paths:

- One-click pipeline: `loan-intake-backend/services/invoice_ocr_service.py`
- /ocr/asset endpoint: `loan-intake-backend/services/invoice_parser.py` and `loan-intake-backend/routers/ocr_routes.py`

To add a field:

1. Extend the parser in `loan-intake-backend/services/invoice_ocr_service.py` (for one-click).
2. If the field should also appear in `/ocr/asset`, extend `loan-intake-backend/services/invoice_parser.py` and the response in `loan-intake-backend/routers/ocr_routes.py`.
3. Map the new value into the UI in `loan-intake-frontend/src/components/LoanApplicationWizard.js`.
4. If the new field should influence one-click payloads, update `loan-intake-backend/services/submit_application.py` to map it into borrower, equipment, trade-in, or loan data.
5. Include confidence values in `field_confidence`/`fields` so UI can show trust levels.

## Add new lenders

Lenders and preferences are stored in `loan-intake-backend/database.py` as `Lender` and `LenderPreference`.

Options:

- Seed data locally in `loan-intake-backend/seed_lenders.py`.
- Create lenders at runtime via `POST /lenders/` and `POST /lenders/{id}/preferences` (`loan-intake-backend/routers/lender_routes.py`).

Matching logic lives in `loan-intake-backend/services/loans/matching.py`.

If you introduce a new preference dimension:

1. Add the field to `LenderPreference` in `loan-intake-backend/database.py`.
2. Update the request model in `loan-intake-backend/routers/lender_routes.py`.
3. Update `_matches_preferences` and `rank_lenders_with_scores` in `loan-intake-backend/services/loans/matching.py`.

## Add new fraud rules

Fraud rules live in `loan-intake-backend/services/fraud_detection.py` in `evaluate_fraud_flags`.

To add a rule:

1. Add logic in `evaluate_fraud_flags`.
2. Return flags with the existing shape: `{code, message, severity}`.
3. If your rule needs new input data, pass it from:
   - `loan-intake-backend/services/submit_application.py`
   - `loan-intake-backend/services/equipment_intelligence_orchestrator.py`

Behavioral fraud signals (submission volume, borrower decline history, upload retry counts, IP risk scores)
are stubbed in `compute_behavioral_signals` and can be wired to real telemetry once available.
Image tampering heuristics are computed in `loan-intake-backend/services/ocr_service.py` and
`loan-intake-backend/services/invoice_ocr_service.py`.

## OCR confidence

OCR confidence is derived from Azure word-level confidences when available. The backend aggregates
line-level confidence and exposes `fields` with `{value, confidence}` plus `needs_review` arrays
when confidence falls below the threshold (default 0.7).

## Add equipment intelligence sources

There are two orchestration paths:

- `/equipment/intelligence` uses `loan-intake-backend/equipment_intelligence/orchestrator/intelligence_orchestrator.py` and the modules under `loan-intake-backend/equipment_intelligence/modules/`.
- One-click uses `loan-intake-backend/services/equipment_intelligence_orchestrator.py` and calls `services/tractor_zoom_service.py` plus `services/ritchie_bros_scraper.py`.

To add a new source:

1. Add a fetcher in `loan-intake-backend/services/` or a scraper in `loan-intake-backend/equipment_intelligence/data_ingestion/`.
2. Normalize the output (see `_normalize_comparables` patterns).
3. Wire it into the appropriate orchestrator and merge into the comparables list.
4. Adjust confidence scoring if the source should affect it.
5. Extend tests under `loan-intake-backend/equipment_intelligence/tests/` when applicable.

## Add dashboard cards

Dashboard totals and grouping:

- `loan-intake-backend/services/loans/dashboard.py`
- `loan-intake-backend/utils/application_helpers.py`

Dashboard card UI:

- `loan-intake-frontend/src/components/Dashboard.js`
- `loan-intake-frontend/src/components/Dashboard.css`

If a new card requires additional per-application fields, update:

- `loan-intake-backend/utils/responses.py` (`ResponseFormatter.format_dashboard_application`)

Keep the summary response structure consistent with the frontend expectations.
