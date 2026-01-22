"""Pydantic schemas for borrower operations."""

from pydantic import BaseModel


class BorrowerAddress(BaseModel):
    street: str | None = None
    city: str | None = None
    state: str | None = None
    zip: str | None = None

class FarmIncomeEntry(BaseModel):
    year: int
    income: float | None = None
    notFiled: bool | None = None


class BorrowerInfo(BaseModel):
    firstName: str | None = None
    lastName: str | None = None
    dateOfBirth: str | None = None
    ssn: str | None = None
    email: str | None = None
    phone: str | None = None
    address: BorrowerAddress = BorrowerAddress()
    employerName: str | None = None
    annualIncome: str | None = None
    status: str | None = None
    farmType: str | None = None
    acresOwned: float | None = None
    acresLeased: float | None = None
    farmWebsite: str | None = None
    farmsocialmediaaccount: str | None = None
    yearsInOperation: int | None = None
    farmIncomeLast3Years: list[FarmIncomeEntry] | None = None
    naicsCode: str | None = None
    farmLegalEntity: str | None = None
    softCreditPullConsent: str | None = None
    existingFarmDebt: float | None = None
    personalDebt: float | None = None
    insuranceStatus: str | None = None
    bankruptcyHistory: str | None = None
    priorLoanDefaults: str | None = None
    priorRepossess: str | None = None
    priorRepossession: str | None = None
    taxLienHistory: str | None = None
