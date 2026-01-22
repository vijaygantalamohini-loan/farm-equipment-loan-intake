from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from statistics import mean
from typing import Dict, Optional

import joblib
import numpy as np

from equipment_intelligence.ml_models.serial_decoder.feature_utils import (
    build_serial_feature_string,
)
MODEL_FILENAMES = {
    "make": "serial_decoder_make.pkl",
    "model": "serial_decoder_model.pkl",
    "year": "serial_decoder_year.pkl",
}


@dataclass
class SerialPrediction:
    label: Optional[str]
    confidence: float


class SerialDecoderPredictor:
    """Lazy loader for the trained serial decoder pipelines."""

    def __init__(self, model_dir: Optional[Path] = None) -> None:
        self.model_dir = model_dir or Path(__file__).resolve().parent.parent / "models"
        self._pipelines: Dict[str, Optional[object]] = {}

    def _load_pipeline(self, target: str):
        if target in self._pipelines:
            return self._pipelines[target]
        model_path = self.model_dir / MODEL_FILENAMES[target]
        if not model_path.exists():
            self._pipelines[target] = None
            return None
        self._pipelines[target] = joblib.load(model_path)
        return self._pipelines[target]

    @staticmethod
    def _predict_single(pipeline, serial: str) -> SerialPrediction:
        if pipeline is None:
            return SerialPrediction(label=None, confidence=0.0)
        serial_value = build_serial_feature_string(serial)
        if not serial_value:
            return SerialPrediction(label=None, confidence=0.0)

        try:
            predicted = pipeline.predict([serial_value])[0]
        except Exception:
            return SerialPrediction(label=None, confidence=0.0)

        confidence = 0.0
        if hasattr(pipeline, "predict_proba"):
            try:
                proba = pipeline.predict_proba([serial_value])
                if proba.size > 0:
                    confidence = float(np.max(proba))
            except Exception:
                confidence = 0.0

        label = predicted
        if isinstance(predicted, np.generic):
            label = predicted.item()
        elif isinstance(predicted, bytes):
            label = predicted.decode("utf-8", "ignore")

        return SerialPrediction(label=str(label), confidence=confidence)

    def predict(self, serial: str) -> Dict[str, SerialPrediction]:
        outputs: Dict[str, SerialPrediction] = {}
        for target in MODEL_FILENAMES:
            pipeline = self._load_pipeline(target)
            prediction = self._predict_single(pipeline, serial)
            outputs[target] = prediction

        return outputs

    def predict_with_overall(self, serial: str) -> Dict[str, object]:
        per_target = self.predict(serial)
        scores = [p.confidence for p in per_target.values() if p.label]
        overall = mean(scores) if scores else 0.0
        payload = {key: {"label": pred.label, "confidence": pred.confidence} for key, pred in per_target.items()}
        payload["overall_confidence"] = overall
        return payload
