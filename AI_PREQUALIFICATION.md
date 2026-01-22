# AI Prequalification

## Overview

The AI prequalification module lives under `loan-intake-backend/ai_prequalification`. It trains Gradient Boosting models on synthetic tractor/equipment financing data and exposes a FastAPI endpoint (`POST /prequalify`) that returns an approval probability, risk score, flags, and a suggested loan structure (down payment, term, monthly payment).

This pipeline keeps the eyeballs on borrower/income inputs, trade-in status, LTV, and equipment details so downstream workflows (dashboard, offers engine) can surface an AI score alongside the manual underwriting tools you already have.

## Model Inputs

- `loan_amount`: derived from the current equipment total minus trade-ins/down payment
- `equipment_list`: each asset includes `type`, `year`, `value`, `isNew`, `serialNumber`
- `borrower_income`, `credit_score`
- `down_payment`
- `naics_code`, `state`, `trade_in_present`
- `loan_term_months`

Categorical features (equipment type, state, NAICS) are encoded with one-hot encoding, and numeric features are scaled before Gradient Boosting models are trained.

## Model Outputs

- **Approval probability** (`approval_probability_model.pkl`): binary classifier scoring the likelihood of approval between 0–1.
- **Risk score** (`risk_score_model.pkl`): regressor producing a 0–100 risk metric that also drives the risk tier and flags (high LTV, low down payment, old equipment, missing serial, trade-in, low income/credit).
- **Optimal structure** (`optimal_structure_model.pkl`): multi-output regressor that predicts a recommended down payment percent and term, which the runtime engine converts to actual dollar amounts and an estimated monthly payment.

The runtime engine (`prequalification_engine.py`) wires the models together, enriches the output with risk flags from `utils/scoring_helpers.py`, and formats the API response captured by `/prequalify`.

## Running Training

1. Generate or refresh training data (already committed as `sample_training_data.csv` with ~500 synthetic rows). If you want to create a new dataset, run:
   ```bash
   cd loan-intake-backend
   python ai_prequalification/generate_sample_data.py
   ```

2. Train all models:
   ```
   python ai_prequalification/model_training.py
   ```
   This writes `approval_probability_model.pkl`, `optimal_structure_model.pkl`, and `risk_score_model.pkl` to `ai_prequalification/models/`. The FastAPI engine loads these pickles at startup.

3. Make sure `pandas`, `scikit-learn`, and `joblib` are installed (`requirements.txt` now includes them).

## API Contract

- **Endpoint**: `POST /prequalify`
- **Request**: matches `ai_prequalification.schemas.PrequalificationRequest` (loan amount, equipment list, borrower income/credit, down payment, NAICS, state, trade-in flag, term)
- **Response**: `approval_probability`, `risk_score`, `risk_tier`, `flags`, and an `optimal_structure` block with recommended down payment, term, and expected monthly payment.

## Extending the Module

- **Add features**: augment `sample_training_data.csv` with new columns (e.g., collateral aging, dealership tier) and adjust `model_training.py` to include them in the preprocessor and pipeline.
- **Improve scoring**: update `utils/scoring_helpers.py` to add additional flags or use more nuanced thresholds (e.g., owner occupancy or NAICS-specific credit floors).
- **Serve alternative models**: swap out the Gradient Boosting models for `CatBoost`/`XGBoost` by changing the pipeline in `model_training.py` and ensuring the runtime engine loads the new pickles.
- **Expose more signals**: surface extra fields in the `/prequalify` response (e.g., `suggested_interest_rate`) by extending `PrequalificationResponse` and the engine’s output dict.

## Documentation Links

- Sample data generation: `ai_prequalification/generate_sample_data.py`
- Training orchestration: `ai_prequalification/model_training.py`
- Runtime engine/responses: `ai_prequalification/prequalification_engine.py`, `ai_prequalification/routes.py`, `utils/scoring_helpers.py`
- Frontend integrations: `loan-intake-frontend/src/components/LoanRequestStep.js`, `LoanOffersView.js`, `Dashboard.js`
