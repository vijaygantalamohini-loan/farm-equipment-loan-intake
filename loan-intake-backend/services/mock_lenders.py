"""
Mock Lender Services
Simulates responses from different agricultural equipment lenders
"""
import random
from typing import Dict, List, Optional, Any
from datetime import datetime


class LenderOffer:
    """Represents a loan offer from a lender"""
    def __init__(
        self,
        lender_name: str,
        decision: str,  # "approved", "declined", "conditional"
        approved_amount: Optional[float] = None,
        interest_rate: Optional[float] = None,
        term_months: Optional[int] = None,
        monthly_payment: Optional[float] = None,
        conditions: List[str] = None,
        decline_reason: Optional[str] = None,
        acknowledged: bool = True,
        acknowledged_at: Optional[str] = None,
    ):
        self.lender_name = lender_name
        self.decision = decision
        self.approved_amount = approved_amount
        self.interest_rate = interest_rate
        self.term_months = term_months
        self.monthly_payment = monthly_payment
        self.conditions = conditions or []
        self.decline_reason = decline_reason
        self.offer_id = f"{lender_name.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        self.acknowledged = acknowledged
        self.acknowledged_at = acknowledged_at or (datetime.now().isoformat() if acknowledged else None)

    def to_dict(self) -> Dict:
        """Convert offer to dictionary"""
        return {
            "offer_id": self.offer_id,
            "lender_name": self.lender_name,
            "decision": self.decision,
            "approved_amount": self.approved_amount,
            "interest_rate": self.interest_rate,
            "term_months": self.term_months,
            "monthly_payment": self.monthly_payment,
            "conditions": self.conditions,
            "decline_reason": self.decline_reason,
            "generated_at": datetime.now().isoformat(),
            "acknowledged": self.acknowledged,
            "acknowledged_at": self.acknowledged_at,
        }


def _safe_number(value: Any, default: float = 0.0) -> float:
    """
    Coerce common input shapes (str/None/float/int) to float.
    Avoids ValueError exceptions blowing up lender evaluation.
    """
    if value is None:
        return default
    try:
        if isinstance(value, str) and value.strip() == "":
            return default
        return float(value)
    except Exception:
        return default


class AgCredit:
    """
    Mock Lender: AgCredit Financial
    Conservative lender, good rates for strong borrowers
    """
    name = "AgCredit Financial"
    
    @staticmethod
    def evaluate(application_data: Dict) -> LenderOffer:
        """Evaluate loan application"""
        borrower = application_data.get("borrower", {})
        loan = application_data.get("loan", {})
        
        annual_income = _safe_number(borrower.get("annualIncome"), 0)
        requested_amount = sum(_safe_number(asset.get("valueEstimate"), 0)
                              for asset in (loan.get("purchaseAssets") or []))
        cash_down = _safe_number(loan.get("cashDown"), 0)
        loan_amount = requested_amount - cash_down
        
        # Conservative approval criteria
        debt_to_income = (loan_amount * 0.02) / (annual_income / 12) if annual_income > 0 else 1.0
        
        if annual_income < 40000:
            return LenderOffer(
                lender_name=AgCredit.name,
                decision="declined",
                decline_reason="Annual income below minimum threshold of $40,000"
            )
        
        if debt_to_income > 0.35:
            return LenderOffer(
                lender_name=AgCredit.name,
                decision="declined",
                decline_reason="Debt-to-income ratio exceeds maximum of 35%"
            )
        
        if loan_amount > annual_income * 1.5:
            return LenderOffer(
                lender_name=AgCredit.name,
                decision="declined",
                decline_reason="Loan amount exceeds 1.5x annual income"
            )
        
        # Approved - calculate terms
        term_months = 60 if loan_amount < 100000 else 84
        interest_rate = 6.5 if annual_income > 75000 else 7.25
        
        # Calculate monthly payment
        monthly_rate = interest_rate / 100 / 12
        monthly_payment = (loan_amount * monthly_rate * (1 + monthly_rate) ** term_months) / \
                         ((1 + monthly_rate) ** term_months - 1)
        
        conditions = ["Proof of income required", "Equipment inspection required"]
        if cash_down < requested_amount * 0.15:
            conditions.append("15% down payment required")
        
        return LenderOffer(
            lender_name=AgCredit.name,
            decision="approved" if not conditions or len(conditions) <= 2 else "conditional",
            approved_amount=loan_amount,
            interest_rate=interest_rate,
            term_months=term_months,
            monthly_payment=round(monthly_payment, 2),
            conditions=conditions
        )


