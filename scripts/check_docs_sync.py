#!/usr/bin/env python3
"""
Fail CI when auto-generated doc sections are out of sync.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from typing import List


ROOT = Path(__file__).resolve().parents[1]


def _run_git(args: List[str]) -> str:
    return subprocess.check_output(["git", *args], text=True).strip()


def _run_generator() -> None:
    generator = ROOT / "scripts" / "generate_docs.py"
    if not generator.exists():
        print("Docs sync check skipped: generator not found.")
        return
    subprocess.run([sys.executable, str(generator)], check=True)


def _get_dirty_docs() -> List[str]:
    diff = _run_git(["status", "--porcelain", "--", "docs"])
    return [line.strip() for line in diff.splitlines() if line.strip()]


def main() -> int:
    docs_dir = ROOT / "docs"
    if not docs_dir.exists():
        print("Docs sync check skipped: docs/ missing.")
        return 0

    try:
        _run_generator()
    except subprocess.CalledProcessError:
        print("Docs sync check failed: generator error.")
        return 1

    try:
        dirty_docs = _get_dirty_docs()
    except subprocess.CalledProcessError:
        print("Docs sync check failed: git status error.")
        return 1

    if dirty_docs:
        print("Docs check failed: docs are out of sync with generator.")
        print("Run `python scripts/generate_docs.py` and commit the changes.")
        return 1

    print("Docs check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
