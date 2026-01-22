import random
from pathlib import Path
from typing import Optional

import pandas as pd

DATASET_PATH = Path(__file__).resolve().parents[2] / "combined_equipment_dataset.csv"
ESSENTIAL_COLUMNS = ["make", "model", "region", "condition", "year", "hours", "price"]


def _extract_region(location: Optional[str]) -> str:
    if not location:
        return "NA"
    tokens = [part.strip() for part in str(location).split(",") if part.strip()]
    if not tokens:
        return "NA"
    last = tokens[-1].upper()
    if len(tokens) >= 2 and (last in {"USA", "UNITED STATES", "CAN", "CANADA"} or len(last) > 3):
        candidate = tokens[-2]
    else:
        candidate = tokens[-1]
    candidate = candidate.strip().upper()
    if len(candidate) > 5 and len(tokens) >= 2:
        candidate = tokens[-2].strip().upper()
    return candidate or "NA"


def _prepare_market_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    working = df.copy()

    for column in ("price", "year", "hours"):
        if column in working.columns:
            working[column] = pd.to_numeric(working[column], errors="coerce")
        else:
            working[column] = pd.NA

    working = working.dropna(subset=["make", "model", "price"])
    working = working[working["price"] > 0]

    if "region" not in working.columns:
        working["region"] = pd.NA
    if "location" in working.columns:
        working["region"] = working["region"].where(working["region"].notna(), working["location"].apply(_extract_region))
    working["region"] = working["region"].fillna("NA")

    if "condition" in working.columns:
        working["condition"] = working["condition"].fillna("Unknown")
    else:
        working["condition"] = "Unknown"

    hours_median = working["hours"].median(skipna=True)
    if pd.isna(hours_median):
        hours_median = 0
    working["hours"] = working["hours"].fillna(hours_median)

    year_median = working["year"].median(skipna=True)
    if pd.isna(year_median):
        year_median = 2015
    working["year"] = working["year"].fillna(round(year_median))

    prepared = working.reindex(columns=ESSENTIAL_COLUMNS, fill_value=pd.NA)
    prepared = prepared.fillna({"region": "NA", "condition": "Unknown"})
    prepared["year"] = prepared["year"].astype(int, errors="ignore")
    prepared["hours"] = prepared["hours"].astype(float, errors="ignore")

    return prepared


def load_market_dataset(min_rows: int = 200) -> pd.DataFrame:
    if DATASET_PATH.exists():
        df = pd.read_csv(DATASET_PATH)
        df = _prepare_market_dataframe(df)
        if not df.empty:
            if len(df) < min_rows:
                supplement = generate_equipment_dataframe(min_rows - len(df))
                df = pd.concat([df, supplement[ESSENTIAL_COLUMNS]], ignore_index=True)
            df = df.sample(frac=1.0, random_state=42).reset_index(drop=True)
            return df
    return generate_equipment_dataframe(max(min_rows, 200))


def generate_equipment_dataframe(num: int = 200) -> pd.DataFrame:
    makes = ["John Deere", "Case IH", "Caterpillar", "New Holland", "Kubota"]
    models = ["5075E", "Puma 165", "320", "CR9.80", "M7-171"]
    regions = ["IA", "NE", "KS", "IL", "TX"]
    conditions = ["Excellent", "Good", "Fair", "New"]
    rows = []
    for _ in range(num):
        year = random.randint(2005, 2023)
        hours = random.randint(50, 3200)
        base = random.uniform(60000, 320000)
        rows.append(
            {
                "make": random.choice(makes),
                "model": random.choice(models),
                "year": year,
                "hours": float(hours),
                "region": random.choice(regions),
                "condition": random.choice(conditions),
                "price": base * (1 - (2024 - year) * 0.03),
            }
        )
    return pd.DataFrame(rows)


def get_training_dataframe(min_rows: int = 200) -> pd.DataFrame:
    df = load_market_dataset(min_rows=min_rows)
    if set(df.columns) >= set(ESSENTIAL_COLUMNS):
        return df[ESSENTIAL_COLUMNS].copy()
    return df.reindex(columns=ESSENTIAL_COLUMNS)
