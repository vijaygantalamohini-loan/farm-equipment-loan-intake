from io import BytesIO

import pytest

from services.fraud_detection import evaluate_fraud_flags
from services.ocr_service import _analyze_image_metadata


def _flag_codes(flags):
    return {flag["code"] for flag in flags}


def test_high_volume_submissions_flag():
    payload = {
        "behavioral_signals": {
            "num_submissions_last_24h": 12,
            "num_declined_apps_last_30d": 0,
            "device_fingerprint": None,
            "user_agent_hash": None,
            "ip_address_risk_score": 0.1,
            "upload_retry_count": 0,
        }
    }
    flags = evaluate_fraud_flags(payload)
    assert "high_submission_volume" in _flag_codes(flags)


def test_repeated_declines_flag():
    payload = {
        "behavioral_signals": {
            "num_submissions_last_24h": 1,
            "num_declined_apps_last_30d": 5,
            "device_fingerprint": None,
            "user_agent_hash": None,
            "ip_address_risk_score": 0.1,
            "upload_retry_count": 0,
        }
    }
    flags = evaluate_fraud_flags(payload)
    assert "repeat_declines" in _flag_codes(flags)


def test_image_tampering_heuristic():
    image_module = pytest.importorskip("PIL.Image")
    image = image_module.new("RGB", (120, 120), color=(255, 255, 255))
    buf = BytesIO()
    image.save(buf, format="JPEG")
    metadata = _analyze_image_metadata(buf.getvalue())

    assert metadata["possible_tampering"] is True

    flags = evaluate_fraud_flags({"image_tampering": {"id": metadata}})
    assert "possible_image_tampering" in _flag_codes(flags)
