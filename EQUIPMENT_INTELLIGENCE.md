# Equipment Intelligence Overview

This section describes the new equipment intelligence layer that aggregates auction data, business rules, and ML models to help dealers understand equipment risk, value, and resale potential.

## Architecture

- **Data ingestion** scrapers pull TractorZoom, Ritchie Bros, Machinery Pete, Fastline, and Facebook Marketplace data; `combine_datasets.py` merges them into a single CSV and `sample_synthetic_data.py` fills gaps with synthetic rows.
- **Rules engine** includes serial decoding, valuation logic, depreciation curves, and risk flag helpers that capture domain heuristics (e.g., high LTV, old equipment, missing serials).
- **ML models** train RandomForest/GradientBoosting regressors for valuation/resale prediction, IsolationForest/OneClassSVM for anomaly detection, and a GradientBoostingClassifier for basic approval modeling.
- **Modules** wrap the rules + models to return consistent payloads (valuation, serial intel, history, resale).
- **Orchestrator** runs the modules in parallel and returns a unified intelligence report with risk flags and overall confidence.
- **API** exposes `POST /equipment/intelligence` to receive equipment details plus loan context and respond with blended valuations, serial metadata, history, predictive resale, and flags.
- **Frontend** surfaces an Equipment Intelligence panel while the user is building the loan request, complementing the AI prequalification panel.
- **Tests** cover valuation, serial decoding, history tracking, resale, and orchestrator merging.

## Running the pipeline

1. Use the ingestion helpers to gather market data and build `combined_equipment_dataset.csv`.
2. Train the ML stacks (valuation, resale, fraud, approval) so the pickles in `equipment_intelligence/ml_models/models/` remain fresh.
3. Start the backend; `/equipment/intelligence` will call the orchestrator and return JSON for the UI.
4. On the front-end, the new Equipment Intelligence panel shows valuation, confidence, serial validity, resale, and risk flags as soon as the dealer enters equipment data.

Focus on keeping the dataset current (weekly ingestion), retraining the ML models monthly, and tuning the risk rules to match lender appetite. This intelligence feed can eventually augment lender routing and offer acceptance decisions.
