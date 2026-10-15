"""Refresh the README dark badge from Trendshift: python3 scripts/refresh_trendshift_badge.py.

Trendshift's official endpoint currently ignores theme=dark. Preserve its artwork
and current ranking verbatim, changing only the palette for our local dark copy.
The light badge remains the live official image. Rerun when the ranking improves.
"""

import json
from pathlib import Path
import re
import subprocess
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "https://trendshift.io/api/badge/repositories/22056"
PALETTE = {
    '#FFFFFF': '#221D21',
    '#4a0e99': '#58416E',
    '#49278e': '#C4A7FF',
    'rgb(67, 39, 135)': 'rgb(224, 204, 255)',
    'rgb(74, 14, 153)': 'rgb(196, 167, 255)',
}


def main():
    source = subprocess.run(
        ['curl', '--fail', '--silent', '--show-error', '--location',
         '--max-time', '30', '--retry', '2', SOURCE],
        check=True, capture_output=True, text=True, timeout=100,
    ).stdout
    tree = ET.fromstring(source)
    assert tree.tag == '{http://www.w3.org/2000/svg}svg', 'Expected official SVG'
    rank = re.search(r'#(\d+) Repository Of The Day', source)
    assert rank, 'Official badge layout changed; inspect before refreshing'
    dark = source
    for original, replacement in PALETTE.items():
        assert original in dark, f'Official palette changed: {original}'
        dark = dark.replace(original, replacement)
    assert list(tree.itertext()) == list(ET.fromstring(dark).itertext())
    # Attribute the source without affecting the SVG artwork or ranking.
    dark = dark.replace('<svg ', f'<!-- Local dark palette; artwork and ranking from {SOURCE}. -->\n<svg ', 1)
    output = ROOT / 'assets/badge-trendshift-dark.svg'
    temporary = output.with_suffix('.svg.tmp')
    try:
        temporary.write_text(dark)
        temporary.replace(output)
    finally:
        temporary.unlink(missing_ok=True)
    print(json.dumps({'status': 'ok', 'rank': int(rank[1]), 'file': str(output.relative_to(ROOT))}))


if __name__ == '__main__':
    main()
