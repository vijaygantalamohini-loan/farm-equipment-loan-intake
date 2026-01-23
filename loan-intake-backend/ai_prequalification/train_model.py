from __future__ import annotations

import argparse
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import roc_auc_score
from sklearn.inspection import permutation_importance
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from ai_prequalification.generate_synthetic_data import generate_synthetic_data
from ai_prequalification.model_features import (
    FEATURE_COLUMNS,
    NUMERIC_FEATURES,
    CATEGORICAL_FEATURES,
)


BASE_DIR = Path(__file__).parent
DATA_PATH = BASE_DIR / "data" / "synthetic_loans.csv"
MODEL_PATH = BASE_DIR / "models" / "prequal_model.pkl"


def _count_flags(raw: str) -> int:
    if not raw:
        return 0
    return len([flag for flag in str(raw).split(";") if flag.strip()])


def load_training_data(path: Path = DATA_PATH) -> pd.DataFrame:
    df = pd.read_csv(path)
    df["risk_flag_count"] = df["risk_flags"].apply(_count_flags)
    df["prior_defaults"] = df["prior_defaults"].astype(int)
    df["bankruptcy_history"] = df["bankruptcy_history"].astype(int)
    return df


def build_preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            ("numeric", StandardScaler(), NUMERIC_FEATURES),
            ("categorical", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
        ],
        remainder="drop",
    )


def train_model(
    data_path: Path = DATA_PATH,
    model_path: Path = MODEL_PATH,
    refresh_data: bool = False,
    num_samples: int = 10_000,
    random_state: int = 42,
) -> None:
    if refresh_data or not data_path.exists():
        generate_synthetic_data(
            num_samples=num_samples,
            output_path=data_path,
            random_state=random_state,
        )

    df = load_training_data(data_path)
    X = df[FEATURE_COLUMNS]
    y = df["approved"].astype(int)

    X_train, X_val, y_train, y_val = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=random_state,
        stratify=y,
    )

    pipeline = Pipeline(
        steps=[
            ("preprocessor", build_preprocessor()),
            ("model", GradientBoostingClassifier(random_state=random_state)),
        ]
    )

    pipeline.fit(X_train, y_train)
    val_probs = pipeline.predict_proba(X_val)[:, 1]
    auc = roc_auc_score(y_val, val_probs)

    feature_importances: dict[str, float] = {}
    try:
        importance = permutation_importance(
            pipeline,
            X_val,
            y_val,
            n_repeats=5,
            random_state=random_state,
            scoring="roc_auc",
        )
        feature_importances = {
            feature: float(score)
            for feature, score in zip(X_val.columns, importance.importances_mean)
        }
    except Exception:
        feature_importances = {}

    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {
            "model": pipeline,
            "feature_columns": FEATURE_COLUMNS,
            "auc": float(auc),
            "feature_importances": feature_importances,
        },
        model_path,
    )

    print(f"Saved model to {model_path} (val AUC={auc:.3f})")


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the prequalification model.")
    parser.add_argument("--data", type=Path, default=DATA_PATH, help="Path to synthetic CSV.")
    parser.add_argument("--model", type=Path, default=MODEL_PATH, help="Output model path.")
    parser.add_argument("--refresh-data", action="store_true", help="Regenerate synthetic data.")
    parser.add_argument("--rows", type=int, default=10_000, help="Rows to generate if refreshing.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed.")
    args = parser.parse_args()

    train_model(
        data_path=args.data,
        model_path=args.model,
        refresh_data=args.refresh_data,
        num_samples=args.rows,
        random_state=args.seed,
    )


if __name__ == "__main__":
    main()
