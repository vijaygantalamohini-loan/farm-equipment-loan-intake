# Personas and Lender Preferences — Loan Intake

This document defines core personas, required capabilities, and a minimal API/data design to support role-based access and lender interest filtering.

## Personas

1. Applicant/Borrower
- Create/resume applications
- Upload documents and give consents
- View application status and past applications

2. Dealer (Vendor/Location/Salesperson)
- Start/resume applications on behalf of customers
- Enter equipment details; coordinate documents
- View applications for assigned location(s)

3. Lender
- Configure interest preferences (min loan amount, LTV range, equipment types, NAICS, states)
- Receive/match incoming applications based on preferences
- Acknowledge offers and view applicant details as allowed

4. Customer Portal Viewer
- Self-service view of application status and history

## RBAC (Role-Based Access Control)

- Roles table: `roles(id, key, description)` → keys: `applicant`, `dealer`, `lender`, `customer_viewer`, `admin`.
- User-role mapping: `user_roles(user_id, role_id)`; for Azure AD, map groups to roles via config.
- Authorization: existing FastAPI `dependencies.get_current_user()` returns claims; gate router endpoints by role.

## Lender Preferences Schema

Table: `lender_preferences`
- `id` (PK)
- `lender_id` (FK → users or lenders table)
- `min_loan_amount` (numeric)
- `max_loan_amount` (numeric, optional)
- `ltv_min` (decimal 0..1)
- `ltv_max` (decimal 0..1)
- `equipment_types` (array/json)
- `naics_codes` (array/json)
- `states` (array/json)
- `created_at`, `updated_at`

Indexes: `lender_id`, GIN on arrays for fast membership checks.

## Matching Service

Function: `match_application_to_lenders(application) -> List[Lender]`
- Compute `loan_amount` from application
- Compute `LTV = loan_amount / app.estimated_value_total`
- Filter lenders where:
  - `min_loan_amount <= loan_amount <= max_loan_amount (if set)`
  - `ltv_min <= LTV <= ltv_max`
  - `equipment_types` contains app.asset.equipment_type (if set)
  - `naics_codes` contains app.loan.naics_code (if set)
  - `states` contains app.dealer.address.state (if set)
- Persist matches for dashboard feeds (optional) or compute on demand

Routes (new):
- `GET /lenders/preferences` → list current user's lender prefs
- `POST /lenders/preferences` → create/update
- `GET /lenders/matches/{application_id}` → show why app matched or not

## Customer Portal

Routes:
- `GET /me/applications` → list applications by current applicant
- `GET /me/applications/{id}` → details + status timeline

Frontend (CRA):
- Add `My Applications` page in dashboard: cards with status, submitted date, and offer/acknowledgment badges.

## Dealer Screens

- Dealer dashboard filtered by location; actions to start/resume and view status.

## Implementation Notes

- Place SQLAlchemy models under `services/` and `schemas/` respecting current layout.
- Use Alembic migration for `lender_preferences`.
- Integrate matching in `services/loans/offers.py` or `services/loans/stats.py`.
- Respect existing idempotency and ResponseFormatter patterns.

## Acceptance Criteria

- Lender can set preferences via API/UI and see matched applications.
- Applicant can view status and history.
- Dealers can manage applications for their location.
- RBAC enforced for all new routes.
