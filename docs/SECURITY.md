# Security

This document summarizes security-relevant behavior in the current codebase.

## Authentication and authorization

- Microsoft Entra External ID (CIAM) OAuth2 authorization code flow is handled by `loan-intake-backend/routers/azure_auth_routes.py`.
- Tokens are validated server-side in `loan-intake-backend/services/azure_ad_auth.py` using Azure JWKS and `core/dependencies.py` (`HTTPBearer`) enforces `Authorization: Bearer <token>`.
- Most loan routes require `get_current_salesperson_azure` (see `loan-intake-backend/routers/loan_routes.py`).
- Admin endpoints are protected by `X-Admin-Token` via `loan-intake-backend/core/security.py` and `loan-intake-backend/routers/admin_routes.py`.
- Optional test-token bypass exists in `loan-intake-backend/services/azure_ad_auth.py` when `ALLOW_TEST_TOKENS` is true.

## Token handling and storage

- `/auth/callback` redirects to `/auth/callback-spa` with `token` and `user` query params.
- `/auth/callback-spa` sets cookies `access_token`, `salesperson`, and `user` with `httponly=False` and `samesite=Lax`.
- Frontend stores `auth_token` and `user` in localStorage (`loan-intake-frontend/src/utils/auth.js`) and attaches the token in `Authorization` headers (`loan-intake-frontend/src/services/api.js`).
- Frontend logs token prefix and length in `loan-intake-frontend/src/utils/auth.js` (debug output).

## PII handling

- `LoanApplication.borrower_data` stores borrower data (including SSN) in JSON (`loan-intake-backend/database.py` and `loan-intake-backend/services/submit_application.py`).
- `loan-intake-frontend/src/utils/format.js` masks SSN by default (`formatSSN`).

## Secrets and external service keys

- Core app settings come from environment variables in `loan-intake-backend/core/settings.py`.
- External service keys are read from env for:
  - Azure AD client secret
  - Google Places (`GOOGLE_PLACES_API_KEY`)
  - Tractor Zoom (`TRACTOR_ZOOM_API_KEY`, `TRACTOR_ZOOM_BEARER_TOKEN`)
- OCR credentials are constants in `loan-intake-backend/services/ocr_service.py` and reused by `loan-intake-backend/services/invoice_ocr_service.py`.
- USPS user ID is a constant in `loan-intake-backend/services/usps_service.py`.
- Admin token is read from `ADMIN_API_TOKEN` (`loan-intake-backend/core/security.py`).

## CORS

- CORS is configured in `loan-intake-backend/main.py` with:
  - `CORS_ALLOW_ORIGINS` plus a regex for localhost/127.0.0.1 on ports 3000/3001.
  - `allow_credentials=True`.
  - Allowed headers include `authorization`, `content-type`, and `idempotency-key`.

## Logging and diagnostics

- Request logging redacts `authorization` headers (`loan-intake-backend/middlewares/request_logging.py`).
- Auth logs include token prefix, expected issuer/audience, and JWT header fields (`loan-intake-backend/services/azure_ad_auth.py`).
- Error logs capture request metadata in `errors.log`.

## Debug endpoints

- `/debug/*` routes are protected by `X-Admin-Token` and expose auth configuration and token checks (`loan-intake-backend/routers/debug_auth_routes.py`).
- `/health/auth-hints` returns minimal auth hints without admin auth (`loan-intake-backend/routers/health.py`).
