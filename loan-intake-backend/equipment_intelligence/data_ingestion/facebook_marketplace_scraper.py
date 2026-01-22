import pandas as pd
from datetime import datetime

def scrape_facebook_marketplace():
    rows = [
        {
            "make": "John Deere",
            "model": "S780",
            "year": 2021,
            "hours": 350,
            "price": 340000,
            "location": "Madison, WI",
            "condition": "Excellent",
            "serial_number": "1H0S780SMDR123456",
            "source": "FacebookMarketplace",
            "timestamp": datetime.utcnow(),
        },
        {
            "make": "Gleaner",
            "model": "S9",
            "year": 2019,
            "hours": 800,
            "price": 280000,
            "location": "Minneapolis, MN",
            "condition": "Good",
            "serial_number": "ZBG2S9ALMN123456",
            "source": "FacebookMarketplace",
            "timestamp": datetime.utcnow(),
        },
    ]
    return pd.DataFrame(rows)
