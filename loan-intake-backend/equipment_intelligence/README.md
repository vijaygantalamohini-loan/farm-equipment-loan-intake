# Equipment Intelligence

This package synthesizes auction data, business rules, and machine learning to surface enrichment on every piece of equipment.

## Structure

- `data_ingestion/`: scrapers that gather auction/listing data plus synthetic gap filling; `combine_datasets.py` merges the feeds.
- `rules_engine/`: rule-based logic (serial decoding, valuation adjustments, depreciation, risk flags).
- `ml_models/`: training scripts that persist `*.pkl` models for valuation, resale, fraud detection, and approval signaling.
- `modules/`: runtime wrappers around rules + ML to generate a holistic output per equipment piece.
- `orchestrator/`: `intelligence_orchestrator` runs all modules in parallel, adds risk flags, and returns a single report.
- `api/`: FastAPI router/schemas to expose `/equipment/intelligence`.
- `tests/`: lightweight tests that validate each layer/aggregation.

## Running

1. Generate datasets via `combine_datasets.py` and `sample_synthetic_data.py`.
2. Train the ML stacks (`train_valuation_model.py`, `train_resale_model.py`, `train_fraud_model.py`, `train_approval_model.py`) and ensure the resulting pickles land in `ml_models/models/`.
3. Start the API server and POST to `/equipment/intelligence` to get valuation + serial + history + resale + risk flags.

## API

-+- **Endpoint**: `POST /equipment/intelligence`
- **Inputs**: make, model, year, hours, serial, region, condition, loan amount, LTV.
- **Outputs**: blended valuation, serial confidence metadata, history timeline, predictive resale estimate, risk flags, overall confidence.

Future follow-ups could wire `fraud_model.pkl` + `approval_model.pkl` to lending decisions, surface the intelligence payload in the dashboard, and schedule nightly retraining jobs using richer market data.