class FarmEquipmentFinance:
    """
    Mock Lender: Farm Equipment Finance Corp
    Aggressive lender, higher rates, more approvals
    """
    name = "Farm Equipment Finance Corp"
    
    @staticmethod
    def evaluate(application_data: Dict) -> LenderOffer:
        """Evaluate loan application"""
        borrower = application_data.get("borrower", {})
        loan = application_data.get("loan", {})
        
        annual_income = _safe_number(borrower.get("annualIncome"), 0)
        requested_amount = sum(_safe_number(asset.get("valueEstimate"), 0)
                              for asset in (loan.get("purchaseAssets") or []))
        cash_down = _safe_number(loan.get("cashDown"), 0)
        loan_amount = requested_amount - cash_down
        
        # More lenient criteria
        if annual_income < 25000:
            return LenderOffer(
                lender_name=FarmEquipmentFinance.name,
                decision="declined",
                decline_reason="Annual income below minimum threshold of $25,000"
            )
        
        if loan_amount > annual_income * 2.5:
            # Offer reduced amount
            approved_amount = annual_income * 2.0
            conditions = [f"Loan amount reduced from ${loan_amount:,.2f} to ${approved_amount:,.2f}"]
        else:
            approved_amount = loan_amount
            conditions = []
        
        # Higher rates but more flexible
        term_months = 72 if loan_amount < 75000 else 96
        
        # Rate based on income tiers
        if annual_income > 100000:
            interest_rate = 7.5
        elif annual_income > 60000:
            interest_rate = 8.75
        else:
            interest_rate = 9.5
        
        # Calculate monthly payment
        monthly_rate = interest_rate / 100 / 12
        monthly_payment = (approved_amount * monthly_rate * (1 + monthly_rate) ** term_months) / \
                         ((1 + monthly_rate) ** term_months - 1)
        
        conditions.append("Equipment must be less than 5 years old")
        
        return LenderOffer(
            lender_name=FarmEquipmentFinance.name,
            decision="conditional" if approved_amount < loan_amount else "approved",
            approved_amount=approved_amount,
            interest_rate=interest_rate,
            term_months=term_months,
            monthly_payment=round(monthly_payment, 2),
            conditions=conditions
        )


class GreenValleyCapital:
    """
    Mock Lender: Green Valley Capital
    Specializes in dairy/livestock, moderate terms
    """
    name = "Green Valley Capital"
    
    @staticmethod
    def evaluate(application_data: Dict) -> LenderOffer:
        """Evaluate loan application"""
        borrower = application_data.get("borrower", {})
        loan = application_data.get("loan", {})
        
        annual_income = _safe_number(borrower.get("annualIncome"), 0)
        requested_amount = sum(_safe_number(asset.get("valueEstimate"), 0)
                              for asset in (loan.get("purchaseAssets") or []))
        cash_down = _safe_number(loan.get("cashDown"), 0)
        loan_amount = requested_amount - cash_down
        naics_code = loan.get("naicsCode")
        
        # Check if dairy/livestock (NAICS 1121 or 1122)
        is_dairy_livestock = naics_code and str(naics_code).startswith(("1121", "1122"))
        
        if annual_income < 35000:
            return LenderOffer(
                lender_name=GreenValleyCapital.name,
                decision="declined",
                decline_reason="Annual income below minimum threshold of $35,000"
            )
        
        # Better rates for dairy/livestock
        if is_dairy_livestock:
            interest_rate = 6.75
            max_loan_multiple = 2.0
            conditions = ["Specialty rate for dairy/livestock operations"]
        else:
            interest_rate = 7.75
            max_loan_multiple = 1.75
            conditions = []
        
        if loan_amount > annual_income * max_loan_multiple:
            return LenderOffer(
                lender_name=GreenValleyCapital.name,
                decision="declined",
                decline_reason=f"Loan amount exceeds {max_loan_multiple}x annual income"
            )
        
        term_months = 60 if loan_amount < 80000 else 72
        
        # Calculate monthly payment
        monthly_rate = interest_rate / 100 / 12
        monthly_payment = (loan_amount * monthly_rate * (1 + monthly_rate) ** term_months) / \
                         ((1 + monthly_rate) ** term_months - 1)
        
        conditions.append("Annual financial review required")
        if cash_down < requested_amount * 0.10:
            conditions.append("10% down payment required")
        
        return LenderOffer(
            lender_name=GreenValleyCapital.name,
            decision="approved",
            approved_amount=loan_amount,
            interest_rate=interest_rate,
            term_months=term_months,
            monthly_payment=round(monthly_payment, 2),
            conditions=conditions
        )


