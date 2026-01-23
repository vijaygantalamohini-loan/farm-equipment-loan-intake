import joblib
from pathlib import Path
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
import pandas as pd
import random

MODEL_DIR = Path(__file__).parent / "models"
MODEL_DIR.mkdir(exist_ok=True)


def train_approval_model():
    rows = []
    for _ in range(300):
        loan_amount = random.randint(30000, 250000)
        hours = random.randint(50, 3000)
        ltv = random.uniform(0.5, 1.2)
        age = random.randint(0, 20)
        income = random.randint(40000, 250000)
        naics = random.choice(["1113", "1121", "2389", "3251"])
        state = random.choice(["IA", "NE", "IL", "TX"])
        score = 1 if ltv < 1.0 and income > 70000 and age < 12 else 0
        rows.append(
            {
                "loan_amount": loan_amount,
                "ltv": ltv,
                "age": age,
                "income": income,
                "naics": naics,
                "state": state,
                "approval": score,
            }
        )
    df = pd.DataFrame(rows)
    X = df[["loan_amount", "ltv", "age", "income", "naics", "state"]]
    y = df["approval"]

    preprocessor = ColumnTransformer(
        [
            ("cat", OneHotEncoder(handle_unknown="ignore"), ["naics", "state"]),
        ],
        remainder="passthrough",
    )

    pipeline = Pipeline(
        [
            ("preprocessor", preprocessor),
            ("model", GradientBoostingClassifier(n_estimators=50, random_state=42)),
        ]
    )
    pipeline.fit(X, y)
    joblib.dump(pipeline, MODEL_DIR / "approval_model.pkl")
    print("Approval model saved")


if __name__ == "__main__":
    train_approval_model()
