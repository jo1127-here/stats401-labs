import argparse
import csv
import json
import math
from pathlib import Path
from urllib.request import urlopen

BOUNDARY_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson'
ROOT = Path(__file__).resolve().parent

def prepare(csv_path, geo_path, download=False):
    if not csv_path.exists():
        raise ValueError(f'Missing instructor dataset: {csv_path}')
    with csv_path.open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        required = {'iso3', 'country', 'gdp_2025_billion_usd', 'rank'}
        if not required.issubset(reader.fieldnames or []):
            raise ValueError(f'CSV requires columns: {sorted(required)}')
        rows = list(reader)
    if len(rows) != 50:
        raise ValueError(f'Expected 50 economies; found {len(rows)}')
    identifiers, ranks = set(), set()
    for row in rows:
        iso = row['iso3'].strip().upper()
        value = float(row['gdp_2025_billion_usd'])
        rank = int(row['rank'])
        if len(iso) != 3 or not iso.isascii() or not iso.isalpha() or iso in identifiers:
            raise ValueError(f'Invalid or duplicate ISO-3: {iso}')
        if not math.isfinite(value) or value <= 0 or not row['country'].strip():
            raise ValueError(f'Invalid GDP/name for {iso}')
        identifiers.add(iso)
        ranks.add(rank)
    if ranks != set(range(1, 51)):
        raise ValueError('Ranks must be unique integers 1–50')
    if download:
        with urlopen(BOUNDARY_URL, timeout=60) as response:
            geo = json.load(response)
    else:
        if not geo_path.exists():
            raise ValueError('Provide data/world.geojson, or run with --download-world')
        geo = json.loads(geo_path.read_text(encoding='utf-8'))
    if geo.get('type') != 'FeatureCollection':
        raise ValueError('GeoJSON must be a FeatureCollection')
    matched = set()
    for feature in geo['features']:
        props = feature['properties']
        iso = str(props.get('iso3') or props.get('ISO3166-1-Alpha-3') or props.get('ISO_A3') or feature.get('id') or '').upper()
        props['iso3'] = iso
        props['name'] = props.get('name') or props.get('ADMIN') or iso
        matched.add(iso)
    missing = identifiers - matched
    if missing:
        raise ValueError(f'Unmatched GDP identifiers: {sorted(missing)}. Correct boundaries/ISO codes; do not silently omit economies.')
    geo_path.parent.mkdir(parents=True, exist_ok=True)
    geo_path.write_text(json.dumps(geo, separators=(',', ':')), encoding='utf-8')
    report = {'gdp_rows': len(rows), 'matched_economies': len(identifiers), 'unmatched': sorted(missing), 'boundaries': len(geo['features']), 'boundary_source': BOUNDARY_URL if download else 'user-provided world.geojson'}
    (ROOT / 'data' / 'join_report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--csv', type=Path, default=ROOT / 'data' / 'lab9_gdp_2025_top50.csv')
    parser.add_argument('--geo', type=Path, default=ROOT / 'data' / 'world.geojson')
    parser.add_argument('--download-world', action='store_true')
    args = parser.parse_args()
    try:
        prepare(args.csv, args.geo, args.download_world)
    except (ValueError, OSError, KeyError) as error:
        parser.exit(1, f'Data preparation failed: {error}\n')
