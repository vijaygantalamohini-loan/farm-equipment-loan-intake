from __future__ import annotations

from functools import lru_cache
from typing import Dict, Optional

from equipment_intelligence.ml_models.serial_decoder.predict import SerialDecoderPredictor


@lru_cache(maxsize=1)
def _get_predictor() -> SerialDecoderPredictor:
    return SerialDecoderPredictor()


def ml_serial_lookup(serial: str) -> Dict[str, object]:
    if not serial:
        return {}
    predictor = _get_predictor()
    return predictor.predict_with_overall(serial)
