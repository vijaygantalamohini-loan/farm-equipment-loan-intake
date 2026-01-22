import pandas as pd

from equipment_intelligence.data_ingestion.tractor_zoom_scraper import scrape_tractor_zoom
from equipment_intelligence.data_ingestion.ritchie_bros_scraper import scrape_ritchie_bros
from equipment_intelligence.data_ingestion.machinery_pete_scraper import scrape_machinery_pete
from equipment_intelligence.data_ingestion.fastline_scraper import scrape_fastline
from equipment_intelligence.data_ingestion.facebook_marketplace_scraper import scrape_facebook_marketplace
from equipment_intelligence.data_ingestion.ironplanet_scraper import scrape_ironplanet


def combine_datasets():
    raw_frames = [
        scrape_tractor_zoom(),
        scrape_ritchie_bros(),
        scrape_machinery_pete(),
        scrape_fastline(),
        scrape_facebook_marketplace(),
        scrape_ironplanet(),
    ]

    frames = []
    for frame in raw_frames:
        if frame is None or frame.empty:
            continue
        if "timestamp" not in frame.columns:
            frame = frame.assign(timestamp=pd.Timestamp.utcnow())
        frames.append(frame)

    if not frames:
        return pd.DataFrame()

    records: list[dict] = []
    for frame in frames:
        records.extend(frame.to_dict("records"))

    combined = pd.DataFrame.from_records(records)
    if "timestamp" in combined.columns:
        combined["timestamp"] = pd.to_datetime(combined["timestamp"], errors="coerce")
    return combined


if __name__ == "__main__":
    df = combine_datasets()
    df.to_csv("combined_equipment_dataset.csv", index=False)
    print(f"Combined dataset saved with {len(df)} rows")
