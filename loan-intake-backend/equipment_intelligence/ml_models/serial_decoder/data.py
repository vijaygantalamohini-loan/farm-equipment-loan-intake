from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

import pandas as pd

from equipment_intelligence.ml_models.model_utils import DATASET_PATH


@dataclass
class SerialRecord:
    serial: str
    make: str
    model: str
    year: int


def load_serial_dataset(min_samples: int = 200) -> pd.DataFrame:
    """Load rows with a usable serial number from the combined dataset."""
    if not DATASET_PATH.exists():
        raise FileNotFoundError(f"Combined dataset not found at {DATASET_PATH}")

    df = pd.read_csv(DATASET_PATH)
    df = df.copy()
    df["serial_number"] = df.get("serial_number", "").astype(str).str.strip()
    df = df[df["serial_number"].str.len() >= 6]
    df = df.dropna(subset=["make", "model", "year"])
    df["make"] = df["make"].str.strip()
    df["model"] = df["model"].str.strip()
    df["year"] = pd.to_numeric(df["year"], errors="coerce").astype("Int64")
    df = df.dropna(subset=["year"])
    df["year"] = df["year"].astype(int)
    df = df[df["year"] >= 1980]

    if len(df) < min_samples:
        raise ValueError(
            f"Serial dataset has only {len(df)} rows; expected at least {min_samples}."
        )

    return df[["serial_number", "make", "model", "year"]].rename(
        columns={"serial_number": "serial"}
    )
