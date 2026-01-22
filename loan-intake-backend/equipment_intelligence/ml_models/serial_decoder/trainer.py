from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

from equipment_intelligence.ml_models.serial_decoder.data import load_serial_dataset
from equipment_intelligence.ml_models.serial_decoder.feature_utils import (
    build_serial_feature_string,
)

MODEL_FILENAMES = {
    "make": "serial_decoder_make.pkl",
    "model": "serial_decoder_model.pkl",
    "year": "serial_decoder_year.pkl",
}


def _build_pipeline() -> Pipeline:
    return Pipeline(
        [
            (
                "vectorizer",
                TfidfVectorizer(analyzer="char", ngram_range=(2, 5), lowercase=False),
            ),
            (
                "classifier",
                LogisticRegression(
                    max_iter=2000,
                ),
            ),
        ]
    )


def _needs_stratify(counts: pd.Series) -> bool:
    if len(counts) < 2:
        return False
    return counts.min() >= 2


def _train_target(df: pd.DataFrame, target: str) -> Tuple[Pipeline, Dict[str, float]]:
    pipeline = _build_pipeline()
    X = df["serial_features"].values
    y = df[target].astype(str).values

    counts = pd.Series(y).value_counts()
    stratify = y if _needs_stratify(counts) else None

    metrics: Dict[str, float] = {"classes": float(len(counts))}

    if len(counts) > 1:
        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=0.2,
            random_state=42,
            stratify=stratify,
        )
        pipeline.fit(X_train, y_train)
        y_pred = pipeline.predict(X_test)
        metrics["accuracy"] = float(accuracy_score(y_test, y_pred))
    else:
        pipeline.fit(X, y)
        metrics["accuracy"] = 1.0

    pipeline.fit(X, y)
    return pipeline, metrics


def train_serial_decoder_models(model_dir: Path | None = None) -> Dict[str, Dict[str, float]]:
    model_dir = model_dir or Path(__file__).resolve().parent.parent / "models"
    model_dir.mkdir(parents=True, exist_ok=True)

    df = load_serial_dataset(min_samples=200)
    df = df.copy()

    df["serial_features"] = df["serial"].apply(build_serial_feature_string)

    metrics: Dict[str, Dict[str, float]] = {}

    for target, filename in MODEL_FILENAMES.items():
        pipeline, target_metrics = _train_target(df, target)
        joblib.dump(pipeline, model_dir / filename)
        metrics[target] = target_metrics

    metadata_path = model_dir / "serial_decoder_metadata.json"
    metadata_path.write_text(json.dumps({"metrics": metrics}, indent=2))

    return metrics
