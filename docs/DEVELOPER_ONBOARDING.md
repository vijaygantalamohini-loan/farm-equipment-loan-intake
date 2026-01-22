# Developer Onboarding

## Prerequisites

- Python 3.9+ (backend)
- Node.js 16+ and npm (frontend)

## Repo layout

- loan-intake-backend/: FastAPI app, services, database, tests
- loan-intake-frontend/: React app, CRA scripts, Playwright tests

## Backend setup

```bash
cd loan-intake-backend
python -m venv venv
venv\Scripts\activate
# macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
```

Optional environment file:

```bash
copy .env.example .env
```

Run the API:

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
# or: python main.py
```

API docs: http://127.0.0.1:8000/docs  
Health: http://127.0.0.1:8000/healthz

## Seed data (optional)

```bash
cd loan-intake-backend
python seed_database.py
python seed_lenders.py
python seed_submitted_applications.py
python seed_large_application.py
```

## Frontend setup

```bash
cd loan-intake-frontend
npm install
npm start
```

Alternate port:

```bash
npm run start:3001
```

The CRA dev server proxies API calls to http://localhost:8000 (see package.json).

## Environment variables and keys

Backend settings (core/settings.py):

- BACKEND_URL (default http://localhost:8000)
- FRONTEND_URL (default http://localhost:3000)
- DATABASE_URL (default sqlite:///./loan_intake.db)
- CORS_ALLOW_ORIGINS (comma-separated)
- IDEMPOTENCY_TTL_SECONDS
- AZURE_AD_TENANT_NAME
- AZURE_AD_B2C_TENANT_ID
- AZURE_AD_CLIENT_ID
- AZURE_AD_CLIENT_SECRET
- AZURE_AD_POLICY_NAME
- AZURE_AD_ISSUER
- AZURE_AD_VERIFY_ISS
- AZURE_API_SCOPE
- AZURE_AUTH_MODE

External service keys:

- GOOGLE_PLACES_API_KEY (services/google_places_service.py)
- OCR credentials are constants in services/ocr_service.py: AZURE_ENDPOINT, AZURE_KEY
- USPS credentials are constants in services/usps_service.py: USPS_USER_ID

The repo includes loan-intake-backend/.env.example as a template for OCR, USPS, and Google Places values.

## Auth setup (optional)

- Azure AD setup guides: loan-intake-backend/AZURE_AD_SETUP.md and loan-intake-backend/SETUP_CHECKLIST.md

## Tests and quality checks

Backend:

```bash
cd loan-intake-backend
pytest
pytest test_main.py -v
pytest tests/test_one_click_submission.py
```

Frontend:

```bash
cd loan-intake-frontend
npm test
npm run test:fast
npm run test:e2e
npm run test:e2e:api
npm run lint
npm run format
npm run typecheck
```
