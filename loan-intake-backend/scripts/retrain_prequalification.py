from __future__ import annotations

import subprocess

from ai_prequalification.model_training import train_all_models


def run_retraining_cycle(
    num_samples: int = 1500,
    approval_rate: float = 0.5,
    random_state: int = 42,
    run_tests: bool = True,
) -> None:
    """Regenerate training data, retrain calibrated models, and optionally run tests."""

    train_all_models(refresh_data=True, num_samples=num_samples, approval_rate=approval_rate)

    if run_tests:
        subprocess.run(["pytest", "test_prequalification.py"], check=True)


if __name__ == "__main__":
    run_retraining_cycle()
