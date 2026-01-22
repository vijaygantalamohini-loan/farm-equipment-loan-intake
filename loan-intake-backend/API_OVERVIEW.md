# API Overview (Loan Intake Backend)

Brief guide to the current REST endpoints for client teams (web/mobile/partners). All endpoints are JSON. Authenticated routes require a valid Azure AD token in `Authorization: Bearer <token>`.

## Auth
- `GET /auth/login` – Redirects to Azure AD login (browser flow).
- `GET /auth/callback` – Azure redirect target (browser flow).
- `POST /auth/verify` – Body: `{ "token": "<jwt>" }` → `{ access_token, salesperson { ... } }`
- `GET /auth/profile` – Returns current salesperson, location, vendor.

## Health
- `GET /healthz` – Service health and version.
- `GET /health` – Router health (basic check).

## Lookup
- `GET /lookup/serial/{serial}` – Decodes equipment serials; for 17-char VINs, calls NHTSA. Returns `{ found, make, model, year, equipmentType, serialNumber, source }`.
- `GET /lookup/naics?keyword=foo` – NAICS search.
- `GET /lookup/manufacturers` – Supported equipment manufacturers.
- `POST /ocr/id | /ocr/asset | /ocr/barcode` – Upload `file` (multipart). Returns extracted text/fields.

## Loans (protected)
All require `Authorization: Bearer <token>`.
- `POST /loans/start` – Starts draft. Optional `Idempotency-Key` header.
- `PUT /loans/{id}/save-draft` – Body: `{ borrower_type, has_coborrower, borrower_data, coborrower_data?, loan_data, dealer_data?, documents_and_consents_data? }`
- `PATCH /loans/{id}/save-draft` – Same as PUT (partial).
- `POST /loans/submit` – Body: `LoanSubmissionRequest` (same shape as draft) + optional `application_id` to resubmit draft.
- `GET /loans/my-applications` – List current salesperson’s apps.
- `GET /loans/location-applications` – List apps for salesperson’s location.
- `GET /loans/vendor-applications` – List apps for salesperson’s vendor.
- `GET /loans/dashboard` – Grouped apps by status.
- `GET /loans/{id}` – Application detail.
- `DELETE /loans/{id}` – Delete draft/in_progress app.
- `GET /loans/stats/my-stats | /location-stats | /vendor-stats` – Basic stats.
- `POST /loans/{id}/get-offers` – Returns mock lender offers for the app.
- `POST /loans/{id}/accept-offer?offer_id=XYZ` – Accepts an offer (marks app approved).

## Admin (should be secured)
Currently unprotected in code—lock down before production.
- `POST /admin/vendors` – `{ name, primary_contact?, phone?, email? }`
- `GET /admin/vendors`
- `POST /admin/locations` – `{ vendor_id, location_name, ...address }`
- `GET /admin/locations?vendor_id?&active_only?`
- `POST /admin/salespeople` – `{ location_id, email, password, first_name, last_name, phone?, employee_code? }`
- `GET /admin/salespeople?location_id?&active_only?`
- `PATCH /admin/salespeople/{id}/deactivate`

## Headers & Conventions
- Auth: `Authorization: Bearer <token>`
- Idempotency: `Idempotency-Key` header supported on loan create/save/submit.
- Request ID: `X-Request-ID` is accepted/logged (optional).

## Payload Notes
- `borrower_data`, `loan_data`, `dealer_data`, `documents_and_consents_data` are JSON objects; `loan_data` supports `purchaseAssets[]`, `tradeIns[]`, and `serialNumber` (top-level and per asset).
- Responses use simple dicts; errors follow FastAPI JSON error shape `{ detail: "..." }`.

## Example: Save Draft
```
PUT /loans/123/save-draft
Authorization: Bearer <token>
Idempotency-Key: abc123
Content-Type: application/json

{
  "borrower_type": "individual",
  "has_coborrower": false,
  "borrower_data": { "firstName": "Jane", "lastName": "Doe" },
  "loan_data": {
    "purpose": "Purchase",
    "cashDown": "10000",
    "purchaseAssets": [
      { "make": "John Deere", "model": "5075E", "year": "2021", "serialNumber": "1LV5075E..." }
    ],
    "tradeIns": [
      { "make": "Kubota", "model": "L3301", "year": "2016", "serialNumber": "KB12345" }
    ]
  },
  "dealer_data": { "dealershipName": "Green Valley", "contactPerson": "Alex Smith" }
}
```

