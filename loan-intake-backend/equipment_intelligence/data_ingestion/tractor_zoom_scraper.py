import pandas as pd
from datetime import datetime

def scrape_tractor_zoom():
    rows = [
        {
            "make": "John Deere",
            "model": "5075E",
            "year": 2022,
            "hours": 320,
            "price": 85000,
            "location": "Ames, IA",
            "condition": "Excellent",
            "serial_number": "1LV5075EXHN123456",
            "source": "TractorZoom",
            "timestamp": datetime.utcnow(),
        },
        {
            "make": "Case IH",
            "model": "Puma 165",
            "year": 2019,
            "hours": 540,
            "price": 92000,
            "location": "Des Moines, IA",
            "condition": "Good",
            "serial_number": "ZCATB365JPZ123456",
            "source": "TractorZoom",
            "timestamp": datetime.utcnow(),
        },
    ]
    return pd.DataFrame(rows)
