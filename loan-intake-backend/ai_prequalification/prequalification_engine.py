from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Mapping

import joblib
import pandas as pd

from ai_prequalification.model_features import FEATURE_COLUMNS
from ai_prequalification.monitoring import log_prediction_event
from ai_prequalification.schemas import PrequalificationRequest
from ai_prequalification.utils import risk_tier_from_score
from utils.scoring_helpers import (
    calculate_ltv,
    calculate_down_payment_percent,
    flag_risk_factors,
)


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _bool_from_any(value: Any) -> int:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        return int(value != 0)
    if isinstance(value, str):
        normalized = value.strip().lower()
        return int(normalized in {"true", "yes", "y", "1"})
    return 0


def _model_risk_flags(
    borrower_income: float,
    credit_score: float,
    ltv: float,
    down_payment_percent: float,
    term_months: int,
    prior_defaults: int,
    bankruptcy_history: int,
) -> List[str]:
    flags: List[str] = []
    if ltv > 0.95:
        flags.append("high_ltv")
    if down_payment_percent < 0.1:
        flags.append("low_down_payment")
    if borrower_income < 60000:
        flags.append("low_income")
    if credit_score < 640:
        flags.append("low_credit")
    if term_months > 72:
        flags.append("long_term")
    if prior_defaults:
        flags.append("prior_default")
    if bankruptcy_history:
        flags.append("bankruptcy")
    return flags


def _normalize_importances(raw: Mapping[str, float]) -> Dict[str, float]:
    cleaned = {key: max(0.0, float(val)) for key, val in raw.items() if val is not None}
    if not cleaned:
        return {}
    max_value = max(cleaned.values()) or 0.0
    if max_value <= 0:
        return {}
    return {key: val / max_value for key, val in cleaned.items()}


def _apply_importance(weight: float, importance: float | None) -> float:
    if importance is None:
        return weight
    return weight * (0.6 + 0.4 * min(max(importance, 0.0), 1.0))


