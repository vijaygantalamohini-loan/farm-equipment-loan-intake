from pathlib import Path

import pytest

from ai_prequalification.train_model import train_model


@pytest.fixture(scope="session")
def prequal_model_dir(tmp_path_factory) -> Path:
    base_dir = tmp_path_factory.mktemp("prequal_model")
    model_path = base_dir / "prequal_model.pkl"
    data_path = base_dir / "synthetic_loans.csv"

    train_model(
        data_path=data_path,
        model_path=model_path,
        refresh_data=True,
        num_samples=400,
        random_state=7,
    )

    return base_dir

