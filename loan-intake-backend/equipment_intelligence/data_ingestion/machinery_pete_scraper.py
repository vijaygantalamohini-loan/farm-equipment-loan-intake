import pandas as pd
from datetime import datetime

def scrape_machinery_pete():
    rows = [
        {
            "make": "Kubota",
            "model": "M7-171",
            "year": 2021,
            "hours": 250,
            "price": 115000,
            "location": "St. Louis, MO",
            "condition": "Excellent",
            "serial_number": "1KMFH7BA0MB123456",
            "source": "MachineryPete",
            "timestamp": datetime.utcnow(),
        },
        {
            "make": "Massey Ferguson",
            "model": "MF 8S.265",
            "year": 2023,
            "hours": 20,
            "price": 145000,
            "location": "Fargo, ND",
            "condition": "New",
            "serial_number": "1PCMF8S265M123456",
            "source": "MachineryPete",
            "timestamp": datetime.utcnow(),
        },
    ]
    return pd.DataFrame(rows)
