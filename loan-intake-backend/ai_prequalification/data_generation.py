from __future__ import annotations

import math
from pathlib import Path
from typing import Sequence

import numpy as np
import pandas as pd

EQUIPMENT_TYPES: Sequence[str] = (
    "Tractor",
    "Combine",
    "Harvester",
    "Loader",
    "Sprayer",
    "Tillage",
    "Planter",
)

BORROWER_STATES: Sequence[str] = (
    "IA",
    "IL",
    "IN",
    "KS",
    "MN",
    "MO",
    "NE",
    "ND",
    "OH",
    "OK",
    "SD",
    "WI",
)

NAICS_CODES: Sequence[str] = (
    "1111",
    "1112",
    "1113",
    "1119",
    "1121",
    "1151",
    "1152",
    "4238",
    "3331",
)


def _sigmoid(value: float) -> float:
    return 1.0 / (1.0 + math.exp(-value))


def generate_synthetic_dataset(
    path: Path,
    num_samples: int = 1200,
    approval_rate: float = 0.5,
    random_state: int = 42,
) -> pd.DataFrame:
    """Generate a synthetic dataset with balanced approvals and realistic risk metrics."""

    rng = np.random.default_rng(random_state)
    rows = []
    approval_target = np.clip(approval_rate, 0.2, 0.8)

    for _ in range(num_samples):
        equipment_value = rng.uniform(60000.0, 325000.0)
        ltv = float(np.clip(rng.normal(0.88, 0.18), 0.45, 1.35))
        loan_amount = float(ltv * equipment_value)

        down_payment_percent = float(np.clip(rng.normal(0.19, 0.09), 0.0, 0.55))
        borrower_income = float(np.clip(rng.normal(118000.0, 52000.0), 40000.0, 325000.0))
        credit_score = float(np.clip(rng.normal(690.0, 55.0), 520.0, 830.0))
        trade_in_present = float(rng.random() < 0.32)
        missing_serial_indicator = float(rng.random() < (0.12 + 0.25 * trade_in_present))

        asset_count = int(rng.integers(1, 4))
        asset_ages = rng.integers(0, 18, size=asset_count)
        equipment_age = float(asset_ages.mean())
        equipment_age_variance = float(asset_ages.var()) if asset_count > 1 else 0.0

        flag_count = 0
        if ltv > 1.05:
            flag_count += 1
        elif ltv > 0.9:
            flag_count += 1
        if down_payment_percent < 0.15:
            flag_count += 1
        if borrower_income < 60000:
            flag_count += 1
        if credit_score < 650:
            flag_count += 1
        if equipment_age > 10:
            flag_count += 1
        if missing_serial_indicator:
            flag_count += 1
        if trade_in_present:
            flag_count += 1

        noise = rng.normal(0.0, 4.5)
        risk_score = float(
            np.clip(
                22.0
                + 42.0 * max(0.0, ltv - 0.8)
                + 36.0 * max(0.15 - down_payment_percent, 0.0)
                + 0.06 * max(700.0 - credit_score, 0.0)
                + 0.00018 * max(95000.0 - borrower_income, 0.0)
                + 7.5 * flag_count
                + noise,
                0.0,
                100.0,
            )
        )

        base_logit = (
            2.25
            - 4.4 * (ltv - 0.85)
            + 0.024 * (credit_score - 675.0)
            + 3.1 * (down_payment_percent - 0.18)
            + 0.000018 * (borrower_income - 115000.0)
            - 1.35 * flag_count
            - 1.0 * missing_serial_indicator
        )
        calibrated_logit = base_logit + math.log(approval_target / (1.0 - approval_target))
        approval_probability = _sigmoid(calibrated_logit)
        approval_probability = float(np.clip(approval_probability, 0.02, 0.98))
        approval = int(rng.random() < approval_probability)

        optimal_down_payment_percent = float(
            np.clip(
                down_payment_percent + 0.05 + 0.002 * (100.0 - risk_score) - 0.03 * trade_in_present,
                0.05,
                0.5,
            )
        )
        optimal_term_months = int(
            np.clip(
                rng.normal(72.0 + 10.0 * (ltv - 0.8) + 4.0 * trade_in_present, 8.0),
                36,
                96,
            )
        )

        rows.append(
            {
                "loan_amount": round(loan_amount, 2),
                "equipment_age": equipment_age,
                "down_payment_percent": down_payment_percent,
                "ltv": ltv,
                "borrower_income": round(borrower_income, 2),
                "credit_score": credit_score,
                "trade_in_present": trade_in_present,
                "equipment_type": str(rng.choice(EQUIPMENT_TYPES)),
                "borrower_state": str(rng.choice(BORROWER_STATES)),
                "naics_code": str(rng.choice(NAICS_CODES)),
                "risk_flag_count": float(flag_count),
                "missing_serial_indicator": missing_serial_indicator,
                "equipment_age_variance": equipment_age_variance,
                "approval": approval,
                "risk_score": risk_score,
                "optimal_down_payment_percent": optimal_down_payment_percent,
                "optimal_term_months": optimal_term_months,
            }
        )

    df = pd.DataFrame(rows)
    df = df.sample(frac=1.0, random_state=random_state).reset_index(drop=True)
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)
    return df


__all__ = ["generate_synthetic_dataset"]
