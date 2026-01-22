# Farm Equipment Loan Intake System

A full-stack loan application system with OCR-powered ID scanning for agricultural equipment financing.

## 🚀 Features

- **Automated ID Scanning**: Upload driver's license/ID images to auto-fill borrower information
- **Azure Computer Vision OCR**: Extracts name, DOB, and address from ID images
- **Multi-Step Wizard**: Borrower info → Co-borrower → Loan request → Documents & consents
- **FastAPI Backend**: Async Python API with intelligent OCR parsing heuristics
- **React Frontend**: Create React App with step-by-step form workflow
- **Unit Tests**: Comprehensive test coverage for OCR parsing logic
- **Dealer Portal Dashboard**: Dashboard feeds, stats, and resumption links for drafts, submitted apps, and funded deals.
- **Lender Offers & Routing**: Offer polling/acceptance plus lender preferences and matching APIs (`/loans/{id}/get-offers`, `/lenders/*`, `/lenders/match/*`) for downstream decisions.

## Key Workflows

### Intake + OCR

- `LoanApplicationWizard` orchestrates borrower, co-borrower, dealer, loan, and documents steps while saving drafts via `services/loans/drafts.py` and validating each stage with `src/validation/schemas.js`.
- Dealer lookup integrates Google Places (`services/google_places_service.py`, `/dealers/*` routes) so dealership data auto-fills and flows through the `dealer_data` JSON column.
- `AssetForm`, `TradeInSection`, and `LoanCalculator` auto-calc equipment/trade-in values, decode serials, and enforce validations before submission.

### One-Click Submission (Full Automation)

- One-click flow runs ID OCR + invoice OCR, AI prequalification, equipment intelligence, fraud detection, lender matching, and final submission through `services/submit_application.py`.
- Invoice OCR now extracts dealer/buyer/equipment/financial fields via Azure Computer Vision in `services/invoice_ocr_service.py`, which feeds auto-fill into the intake wizard.
- AI prequalification is proxied through `services/ai_prequal_service.py` and exposed at `POST /loans/prequalify` for structured responses.
- Equipment intelligence orchestration aggregates Tractor Zoom comparables, Ritchie Bros data, depreciation curves, and fraud flags in `services/equipment_intelligence_orchestrator.py`.
- Fraud rules (duplicate serials, hour anomalies, price anomalies, invoice tampering) live in `services/fraud_detection.py`.
- Lender auto-matching now ranks lenders by LTV, equipment type, NAICS, dealer state, and risk tier via `services/loans/matching.py`.
- UI adds a "One-Click Submit" panel inside `LoanRequestStep` to upload ID/invoice images and display AI score, valuation, fraud flags, and matched lenders.
- Test coverage for the flow is in `loan-intake-backend/tests/test_one_click_submission.py`.

### Dealer Portal & Dashboards

- `components/Dashboard.js` hits `GET /loans/dashboard` to render summary cards (total, in-progress, submitted, funded), grouped application feeds, and buttons to resume drafts or request offers while backend routing touches `routers/loan_routes.py`, `services/loans/dashboard.py`, and `utils/application_helpers.py`.
- Stats endpoints (`/loans/stats/*`, `/loans/my-applications`, `/loans/location-applications`, `/loans/vendor-applications`) keep the dealer, location, and vendor views in sync.
- E2E suites (`tests/e2e/dashboard.spec.ts`, `tests/e2e/offers.spec.ts`) safeguard the portal-to-offers journey.

### Lender Offers & Routing

- `LoanOffersView` polls `POST /loans/{application_id}/get-offers`, renders lender cards with rate/term/monthly payment, and accepts offers via `POST /loans/{application_id}/accept-offer`; backend logic lives in `services/loans/offers.py`.
- Mock lenders (`services/mock_lenders.py`) simulate AgCredit, Farm Equipment Finance, Green Valley Capital, and Prairie State Bank with underwriting rules, rate calculators, monthly payments, and staggered acknowledgments for realistic behavior.
- `components/LenderDashboard.js` reuses the dashboard payload, lists borrower/equipment details, and lets reviewers simulate approve/decline/conditional decisions.

### Lender Matching & Preferences

- `/lenders/{id}/preferences`, `/lenders/match/{application_id}`, and `/lenders/matches/{application_id}` connect `routers/lender_routes.py` with `services/loans/matching.py`, which compares loan amount, LTV, equipment type, NAICS, and dealer state against persisted preference filters (`database.py`).
- `LenderPreferences` mirrors those filters (amount, equipment types, states, NAICS) and is ready to POST updates once wired.
- Preference/persona architecture (applicant, dealer, lender, admin) and indexing strategies appear in `ARCHITECTURE_PERSONAS_AND_PREFS.md`, with setup/migration details in `SETUP_CHECKLIST.md`, `MULTI_TENANT_SETUP.md`, and `MIGRATION_SUMMARY.md`.

