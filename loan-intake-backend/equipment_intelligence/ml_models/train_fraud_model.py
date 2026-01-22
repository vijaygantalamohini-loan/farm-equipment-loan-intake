import joblib
from pathlib import Path
from sklearn.ensemble import IsolationForest
from sklearn.svm import OneClassSVM
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
import numpy as np

MODEL_DIR = Path(__file__).parent / "models"
MODEL_DIR.mkdir(exist_ok=True)


def train_fraud_model():
    X = np.random.rand(500, 4)
    iso_pipeline = Pipeline(
        [
            ("scaler", StandardScaler()),
            ("model", IsolationForest(contamination=0.05, random_state=42)),
        ]
    )
    svm_pipeline = Pipeline(
        [
            ("scaler", StandardScaler()),
            ("model", OneClassSVM(gamma='auto')),
        ]
    )
    iso_pipeline.fit(X)
    svm_pipeline.fit(X)
    joblib.dump({"isolation": iso_pipeline, "svm": svm_pipeline}, MODEL_DIR / "fraud_model.pkl")
    print("Fraud model saved")


if __name__ == "__main__":
    train_fraud_model()