class PrairieStateBank:
    """
    Mock Lender: Prairie State Bank
    Local bank, personalized service, moderate criteria
    """
    name = "Prairie State Bank"
    
    @staticmethod
    def evaluate(application_data: Dict) -> LenderOffer:
        """Evaluate loan application"""
        borrower = application_data.get("borrower", {})
        loan = application_data.get("loan", {})
        
        annual_income = _safe_number(borrower.get("annualIncome"), 0)
        requested_amount = sum(_safe_number(asset.get("valueEstimate"), 0)
                              for asset in (loan.get("purchaseAssets") or []))
        cash_down = _safe_number(loan.get("cashDown"), 0)
        loan_amount = requested_amount - cash_down
        
        if annual_income < 30000:
            return LenderOffer(
                lender_name=PrairieStateBank.name,
                decision="declined",
                decline_reason="Annual income below minimum threshold of $30,000"
            )
        
        # Moderate approval criteria
        if loan_amount > annual_income * 1.8:
            return LenderOffer(
                lender_name=PrairieStateBank.name,
                decision="declined",
                decline_reason="Loan amount exceeds 1.8x annual income"
            )
        
        # Competitive rates, relationship-based
        term_months = 60
        
        if annual_income > 80000:
            interest_rate = 6.9
        elif annual_income > 50000:
            interest_rate = 7.5
        else:
            interest_rate = 8.25
        
        # Calculate monthly payment
        monthly_rate = interest_rate / 100 / 12
        monthly_payment = (loan_amount * monthly_rate * (1 + monthly_rate) ** term_months) / \
                         ((1 + monthly_rate) ** term_months - 1)
        
        conditions = [
            "Personal guarantee required",
            "Equipment must be insured with bank as lienholder"
        ]
        
        return LenderOffer(
            lender_name=PrairieStateBank.name,
            decision="approved",
            approved_amount=loan_amount,
            interest_rate=interest_rate,
            term_months=term_months,
            monthly_payment=round(monthly_payment, 2),
            conditions=conditions
        )


class MockLenderService:
    """Service to aggregate offers from all mock lenders"""
    
    LENDERS = [
        AgCredit,
        FarmEquipmentFinance,
        GreenValleyCapital,
        PrairieStateBank
    ]
    # In-memory staggered acknowledgment schedule per application and lender
    # key: (application_id, lender_name) -> { 'due_at': iso-string }
    ACK_SCHEDULES: Dict[tuple, Dict[str, str]] = {}
    
    @staticmethod
    def get_all_offers(application_data: Dict) -> List[Dict]:
        """
        Submit application to all lenders and return aggregated offers
        """
        offers = []
        app_id = application_data.get("id")
        # Configure stagger window via env or defaults (in seconds)
        try:
            import os
            min_s = int(os.getenv("ACK_MIN_SECONDS", "5"))
            max_s = int(os.getenv("ACK_MAX_SECONDS", "20"))
            if min_s > max_s:
                min_s, max_s = max_s, min_s
        except Exception:
            min_s, max_s = 5, 20
        
        for lender in MockLenderService.LENDERS:
            try:
                offer = lender.evaluate(application_data)
                od = offer.to_dict()
                # Apply staggered acknowledgment per lender
                if app_id is not None:
                    key = (app_id, lender.name)
                    now = datetime.now()
                    sched = MockLenderService.ACK_SCHEDULES.get(key)
                    if not sched:
                        delay = random.randint(min_s, max_s)
                        due_at = (now.replace(microsecond=0)).timestamp() + delay
                        MockLenderService.ACK_SCHEDULES[key] = {"due_at": str(due_at)}
                        od["acknowledged"] = False
                        od["acknowledged_at"] = None
                    else:
                        try:
                            due_ts = float(sched.get("due_at", "0"))
                        except Exception:
                            due_ts = 0.0
                        if now.timestamp() >= due_ts:
                            od["acknowledged"] = True
                            od["acknowledged_at"] = datetime.now().isoformat()
                        else:
                            od["acknowledged"] = False
                            od["acknowledged_at"] = None
                offers.append(od)
            except Exception as e:
                # Log error but continue with other lenders
                print(f"Error evaluating with {lender.name}: {str(e)}")
                continue
        
        # Sort by decision (approved first) then by rate
        offers.sort(key=lambda x: (
            0 if x["decision"] == "approved" else 1 if x["decision"] == "conditional" else 2,
            x["interest_rate"] if x["interest_rate"] else 999
        ))
        
        return offers
    
    @staticmethod
    def get_best_offers(application_data: Dict, limit: int = 3) -> List[Dict]:
        """Get top N best offers"""
        all_offers = MockLenderService.get_all_offers(application_data)
        approved_offers = [o for o in all_offers if o["decision"] in ["approved", "conditional"]]
        return approved_offers[:limit]
