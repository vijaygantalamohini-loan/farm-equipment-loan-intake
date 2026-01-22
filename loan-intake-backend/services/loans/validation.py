"""
Validation helpers for borrower and loan data.

Keeps loan routes API-first by returning missing fields lists that the frontend
can use to guide users and skip irrelevant inputs.
"""

from typing import List, Dict, Optional


def normalize_borrower_type(borrower_type: Optional[str]) -> str:
    if not borrower_type:
        return "individual"
    return borrower_type.lower()


def missing_borrower_fields(data: Dict, borrower_type: str) -> List[str]:
    data = data or {}
    borrower_type = normalize_borrower_type(borrower_type)

    required = ["firstName", "lastName"]
    if borrower_type == "business":
        required = ["legalName", "entityType", "tin", "signerName", "signerTitle", "signerEmail", "signerPhone"]
    else:
        required += ["ssn", "dateOfBirth"]

    missing = [f for f in required if not data.get(f)]
    return missing


def missing_coborrower_fields(data: Dict) -> List[str]:
    data = data or {}
    required = ["firstName", "lastName", "ssn", "dateOfBirth"]
    return [f for f in required if not data.get(f)]


def missing_loan_fields(data: Dict) -> List[str]:
    data = data or {}
    required = [
        "equipmentType",
        "make",
        "model",
        "year",
        "condition",
        "purchasePrice",
        "cashDown",
        "termMonths",
    ]
    missing = [f for f in required if data.get(f) in (None, "", [])]

    # Trade-in serial number is optional: don't block progress if absent
    if data.get("hasTradeIn"):
        trade_ins = data.get("tradeIns") or []
        if not trade_ins:
            missing.append("tradeIns")
        # Serial numbers can be provided to help identification, but are not required

    return missing
