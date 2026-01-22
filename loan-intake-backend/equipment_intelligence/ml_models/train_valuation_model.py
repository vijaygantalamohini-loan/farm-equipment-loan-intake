import joblib
import numpy as np
from pathlib import Path
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

from equipment_intelligence.ml_models.model_utils import get_training_dataframe

MODEL_DIR = Path(__file__).parent / "models"
MODEL_DIR.mkdir(exist_ok=True)


def train_valuation_model():
    df = get_training_dataframe(min_rows=400)
    X = df[["make", "model", "region", "condition", "year", "hours"]]
    y = df["price"]

    preprocessor = ColumnTransformer(
        [("cat", OneHotEncoder(handle_unknown="ignore"), ["make", "model", "region", "condition"])],
        remainder="passthrough",
    )

    pipeline = Pipeline(
        [
            ("preprocessor", preprocessor),
            ("model", RandomForestRegressor(n_estimators=50, random_state=42)),
        ]
    )

    pipeline.fit(X, y)
    joblib.dump(pipeline, MODEL_DIR / "valuation_model.pkl")
    print("Valuation model saved")


if __name__ == "__main__":
    train_valuation_model()
