import csv
import random
from pathlib import Path


def generate_sample_rows(total=500):
    equipment_types = ["Tractor", "Combine", "Planter", "Sprayer", "Harvester", "Loader"]
    states = ["IA", "IL", "NE", "KS", "SD", "MN", "WI", "TX", "OK", "NC"]
    naics_codes = ["1113", "1121", "3241", "4238", "1151", "9261", "5616", "2389"]

    rows = []
    random.seed(42)
    for _ in range(total):
        loan_amount = round(random.uniform(25000, 250000), 2)
        ltv = round(random.uniform(0.5, 1.2), 3)
        equipment_value = loan_amount / max(ltv, 0.1)
        down_payment_percent = round(random.uniform(0.0, 0.4), 3)
        borrower_income = round(random.uniform(25000, 250000), 2)
        credit_score = random.randint(580, 800)
        trade_in_present = random.random() < 0.35
        equipment_type = random.choice(equipment_types)
        borrower_state = random.choice(states)
        naics_code = random.choice(naics_codes)
        equipment_age = random.randint(0, 15)

        approval_score = 0
        approval_score += 1 if credit_score >= 660 else 0
        approval_score += 1 if ltv <= 1.0 else 0
        approval_score += 1 if down_payment_percent >= 0.15 else 0
        approval_score += 1 if borrower_income >= 80000 else 0
        approval = 1 if approval_score >= 2 else 0

        risk_score = 50
        risk_score += (ltv - 0.7) * 40
        risk_score -= down_payment_percent * 30
        risk_score -= (credit_score - 650) / 5
        risk_score -= (borrower_income - 80000) / 4000
        risk_score += 5 if trade_in_present else 0
        risk_score = max(0, min(100, risk_score + random.uniform(-5, 5)))

        optimal_down_payment_percent = min(
            0.5, max(0.05, down_payment_percent + random.uniform(0.02, 0.1))
        )
        optimal_term_months = int(
            max(24, min(96, 84 - (ltv - 0.5) * 40 + random.randint(-5, 5)))
        )

        rows.append(
            {
                "loan_amount": round(loan_amount, 2),
                "equipment_age": equipment_age,
                "equipment_type": equipment_type,
                "down_payment_percent": round(down_payment_percent, 3),
                "ltv": round(ltv, 3),
                "borrower_income": round(borrower_income, 2),
                "borrower_state": borrower_state,
                "naics_code": naics_code,
                "credit_score": credit_score,
                "trade_in_present": int(trade_in_present),
                "approval": approval,
                "risk_score": round(risk_score, 2),
                "optimal_down_payment_percent": round(optimal_down_payment_percent, 3),
                "optimal_term_months": optimal_term_months,
            }
        )
    return rows


if __name__ == "__main__":
    target_path = Path(__file__).with_name("sample_training_data.csv")
    rows = generate_sample_rows()
    with target_path.open("w", newline="") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    print(f"Generated {len(rows)} rows into {target_path}")
