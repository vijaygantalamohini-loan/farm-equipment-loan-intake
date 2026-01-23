import pandas as pd
from datetime import datetime

def scrape_fastline():
    rows = [
        {
            "make": "Vermeer",
            "model": "RTX1250",
            "year": 2019,
            "hours": 720,
            "price": 105000,
            "location": "Sioux Falls, SD",
            "condition": "Good",
            "serial_number": "1VDRT1X0XKN123456",
            "source": "Fastline",
            "timestamp": datetime.utcnow(),
        },
        {
            "make": "Case",
            "model": "580N",
            "year": 2017,
            "hours": 980,
            "price": 72000,
            "location": "Lincoln, NE",
            "condition": "Fair",
            "serial_number": "LJE580NKM12345678",
            "source": "Fastline",
            "timestamp": datetime.utcnow(),
        },
    ]
    return pd.DataFrame(rows)
