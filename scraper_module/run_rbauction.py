import asyncio
from pathlib import Path

from adapters.rbauction import main


def get_output_path() -> Path:
    base_dir = Path(__file__).resolve().parent
    return base_dir / 'output' / 'rbauction_listings.json'


if __name__ == '__main__':
    output_path = get_output_path()
    listings = asyncio.run(main(output_path=str(output_path), emit_stdout=False))
    print(f'Wrote {len(listings)} listings to {output_path}')
