from __future__ import annotations

import argparse
import math
from pathlib import Path
from typing import List

import numpy as np
import pandas as pd


BASE_DIR = Path(__file__).parent
DATA_PATH = BASE_DIR / "data" / "synthetic_loans.csv"

EQUIPMENT_TYPES = [
    "Tractor",
    "Combine",
    "Harvester",
    "Skid Steer",
    "Planter",
    "Sprayer",
    "Baler",
    "Loader",
]

NAICS_CODES = [
    "1111",
    "1112",
    "1113",
    "1119",
    "1121",
    "1151",
    "1152",
    "4238",
    "3331",
]

DEALER_STATES = [
    "IA",
    "IL",
    "IN",
    "KS",
    "MN",
    "MO",
    "ND",
    "NE",
    "SD",
    "WI",
]


def _sigmoid(value: float) -> float:
    return 1.0 / (1.0 + math.exp(-value))


def _risk_flags(
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


def generate_synthetic_data(
    num_samples: int = 10_000,
    output_path: Path = DATA_PATH,
    random_state: int = 42,
) -> pd.DataFrame:
    rng = np.random.default_rng(random_state)
    rows = []

    for _ in range(num_samples):
        equipment_value = float(rng.uniform(45000.0, 350000.0))
        down_payment_percent = float(np.clip(rng.normal(0.18, 0.08), 0.0, 0.5))
        down_payment = float(equipment_value * down_payment_percent)
        loan_amount = float(max(equipment_value - down_payment, 5000.0))
        ltv = float(loan_amount / equipment_value)

        borrower_income = float(np.clip(rng.normal(105000.0, 45000.0), 30000.0, 500000.0))
        credit_score = float(np.clip(rng.normal(685.0, 55.0), 520.0, 830.0))
        term_months = int(np.clip(rng.normal(60.0, 12.0), 36, 84))

        prior_defaults_logit = (
            -3.2
            + 0.006 * max(0.0, 640.0 - credit_score)
            + 0.00002 * max(0.0, 70000.0 - borrower_income)
            + 1.1 * max(0.0, ltv - 0.9)
        )
        prior_defaults = int(rng.random() < _sigmoid(prior_defaults_logit))

        bankruptcy_logit = -4.2 + 1.4 * prior_defaults + 0.006 * max(0.0, 610.0 - credit_score)
        bankruptcy_history = int(rng.random() < _sigmoid(bankruptcy_logit))

        risk_flags = _risk_flags(
            borrower_income,
            credit_score,
            ltv,
            down_payment_percent,
            term_months,
            prior_defaults,
            bankruptcy_history,
        )
        flag_count = len(risk_flags)

        approval_logit = (
            1.4
            + 0.00002 * (borrower_income - 90000.0)
            + 0.02 * (credit_score - 680.0)
            - 4.0 * (ltv - 0.85)
            + 2.6 * (down_payment_percent - 0.18)
            - 1.3 * prior_defaults
            - 1.6 * bankruptcy_history
            - 0.25 * ((term_months - 60) / 12)
            - 0.15 * flag_count
        )
        approval_probability = float(np.clip(_sigmoid(approval_logit), 0.02, 0.98))
        approved = int(rng.random() < approval_probability)

        loss_logit = (
            -2.0
            + 3.1 * (ltv - 0.85)
            + 0.02 * max(0.0, 690.0 - credit_score)
            + 0.00003 * max(0.0, 90000.0 - borrower_income)
            + 1.3 * prior_defaults
            + 1.6 * bankruptcy_history
            + 0.2 * ((term_months - 60) / 12)
            + 0.12 * flag_count
        )
        default_risk = _sigmoid(loss_logit)
        loss_rate = float(np.clip(default_risk * (0.1 + 0.2 * ltv), 0.005, 0.35))

        rows.append(
            {
                "borrower_income": round(borrower_income, 2),
                "credit_score": round(credit_score, 0),
                "naics_code": str(rng.choice(NAICS_CODES)),
                "equipment_type": str(rng.choice(EQUIPMENT_TYPES)),
                "loan_amount": round(loan_amount, 2),
                "down_payment": round(down_payment, 2),
                "term_months": term_months,
                "dealer_state": str(rng.choice(DEALER_STATES)),
                "ltv": round(ltv, 4),
                "prior_defaults": prior_defaults,
                "bankruptcy_history": bankruptcy_history,
                "risk_flags": ";".join(risk_flags),
                "approved": approved,
                "loss_rate": round(loss_rate, 4),
            }
        )

    df = pd.DataFrame(rows)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)
    return df


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate synthetic loan prequalification data.")
    parser.add_argument("--rows", type=int, default=10_000, help="Number of samples to generate.")
    parser.add_argument("--output", type=Path, default=DATA_PATH, help="Output CSV path.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed.")
    args = parser.parse_args()

    generate_synthetic_data(
        num_samples=args.rows,
        output_path=args.output,
        random_state=args.seed,
    )
    print(f"Saved synthetic data to {args.output}")


if __name__ == "__main__":
    main()

