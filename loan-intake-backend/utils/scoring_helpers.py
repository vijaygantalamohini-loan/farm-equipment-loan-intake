from typing import List, Dict, Any


def calculate_ltv(loan_amount: float, equipment_value: float) -> float:
    if equipment_value <= 0:
        return 0.0
    return min(max(loan_amount / equipment_value, 0.0), 2.0)


def calculate_down_payment_percent(down_payment: float, equipment_value: float) -> float:
    if equipment_value <= 0:
        return 0.0
    return min(max(down_payment / equipment_value, 0.0), 1.0)


def flag_risk_factors(application: Dict[str, Any], ltv: float, down_payment_percent: float) -> List[str]:
    flags: List[str] = []
    borrower_income = application.get("borrower_income", 0) or 0
    credit_score = application.get("credit_score", 0) or 0
    equipment_list = application.get("equipment_list") or []
    trade_in_present = bool(application.get("trade_in_present"))

    if ltv > 1.05:
        flags.append("High LTV")
    elif ltv > 0.9:
        flags.append("Elevated LTV")

    if down_payment_percent < 0.15:
        flags.append("Low down payment")

    if borrower_income and borrower_income < 60000:
        flags.append("Low income")

    if credit_score and credit_score < 650:
        flags.append("Credit score below 650")

    average_age = 0
    if equipment_list:
        numeric_ages = []
        for equipment in equipment_list:
            year = equipment.get("year")
            try:
                year_int = int(year)
            except (TypeError, ValueError):
                continue
            current_year = 2026
            age = current_year - year_int
            if age >= 0:
                numeric_ages.append(age)
        if numeric_ages:
            average_age = sum(numeric_ages) / len(numeric_ages)
    if average_age > 10:
        flags.append("Old equipment")

    missing_serials = any(equipment.get("serialNumber") in (None, "", 0) for equipment in equipment_list)
    if missing_serials:
        flags.append("Missing serial numbers")

    if trade_in_present:
        flags.append("Trade-in present")

    return flags
