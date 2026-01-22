from __future__ import annotations

import csv
from datetime import datetime
from pathlib import Path
from typing import Any, Mapping, Optional
from uuid import uuid4

import pandas as pd

FIELDNAMES = [
    "timestamp",
    "tracking_id",
    "approval_probability",
    "ltv",
    "down_payment_percent",
    "risk_flag_count",
    "borrower_income",
    "credit_score",
    "actual_decision",
]


def _ensure_header(path: Path) -> None:
    if not path.exists() or path.stat().st_size == 0:
        with path.open("w", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=FIELDNAMES)
            writer.writeheader()


def log_prediction_event(
    features: Mapping[str, Any] | Any,
    approval_probability: float,
    actual_decision: Optional[int] = None,
    metrics_path: Path | None = None,
) -> str:
    """Append a prediction event to the metrics log and return a tracking id."""

    metrics_file = Path(metrics_path) if metrics_path else Path("prequalification_metrics.csv")
    metrics_file.parent.mkdir(parents=True, exist_ok=True)
    _ensure_header(metrics_file)

    if hasattr(features, "to_dict"):
        feature_row = features.to_dict("records")[0]
    elif isinstance(features, Mapping):
        feature_row = dict(features)
    else:
        feature_row = {}

    tracking_id = uuid4().hex
    record = {
        "timestamp": datetime.utcnow().isoformat(timespec="seconds"),
        "tracking_id": tracking_id,
        "approval_probability": round(float(approval_probability), 6),
        "ltv": float(feature_row.get("ltv", 0.0)),
        "down_payment_percent": float(feature_row.get("down_payment_percent", 0.0)),
        "risk_flag_count": float(feature_row.get("risk_flag_count", 0.0)),
        "borrower_income": float(feature_row.get("borrower_income", 0.0)),
        "credit_score": float(feature_row.get("credit_score", 0.0)),
        "actual_decision": actual_decision,
    }

    with metrics_file.open("a", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=FIELDNAMES)
        writer.writerow(record)

    return tracking_id


def log_actual_outcome(
    tracking_id: str,
    actual_decision: int,
    metrics_path: Path | None = None,
) -> None:
    """Update the recorded outcome for a previously logged prediction."""

    metrics_file = Path(metrics_path) if metrics_path else Path("prequalification_metrics.csv")
    if not metrics_file.exists():
        return

    df = pd.read_csv(metrics_file)
    if "tracking_id" not in df.columns:
        return

    mask = df["tracking_id"] == tracking_id
    if not mask.any():
        return

    df.loc[mask, "actual_decision"] = int(actual_decision)
    df.to_csv(metrics_file, index=False)


__all__ = ["log_prediction_event", "log_actual_outcome"]
