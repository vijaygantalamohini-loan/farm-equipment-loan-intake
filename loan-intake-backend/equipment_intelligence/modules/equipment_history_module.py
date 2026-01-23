from datetime import datetime, timedelta

def equipment_history_module(serial, hours):
    now = datetime.utcnow()
    history = [
        {"event": "Auctioned at Midwest Farm Expo", "date": (now - timedelta(days=180)).isoformat()},
        {"event": "Serviced in Des Moines", "date": (now - timedelta(days=90)).isoformat()},
    ]
    hour_flag = "inconsistent" if hours and hours > 4000 else "consistent"
    return {
        "serial": serial,
        "history": history,
        "hour_consistency": hour_flag,
        "last_seen": history[0]["date"],
    }
