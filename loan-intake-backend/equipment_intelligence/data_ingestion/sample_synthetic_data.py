import pandas as pd
import random
from datetime import datetime

SOURCES = ["TractorZoom", "RitchieBros", "MachineryPete", "Fastline", "FacebookMarketplace"]
MAKES = ["John Deere", "Case IH", "Caterpillar", "New Holland", "Kubota"]
MODELS = ["5075E", "Puma 165", "320", "CR9.80", "M7-171"]
CONDITIONS = ["Excellent", "Good", "Fair", "New"]


def generate_synthetic_rows(count=100):
    rows = []
    for _ in range(count):
        year = random.choice(range(2008, 2024))
        hours = random.choice([None, random.randint(50, 2500)])
        price = random.choice([None, round(random.uniform(40000, 400000), 0)])
        serial = random.choice([None, f"SN{random.randint(100000,999999)}"])
        condition = random.choice([None] + CONDITIONS)
        rows.append(
            {
                "make": random.choice(MAKES),
                "model": random.choice(MODELS),
                "year": year,
                "hours": hours,
                "price": price,
                "location": random.choice(["Iowa", "Nebraska", "Illinois", "Kansas"]),
                "condition": condition,
                "serial_number": serial,
                "source": random.choice(SOURCES),
                "timestamp": datetime.utcnow(),
            }
        )
    return pd.DataFrame(rows)


if __name__ == "__main__":
    df = generate_synthetic_rows(200)
    df.to_csv("synthetic_equipment_gap_data.csv", index=False)
    print(f"Generated synthetic dataset with {len(df)} rows")