class PrequalificationEngine:
    """Loads the trained model and provides runtime predictions."""

    def __init__(self, model_dir: Path | None = None):
        base_dir = Path(__file__).parent
        self.model_dir = Path(model_dir) if model_dir else base_dir / "models"
        if not self.model_dir.exists():
            raise RuntimeError(f"Model directory not found: {self.model_dir}")

        self.model_path = self.model_dir / "prequal_model.pkl"
        if not self.model_path.exists():
            raise RuntimeError(f"Prequalification model not found: {self.model_path}")

        self._metrics_path = base_dir.parent / "logs" / "prequalification_metrics.csv"
        self._metrics_path.parent.mkdir(parents=True, exist_ok=True)
        self._last_tracking_id: str | None = None

        try:
            bundle = joblib.load(self.model_path)
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "Prequalification model requires optional ML dependencies. "
                "Install scikit-learn or set DISABLE_PREQUAL_ENGINE=true."
            ) from exc

        if isinstance(bundle, dict) and "model" in bundle:
            self.model = bundle["model"]
            self.feature_columns = bundle.get("feature_columns", FEATURE_COLUMNS)
            self.global_importances = _normalize_importances(
                bundle.get("feature_importances", {}) or {}
            )
        else:
            self.model = bundle
            self.feature_columns = FEATURE_COLUMNS
            self.global_importances = {}

    def _build_feature_row(self, data: Mapping[str, Any]) -> tuple[Dict[str, Any], List[str]]:
        equipment_list = data.get("equipment_list") or []
        if not isinstance(equipment_list, list):
            equipment_list = []

        total_value = sum(
            max(0.0, _safe_float(item.get("value"))) for item in equipment_list if isinstance(item, Mapping)
        )
        if total_value <= 0:
            total_value = max(1.0, _safe_float(data.get("loan_amount"), default=1.0))

        equipment_type = "Equipment"
        if equipment_list and isinstance(equipment_list[0], Mapping):
            equipment_type = equipment_list[0].get("type") or equipment_type

        loan_amount = _safe_float(data.get("loan_amount"))
        down_payment = max(0.0, _safe_float(data.get("down_payment")))
        credit_score = _safe_float(data.get("credit_score"))
        borrower_income = _safe_float(data.get("borrower_income"))
        naics_code = str(data.get("naics_code") or "").strip()
        dealer_state = str(data.get("state") or data.get("dealer_state") or "").strip().upper()
        term_months = _safe_int(data.get("loan_term_months") or data.get("term_months"), default=60)

        prior_defaults = _bool_from_any(
            data.get("prior_defaults")
            or data.get("priorLoanDefaults")
            or data.get("prior_loan_defaults")
        )
        bankruptcy_history = _bool_from_any(
            data.get("bankruptcy_history")
            or data.get("bankruptcyHistory")
        )

        down_payment_percent = calculate_down_payment_percent(down_payment, total_value)
        ltv = calculate_ltv(loan_amount, total_value)

        risk_flags = _model_risk_flags(
            borrower_income,
            credit_score,
            ltv,
            down_payment_percent,
            term_months,
            prior_defaults,
            bankruptcy_history,
        )

        feature_row = {
            "borrower_income": borrower_income,
            "credit_score": credit_score,
            "loan_amount": loan_amount,
            "down_payment": down_payment,
            "term_months": term_months,
            "ltv": ltv,
            "prior_defaults": prior_defaults,
            "bankruptcy_history": bankruptcy_history,
            "risk_flag_count": float(len(risk_flags)),
            "naics_code": naics_code,
            "equipment_type": equipment_type,
            "dealer_state": dealer_state,
            "down_payment_percent": down_payment_percent,
        }
        return feature_row, risk_flags

    def _explain_local(self, feature_row: Mapping[str, Any], down_payment_percent: float) -> Dict[str, Any]:
        factors: List[Dict[str, Any]] = []

        borrower_income = float(feature_row["borrower_income"])
        credit_score = float(feature_row["credit_score"])
        ltv = float(feature_row["ltv"])
        term_months = int(feature_row["term_months"])
        prior_defaults = int(feature_row["prior_defaults"])
        bankruptcy_history = int(feature_row["bankruptcy_history"])

        if ltv > 0.95:
            weight = min((ltv - 0.9) / 0.3, 1.0)
            factors.append(
                {
                    "feature": "ltv",
                    "direction": "high",
                    "message": "High loan-to-value increases risk",
                    "weight": _apply_importance(weight, self.global_importances.get("ltv")),
                    "code": "ltv_high",
                }
            )

        if down_payment_percent < 0.1:
            weight = min((0.1 - down_payment_percent) / 0.1, 1.0)
            factors.append(
                {
                    "feature": "down_payment",
                    "direction": "low",
                    "message": "Low down payment increases risk",
                    "weight": _apply_importance(weight, self.global_importances.get("down_payment")),
                    "code": "down_payment_low",
                }
            )

        if credit_score < 650:
            weight = min((650 - credit_score) / 200, 1.0)
            factors.append(
                {
                    "feature": "credit_score",
                    "direction": "low",
                    "message": "Low credit score increases risk",
                    "weight": _apply_importance(weight, self.global_importances.get("credit_score")),
                    "code": "credit_score_low",
                }
            )

        if borrower_income < 60000:
            weight = min((60000 - borrower_income) / 60000, 1.0)
            factors.append(
                {
                    "feature": "borrower_income",
                    "direction": "low",
                    "message": "Low income increases risk",
                    "weight": _apply_importance(weight, self.global_importances.get("borrower_income")),
                    "code": "income_low",
                }
            )

        if term_months > 72:
            weight = min((term_months - 72) / 24, 1.0)
            factors.append(
                {
                    "feature": "term_months",
                    "direction": "high",
                    "message": "Longer term increases risk",
                    "weight": _apply_importance(weight, self.global_importances.get("term_months")),
                    "code": "term_months_high",
                }
            )

        if prior_defaults:
            factors.append(
                {
                    "feature": "prior_defaults",
                    "direction": "present",
                    "message": "Prior defaults increase risk",
                    "weight": _apply_importance(0.9, self.global_importances.get("prior_defaults")),
                    "code": "prior_defaults",
                }
            )

        if bankruptcy_history:
            factors.append(
                {
                    "feature": "bankruptcy_history",
                    "direction": "present",
                    "message": "Bankruptcy history increases risk",
                    "weight": _apply_importance(1.0, self.global_importances.get("bankruptcy_history")),
                    "code": "bankruptcy_history",
                }
            )

        factors.sort(key=lambda item: (-item["weight"], item["feature"]))
        top = factors[:3]

        if not top:
            return {
                "top_risk_factors": [],
                "reasons": [
                    {
                        "code": "low_risk_profile",
                        "message": "No major risk indicators detected in the application.",
                        "weight": 0.1,
                    }
                ],
            }

        top_risk_factors = [
            {
                "feature": factor["feature"],
                "direction": factor["direction"],
                "message": factor["message"],
            }
            for factor in top
        ]
        reasons = [
            {
                "code": factor["code"],
                "message": factor["message"],
                "weight": round(float(min(max(factor["weight"], 0.0), 1.0)), 3),
            }
            for factor in top
        ]
        return {"top_risk_factors": top_risk_factors, "reasons": reasons}

    def _to_feature_frame(self, data: Mapping[str, Any]) -> tuple[pd.DataFrame, List[str]]:
        feature_row, risk_flags = self._build_feature_row(data)
        return pd.DataFrame([feature_row]), risk_flags

    def _predict_probability(self, features: pd.DataFrame) -> float:
        model_input = features[self.feature_columns]
        proba = float(self.model.predict_proba(model_input)[0][1])
        return min(max(proba, 0.0), 1.0)

    def _risk_score_from_probability(
        self,
        approval_probability: float,
        risk_flag_count: float,
        prior_defaults: int,
        bankruptcy_history: int,
    ) -> float:
        score = (1.0 - approval_probability) * 100.0
        score += 2.0 * risk_flag_count + 8.0 * prior_defaults + 12.0 * bankruptcy_history
        return float(min(max(score, 0.0), 100.0))

    def predict_prequalification(self, payload: Dict[str, Any] | PrequalificationRequest) -> Dict[str, Any]:
        if isinstance(payload, PrequalificationRequest):
            payload_dict = payload.model_dump(by_alias=True)
        else:
            payload_dict = dict(payload)

        features, risk_flags = self._to_feature_frame(payload_dict)
        approval_probability = self._predict_probability(features)
        feature_row = features.iloc[0]
        explanation = self._explain_local(feature_row, float(feature_row["down_payment_percent"]))
        risk_score = self._risk_score_from_probability(
            approval_probability,
            feature_row["risk_flag_count"],
            int(feature_row["prior_defaults"]),
            int(feature_row["bankruptcy_history"]),
        )
        risk_tier = risk_tier_from_score(risk_score)

        features_used = {col: feature_row[col] for col in self.feature_columns}
        features_used["risk_flags"] = risk_flags

        try:
            self._last_tracking_id = log_prediction_event(
                features,
                approval_probability,
                actual_decision=None,
                metrics_path=self._metrics_path,
            )
        except Exception:  # pragma: no cover - logging must not break inference
            self._last_tracking_id = None

        return {
            "approval_probability": approval_probability,
            "risk_tier": risk_tier,
            "features_used": features_used,
            "top_risk_factors": explanation["top_risk_factors"],
            "reasons": explanation["reasons"],
        }

    def predict_approval_probability(self, application: PrequalificationRequest) -> float:
        prediction = self.predict_prequalification(application)
        return float(prediction["approval_probability"])

    def compute_risk_score(
        self,
        application: PrequalificationRequest,
        approval_probability: float | None = None,
    ) -> Dict[str, Any]:
        payload = application.model_dump(by_alias=True)
        features, _ = self._to_feature_frame(payload)
        if approval_probability is None:
            approval_probability = self._predict_probability(features)

        feature_row = features.iloc[0]
        risk_score = self._risk_score_from_probability(
            approval_probability,
            feature_row["risk_flag_count"],
            int(feature_row["prior_defaults"]),
            int(feature_row["bankruptcy_history"]),
        )
        flags = flag_risk_factors(
            payload,
            float(feature_row["ltv"]),
            float(feature_row["down_payment_percent"]),
        )
        return {
            "risk_score": risk_score,
            "flags": flags,
            "ltv": float(feature_row["ltv"]),
            "down_payment_percent": float(feature_row["down_payment_percent"]),
        }

    def suggest_optimal_structure(
        self,
        application: PrequalificationRequest,
        approval_probability: float | None = None,
    ) -> Dict[str, Any]:
        payload = application.model_dump(by_alias=True)
        features, _ = self._to_feature_frame(payload)
        if approval_probability is None:
            approval_probability = self._predict_probability(features)

        feature_row = features.iloc[0]
        ltv = float(feature_row["ltv"])
        term_months = int(feature_row["term_months"])

        recommended_down_payment_percent = 0.15 + 0.25 * (1.0 - approval_probability)
        if ltv > 0.95:
            recommended_down_payment_percent += 0.05
        recommended_down_payment_percent = min(max(recommended_down_payment_percent, 0.05), 0.5)

        recommended_term = max(36, min(84, int(round(term_months - 12 * (1.0 - approval_probability)))))

        equipment_value = sum(
            max(0.0, _safe_float(item.get("value")))
            for item in payload.get("equipment_list", [])
            if isinstance(item, Mapping)
        )
        if equipment_value <= 0:
            equipment_value = max(application.loan_amount, 1.0)

        recommended_down_payment = recommended_down_payment_percent * equipment_value
        principal = max(application.loan_amount, equipment_value - recommended_down_payment)
        expected_monthly_payment = self._calculate_monthly_payment(principal, recommended_term)

        return {
            "recommended_down_payment": round(recommended_down_payment, 2),
            "recommended_term": recommended_term,
            "expected_monthly_payment": round(expected_monthly_payment, 2),
        }

    def _calculate_monthly_payment(self, principal: float, term_months: int) -> float:
        if term_months <= 0:
            return principal
        annual_rate = 0.085
        monthly_rate = annual_rate / 12
        if monthly_rate == 0:
            return principal / term_months
        denominator = 1 - (1 + monthly_rate) ** -term_months
        if denominator == 0:
            return principal / term_months
        return (principal * monthly_rate) / denominator

    @property
    def last_tracking_id(self) -> str | None:
        return self._last_tracking_id


_ENGINE: PrequalificationEngine | None = None


def predict_prequalification(payload: Dict[str, Any]) -> Dict[str, Any]:
    global _ENGINE
    if _ENGINE is None:
        _ENGINE = PrequalificationEngine()
    return _ENGINE.predict_prequalification(payload)


__all__ = ["PrequalificationEngine", "predict_prequalification"]
