# Scaling

This document summarizes scaling-relevant behavior from the current codebase.

## Async I/O and concurrency

- FastAPI route handlers are async, and network calls use `httpx.AsyncClient` in:
<!-- AUTO-GENERATED: ASYNC_CLIENTS_START -->
  - `loan-intake-backend\.venv\Lib\site-packages\dns\asyncquery.py`
  - `loan-intake-backend\.venv\Lib\site-packages\httpx\_client.py`
  - `loan-intake-backend\.venv\Lib\site-packages\httpx\_transports\asgi.py`
  - `loan-intake-backend\services\address_provider.py`
  - `loan-intake-backend\services\ai_prequal_service.py`
  - `loan-intake-backend\services\google_places_service.py`
  - `loan-intake-backend\services\invoice_ocr_service.py`
  - `loan-intake-backend\services\ocr_service.py`
  - `loan-intake-backend\services\ritchie_bros_scraper.py`
  - `loan-intake-backend\services\tractor_zoom_service.py`
  - `loan-intake-backend\services\usps_service.py`
  - `loan-intake-backend\services\vin_service.py`
<!-- AUTO-GENERATED: ASYNC_CLIENTS_END -->
- `loan-intake-backend/services/equipment_intelligence_orchestrator.py` runs valuation + comparables in parallel with `asyncio.gather` and uses `asyncio.to_thread` for CPU-bound valuation.
- `loan-intake-backend/equipment_intelligence/orchestrator/intelligence_orchestrator.py` uses `ThreadPoolExecutor` to run valuation, history, and resale modules concurrently.

## Caching and reuse

- Azure JWKS keys are cached via `lru_cache` in `loan-intake-backend/services/azure_ad_auth.py`.
- `PrequalificationEngine` is initialized once in `loan-intake-backend/utils/responses.py` and reused for dashboard scoring (toggle via `DISABLE_PREQUAL_ENGINE`).
- Idempotency keys are stored with TTL in `loan-intake-backend/services/loans/idempotency.py` to prevent duplicate draft/start/submit processing.

## Pagination and limits

- `GET /loans/my-applications`, `/loans/location-applications`, and `/loans/vendor-applications` accept a `limit` parameter with defaults defined in `loan-intake-backend/utils/constants.py` and enforced via `.limit()` in `loan-intake-backend/services/loans/stats.py`.
- Mock offer generation caps top offers using `limit=3` in `loan-intake-backend/services/mock_lenders.py`.

## Batching and throttling

- Tractor Zoom API calls add a short random delay in `loan-intake-backend/services/tractor_zoom_service.py`.
- Ritchie Bros scraping throttles between pages and processes pages sequentially in `loan-intake-backend/services/ritchie_bros_scraper.py`.
- Equipment intelligence merges comparables into a single list and computes summary statistics once per request.

## Database and storage

- `loan_applications` stores borrower, loan, dealer, and consents as JSON blobs (`loan-intake-backend/database.py`), so filtering is done in application code.
- SQLite is the default for development; `loan-intake-backend/database.py` notes switching to PostgreSQL for production.

## Matching engine

- Lender matching reads preferences from SQL tables and computes LTV + rule-based scores in `loan-intake-backend/services/loans/matching.py`.
- Ranked results are returned in-memory; match records are persisted in `lender_matches`.
