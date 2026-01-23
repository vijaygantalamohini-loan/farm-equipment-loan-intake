import joblib
from pathlib import Path
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer

from datetime import datetime

from equipment_intelligence.ml_models.model_utils import get_training_dataframe

MODEL_DIR = Path(__file__).parent / "models"
MODEL_DIR.mkdir(exist_ok=True)


def train_resale_model():
    df = get_training_dataframe(min_rows=350)
    current_year = datetime.utcnow().year
    df["age"] = current_year - df["year"]
    X = df[["region", "condition", "age", "hours"]]
    y = df["price"] * 0.8

    preprocessor = ColumnTransformer(
        [("cat", OneHotEncoder(handle_unknown="ignore"), ["region", "condition"])],
        remainder="passthrough",
    )
    pipeline = Pipeline(
        [
            ("preprocessor", preprocessor),
            ("model", GradientBoostingRegressor(n_estimators=50, random_state=42)),
        ]
    )
    pipeline.fit(X, y)
    joblib.dump(pipeline, MODEL_DIR / "resale_model.pkl")
    print("Resale model saved")


if __name__ == "__main__":
    train_resale_model()
