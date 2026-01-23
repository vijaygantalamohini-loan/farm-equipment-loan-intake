from pathlib import Path
import pandas as pd
import joblib

from sklearn.calibration import CalibratedClassifierCV
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.multioutput import MultiOutputRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.model_selection import train_test_split

from ai_prequalification.data_generation import generate_synthetic_dataset

BASE_DIR = Path(__file__).parent
DATA_PATH = BASE_DIR / "sample_training_data.csv"
MODEL_DIR = BASE_DIR / "models"

FEATURE_COLUMNS = [
    "loan_amount",
    "equipment_age",
    "down_payment_percent",
    "ltv",
    "borrower_income",
    "credit_score",
    "trade_in_present",
    "equipment_type",
    "borrower_state",
    "naics_code",
    "risk_flag_count",
    "missing_serial_indicator",
    "equipment_age_variance",
]

NUMERIC_FEATURES = [
    "loan_amount",
    "equipment_age",
    "down_payment_percent",
    "ltv",
    "borrower_income",
    "credit_score",
    "trade_in_present",
    "risk_flag_count",
    "missing_serial_indicator",
    "equipment_age_variance",
]

CATEGORICAL_FEATURES = ["equipment_type", "borrower_state", "naics_code"]


def load_training_data(path: Path = DATA_PATH) -> pd.DataFrame:
    df = pd.read_csv(path)
    df["trade_in_present"] = df["trade_in_present"].astype(float)
    return df


def build_preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            ("numeric", StandardScaler(), NUMERIC_FEATURES),
            ("categorical", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
        ],
        remainder="drop",
    )


def build_pipeline(model):
    return Pipeline(
        [
            ("preprocessor", build_preprocessor()),
            ("model", model),
        ]
    )


def train_all_models(refresh_data: bool = False, num_samples: int = 1200, approval_rate: float = 0.5) -> None:
    if refresh_data:
        generate_synthetic_dataset(DATA_PATH, num_samples=num_samples, approval_rate=approval_rate)

    df = load_training_data()

    X = df[FEATURE_COLUMNS]
    y_approval = df["approval"]
    y_risk = df["risk_score"]
    y_optimal = df[["optimal_down_payment_percent", "optimal_term_months"]]

    (
        X_train,
        X_test,
        y_approval_train,
        y_approval_test,
        y_risk_train,
        y_risk_test,
        y_optimal_train,
        y_optimal_test,
    ) = train_test_split(
        X,
        y_approval,
        y_risk,
        y_optimal,
        test_size=0.2,
        random_state=42,
    )

    MODEL_DIR.mkdir(exist_ok=True)

    approval_estimator = build_pipeline(
        GradientBoostingClassifier(random_state=42, n_estimators=100)
    )
    approval_pipeline = CalibratedClassifierCV(
        estimator=approval_estimator,
        method="sigmoid",
        cv=3,
    )
    approval_pipeline.fit(X_train, y_approval_train)
    joblib.dump(approval_pipeline, MODEL_DIR / "approval_probability_model.pkl")

    risk_pipeline = build_pipeline(
        GradientBoostingRegressor(random_state=42, n_estimators=100)
    )
    risk_pipeline.fit(X_train, y_risk_train)
    joblib.dump(risk_pipeline, MODEL_DIR / "risk_score_model.pkl")

    optimal_pipeline = build_pipeline(
        MultiOutputRegressor(GradientBoostingRegressor(random_state=42, n_estimators=100))
    )
    optimal_pipeline.fit(X_train, y_optimal_train)
    joblib.dump(optimal_pipeline, MODEL_DIR / "optimal_structure_model.pkl")

    print("Models trained and saved to:", MODEL_DIR)


if __name__ == "__main__":
    train_all_models(refresh_data=True)
