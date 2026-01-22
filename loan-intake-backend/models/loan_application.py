"""Domain models and helper utilities for loan application payloads."""

from __future__ import annotations

from typing import Optional, TypedDict, Any, List


class FarmIncomeEntryDict(TypedDict, total=False):
    year: int
    income: Optional[float]
    notFiled: Optional[bool]


class BorrowerOperationalDetails(TypedDict, total=False):
    farmType: Optional[str]
    acresOwned: Optional[float]
    acresLeased: Optional[float]
    farmWebsite: Optional[str]
    farmsocialmediaaccount: Optional[str]
    yearsInOperation: Optional[int]
    farmIncomeLast3Years: Optional[List[FarmIncomeEntryDict]]
    naicsCode: Optional[str]
    farmLegalEntity: Optional[str]


class BorrowerCreditRiskSignals(TypedDict, total=False):
    softCreditPullConsent: Optional[str]
    existingFarmDebt: Optional[float]
    personalDebt: Optional[float]
    insuranceStatus: Optional[str]
    bankruptcyHistory: Optional[str]
    priorLoanDefaults: Optional[str]
    priorRepossess: Optional[str]
    priorRepossession: Optional[str]
    taxLienHistory: Optional[str]


class BorrowerIntakePayload(BorrowerOperationalDetails, BorrowerCreditRiskSignals, TypedDict, total=False):
    firstName: Optional[str]
    lastName: Optional[str]
    dateOfBirth: Optional[str]
    ssn: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    employerName: Optional[str]
    annualIncome: Optional[str]
    status: Optional[str]


BORROWER_OPTIONAL_FIELD_KEYS = [
    "farmType",
    "acresOwned",
    "acresLeased",
    "farmWebsite",
    "farmsocialmediaaccount",
    "yearsInOperation",
    "farmIncomeLast3Years",
    "naicsCode",
    "farmLegalEntity",
    "softCreditPullConsent",
    "existingFarmDebt",
    "personalDebt",
    "insuranceStatus",
    "bankruptcyHistory",
    "priorLoanDefaults",
    "priorRepossess",
    "priorRepossession",
    "taxLienHistory",
]


def apply_borrower_field_defaults(payload: dict[str, Any] | None) -> dict[str, Any]:
    """Ensure new optional borrower fields are always present for downstream consumers."""
    normalized = dict(payload or {})
    for key in BORROWER_OPTIONAL_FIELD_KEYS:
        if key == "farmIncomeLast3Years":
            normalized.setdefault(key, [])
        else:
            normalized.setdefault(key, None)
    return normalized