## 📁 Project Structure

```
FarmEquipment/
├── loan-intake-backend/       # FastAPI backend
│   ├── main.py               # API endpoints & OCR logic
│   ├── test_main.py          # Unit tests
│   ├── .env.example          # Environment template
│   └── requirements.txt      # Python dependencies
└── loan-intake-frontend/      # React frontend
    ├── src/
    │   ├── components/       # Form step components
    │   └── LoanApplicationWizard.js
    ├── package.json
    └── README.md
```

## 🛠️ Setup

### Prerequisites

- Python 3.9+
- Node.js 16+
- Azure Computer Vision API key ([Get one here](https://portal.azure.com))

### Backend Setup

1. **Navigate to backend folder**:
   ```bash
   cd loan-intake-backend
   ```

2. **Create virtual environment** (optional but recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your Azure credentials:
   ```
   AZURE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
   AZURE_KEY=your_subscription_key_here
   ```

5. **Run tests** (optional):
   ```bash
   pytest test_main.py -v
   ```

6. **Start the API server**:
   ```bash
   uvicorn main:app --reload --host 127.0.0.1 --port 8000
   ```
   API will be available at http://127.0.0.1:8000
   OpenAPI docs at http://127.0.0.1:8000/docs

### Frontend Setup

1. **Navigate to frontend folder**:
   ```bash
   cd loan-intake-frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm start
   ```
   App will open at http://localhost:3000

## 🎯 Usage

1. **Start both servers** (backend on :8000, frontend on :3000)
2. **Open** http://localhost:3000 in your browser
3. **Borrower Info Step**:
   - Click "Scan ID / Upload Image"
   - Upload a clear photo of a driver's license or ID
   - Fields auto-populate from OCR (name, DOB, address)
   - Review/edit and click "Next"
4. **Complete remaining steps**: Co-borrower, loan details, documents

## Post-Intake Workflows

The intake wizard is only the first mile; submitted applications feed into a dealer portal, lender offers circuits, and matching layers that tie the whole experience together.

### Dealer Portal & Dealer Data

- The React `Dashboard` (`loan-intake-frontend/src/components/Dashboard.js`) calls `GET /loans/dashboard`, renders summary cards for total / in-progress / submitted / funded numbers, and shows application cards that let agents resume drafts or request loan offers. The FastAPI handler (`loan-intake-backend/routers/loan_routes.py`) leans on `services/loans/dashboard.py` and `utils/application_helpers.py` to group work by status and shape the payload.
- Dealer metadata survives the intake steps via `LoanApplicationWizard` → `DealerInfoStep`, which auto-saves to localStorage, auto-validates addresses, and can autofill from saved profiles. The backend persists that info in the `dealer_data` JSON column so drafts, submissions, matching, and offer generation all retain the dealer’s name, contact, and address.
- Dealer lookup integrates Google Places: `loan-intake-backend/services/google_places_service.py`, `routers/dealer_routes.py`, and `GOOGLE_PLACES_SETUP.md` document `/dealers/search`, `/dealers/details/{place_id}`, and `/dealers/nearby`, which power the “Find dealer” experience during intake.
- E2E suites such as `loan-intake-frontend/tests/e2e/dashboard.spec.ts` and `tests/e2e/offers.spec.ts` assert the dashboard loads, lets a dealer reopen an application, and shows the offers screen after submission so the portal stay tied to the intake flow.

### Lender Submission & Response Flow

- `LoanOffersView` (`loan-intake-frontend/src/components/LoanOffersView.js`) polls `POST /loans/{application_id}/get-offers`, highlights approved/conditional/declined counts, renders lender cards with rate/term/monthly payment/conditions, and lets dealers accept approved or conditional offers through `POST /loans/{application_id}/accept-offer`. Backend acceptance logic lives in `services/loans/offers.py`, which updates the application status and persists the accepted offer metadata.
- Offers are generated by the mock lenders (`loan-intake-backend/services/mock_lenders.py`) that encode heuristics for AgCredit, Farm Equipment Finance, Green Valley Capital, and Prairie State Bank, stagger acknowledgements, and return deterministic offer IDs so the UI can display realistic lender reactions without live integrations.
- The (mock) `LenderDashboard` (`loan-intake-frontend/src/components/LenderDashboard.js`) reuses the same `/loans/dashboard` feed, lists each application with borrower/equipment/status, and lets the reviewer simulate Approve/Decline/Conditional decisions, which is a stepping stone toward a true lender-facing review panel.
- The Equipment Intelligence module (`equipment_intelligence/`) merges scraped auction data, rule-based heuristics, and ML models to report blended valuation, serial validity, history context, predictive resale, and risk flags via `POST /equipment/intelligence`. The backend route feeds the new panel inside `LoanRequestStep`, letting dealers see equipment insights alongside the AI prequalification signal.

### Lender Preferences & Matching

- `loan-intake-backend/routers/lender_routes.py` exposes lender CRUD, preference persistence (`/lenders/{id}/preferences`), and matching endpoints (`/lenders/match/{application_id}` plus `/lenders/matches/{application_id}`) that invoke `services/loans/matching.py`. That matcher compares loan amount/LTV, equipment type, NAICS, and dealer state against lender filters and records `LenderMatch` rows for transparency.
- The front-end `LenderPreferences` form (`loan-intake-frontend/src/components/LenderPreferences.js`) mirrors those filters (amount ranges, equipment types, states, NAICS) and is the placeholder UI that will eventually POST updates to the backend.
- Matching rationale and persona data are described in `ARCHITECTURE_PERSONAS_AND_PREFS.md`, which also covers the multi-tenant role tables (applicant, dealer, lender, admin) and preference indexing strategy used across dashboards and APIs.

### AI Prequalification & Signals

- The new AI module (see `AI_PREQUALIFICATION.md`) trains Gradient Boosting models on synthetic loan data and serves `/prequalify`, returning approvals, risk scores, flags, and suggested down payment/term combinations for any loan request payload.
- `LoanRequestStep` now runs this endpoint as users enter assets, down payment, term, income, and equipment details, so the form renders an “AI Pre-Qualification” panel with the approval probability, risk tier, flags, and recommended structure before submission.
- The dashboard surfaces an “AI Score” row (color-coded by risk tier) and the offers view highlights a warning when the stored AI probability dips below 40% so dealers can adjust down payment/term before requesting lender offers.
- The backend includes the AI score in `/loans/{id}/get-offers`, letting the dealer portal and lender dashboards make decisions with both manual data and the AI signal.

### API & Integration Docs

- `loan-intake-backend/API_OVERVIEW.md` walks through every FastAPI route (auth, lookup, loans, stats, dashboard, lenders, dealers, admin) plus header conventions (`Authorization`, `Idempotency-Key`, `X-Request-ID`) and payload shapes for drafts/submissions/offers.
- Deployment/setup notes live in `SETUP_CHECKLIST.md`, `MULTI_TENANT_SETUP.md`, and `MIGRATION_SUMMARY.md`, while `PLATFORM_VISION.md` and `ARCHITECTURE_PERSONAS_AND_PREFS.md` explain the personas, dashboards, and lender strategy that underpin the experience.

## 🔌 API Endpoints

- `POST /ocr/id` - Upload ID image, returns extracted fields
- `POST /borrower` - Save borrower information
- `GET /borrower` - Retrieve saved borrower data
- `GET /docs` - Interactive API documentation

## 🧪 Testing

Run backend unit tests:
```bash
cd loan-intake-backend
pytest test_main.py -v
```

Run frontend tests:
```bash
cd loan-intake-frontend
npm test
```

## 📝 Environment Variables

### Backend (.env)

```bash
AZURE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_KEY=your_azure_cv_subscription_key
```

⚠️ **Never commit `.env` to version control!** Use `.env.example` as a template.

## 🚢 Deployment

### Backend (Python/FastAPI)

- Deploy to Azure App Service, AWS Lambda, or Heroku
- Set environment variables in your hosting platform
- Example (Azure):
  ```bash
  az webapp config appsettings set --name myapp --resource-group mygroup \
    --settings AZURE_ENDPOINT=https://... AZURE_KEY=...
  ```

### Frontend (React)

- Build for production:
  ```bash
  cd loan-intake-frontend
  npm run build
  ```
- Deploy `build/` folder to Netlify, Vercel, or Azure Static Web Apps

## 🔐 Security Notes

- `.env` file is gitignored - never commit secrets
- OCR API key stays on backend (not exposed to browser)
- CORS is configured for localhost:3000 and :3001 (update for production)
- Use HTTPS in production

## 🛠️ Technology Stack

**Backend**:
- FastAPI
- Python 3.9+
- Azure Computer Vision SDK
- httpx (async HTTP)
- pytest

**Frontend**:
- React 19
- Create React App
- Fetch API

## 📄 License

MIT License - feel free to use for your projects

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📧 Support

For issues or questions, please open an issue on GitHub.

---

Built with ❤️ for agricultural equipment financing
