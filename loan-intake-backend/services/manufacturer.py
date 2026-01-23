import json
from pathlib import Path

MANUFACTURERS_FILE = Path(__file__).parent.parent / "manufacturers.json"

def load_manufacturers():
    with open(MANUFACTURERS_FILE) as f:
        return json.load(f)