from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List

CURRENT_YEAR = datetime.now().year
DEFAULT_CREDIT_SCORE = 680


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


def _normalize_json(raw: Any) -> Dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {}
    return {}


def _determine_is_new(asset: Dict[str, Any], year: int) -> bool:
    condition = str(asset.get("condition") or "").lower()
    if "new" in condition or "unused" in condition:
        return True
    if year >= CURRENT_YEAR - 1:
        return True
    return False


def build_equipment_list(loan_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    assets = loan_data.get("purchaseAssets") or loan_data.get("purchase_assets") or []
    if isinstance(assets, str):
        try:
            assets = json.loads(assets)
        except json.JSONDecodeError:
            assets = []

    equipment_list = []
    for raw_asset in assets:
        if not isinstance(raw_asset, dict):
            continue

        year = _safe_int(raw_asset.get("year"), CURRENT_YEAR)
        equipment_type = (
            raw_asset.get("equipmentType")
            or raw_asset.get("equipment_type")
            or raw_asset.get("type")
            or raw_asset.get("make")
            or "Equipment"
        )
        value = _safe_float(
            raw_asset.get("value")
            or raw_asset.get("valueEstimate")
            or raw_asset.get("value_estimate")
            or 0
        )
        serial = raw_asset.get("serialNumber") or raw_asset.get("serial_number") or ""

        equipment_list.append(
            {
                "type": equipment_type,
                "year": year,
                "value": value,
                "isNew": _determine_is_new(raw_asset, year),
                "serialNumber": serial,
            }
        )

    if not equipment_list:
        equipment_list.append(
            {
                "type": "Equipment",
                "year": CURRENT_YEAR,
                "value": _safe_float(loan_data.get("loanAmount") or loan_data.get("amount") or 0),
                "isNew": True,
                "serialNumber": "",
            }
        )

    return equipment_list


def _total_equipment_value(equipment_list: List[Dict[str, Any]]) -> float:
    return max(sum(asset.get("value", 0) for asset in equipment_list), 1.0)


def build_prequalification_payload(
    borrower_data: Any,
    loan_data: Any,
    dealer_data: Any,
) -> Dict[str, Any]:
    borrower = _normalize_json(borrower_data)
    loan = _normalize_json(loan_data)
    dealer = _normalize_json(dealer_data)

    equipment_list = build_equipment_list(loan)
    total_value = _total_equipment_value(equipment_list)
    loan_amount = _safe_float(loan.get("loanAmount") or loan.get("amount"))
    if loan_amount <= 0:
        loan_amount = total_value

    down_payment = _safe_float(loan.get("cashDown") or loan.get("down_payment"))
    if down_payment < 0:
        down_payment = 0.0

    naics_code = (
        loan.get("naicsCode")
        or loan.get("naics_code")
        or ""
    )

    term_months = _safe_int(loan.get("termMonths") or loan.get("term_months"), default=60)

    trade_in_present = bool(
        loan.get("hasTradeIn")
        or loan.get("tradeIns")
        or loan.get("trade_ins")
    )

    borrower_income = _safe_float(
        borrower.get("annualIncome") or borrower.get("annual_income")
    )
    credit_score = _safe_int(
        borrower.get("creditScore") or borrower.get("credit_score"),
        default=DEFAULT_CREDIT_SCORE,
    )
    prior_defaults = (
        borrower.get("priorLoanDefaults")
        or borrower.get("prior_defaults")
        or borrower.get("prior_loan_defaults")
    )
    bankruptcy_history = (
        borrower.get("bankruptcyHistory")
        or borrower.get("bankruptcy_history")
    )

    dealer_address = dealer.get("address") or {}
    state = (
        dealer_address.get("state")
        or dealer.get("state")
        or borrower.get("address", {}).get("state")
        or borrower.get("state")
        or ""
    )

    return {
        "loan_amount": loan_amount,
        "equipment_list": equipment_list,
        "borrower_income": borrower_income,
        "credit_score": credit_score or DEFAULT_CREDIT_SCORE,
        "down_payment": down_payment,
        "naics_code": naics_code,
        "state": state.upper(),
        "trade_in_present": trade_in_present,
        "loan_term_months": max(12, term_months),
        "prior_defaults": prior_defaults,
        "bankruptcy_history": bankruptcy_history,
    }


def risk_tier_from_score(score: float) -> str:
    if score >= 70:
        return "High"
    if score >= 40:
        return "Medium"
    return "Low"
