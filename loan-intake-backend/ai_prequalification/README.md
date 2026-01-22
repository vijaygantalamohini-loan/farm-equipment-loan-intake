# AI Prequalification

This module provides a minimal synthetic prequalification pipeline using the existing loan schemas.

## Regenerate synthetic data

```bash
python -m ai_prequalification.generate_synthetic_data --rows 10000
```

This writes `ai_prequalification/data/synthetic_loans.csv`.

## Retrain the model

```bash
python -m ai_prequalification.train_model --refresh-data --rows 10000
```

The model is saved to `ai_prequalification/models/prequal_model.pkl`.

## How the model is used in the API

- The `/prequalify` route loads the model on startup via `PrequalificationEngine`.
- Incoming requests are mapped into the feature vector defined in `ai_prequalification/model_features.py`.
- `predict_prequalification` returns `approval_probability`, `risk_tier`, and the `features_used` for the model.

## Explainability

- Explanations are rule-based and deterministic, derived from the same features the model uses.
- When available, permutation-based global feature importances (computed at training time) are used
  to weight the local rules.
- The API response includes `reasons` as `{code, message, weight}` so dealers see the top drivers
  for high/medium/low risk.

### Limitations

- The model is trained on synthetic data and does not reflect real underwriting outcomes.
- Explanations are heuristic and should be treated as directional rather than causal.
