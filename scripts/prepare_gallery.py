#!/usr/bin/env python3
"""Render the curated issue #2 PDFs: python3 scripts/prepare_gallery.py [--only ID].

Requires curl, Poppler and cwebp. Sources are immutable; cached PDFs are kept in
the ignored .cache directory. No API keys or Python dependencies are required.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'frontend/src/landing/gallery'
OUTPUT = ROOT / 'frontend/public/gallery'


def run(*args):
    return subprocess.run(args, check=True, timeout=180, capture_output=True, text=True).stdout


def render(source):
    cache = ROOT / '.cache/gallery'
    cache.mkdir(parents=True, exist_ok=True)
    pdf = cache / (source['id'] + '.pdf')
    if not pdf.exists():
        temporary = pdf.with_suffix('.part')
        try:
            run('curl', '-fLsS', '--max-time', '150', '--retry', '2', source['pdf'], '-o', str(temporary))
            run('pdfinfo', str(temporary))
            temporary.replace(pdf)
        finally:
            temporary.unlink(missing_ok=True)
    with tempfile.TemporaryDirectory(prefix='gallery-') as temp:
        folder = Path(temp)
        run('pdftoppm', '-scale-to', '1600', '-png', str(pdf), str(folder / 'page'))
        pages = sorted(folder.glob('page-*.png'), key=lambda p: int(p.stem.split('-')[-1]))
        if not pages:
            raise ValueError(f"No pages rendered: {source['id']}")
        destination = OUTPUT / source['id']
        destination.mkdir(parents=True, exist_ok=True)
        sizes = []
        for number, png in enumerate(pages, 1):
            # PNG IHDR contains dimensions; avoid another imaging dependency.
            raw = png.read_bytes()
            width, height = int.from_bytes(raw[16:20], 'big'), int.from_bytes(raw[20:24], 'big')
            sizes.append(dict(width=width, height=height))
            out = folder / f'{number}.webp'
            run('cwebp', '-quiet', '-q', '84', '-metadata', 'all', str(png), '-o', str(out))
            shutil.copyfile(out, destination / out.name)
        run('cwebp', '-quiet', '-q', '80', '-resize', '800', '0', str(pages[0]), '-o', str(folder / 'cover.webp'))
        shutil.copyfile(folder / 'cover.webp', destination / 'cover.webp')
    print(f"{source['id']}: {len(pages)} pages", flush=True)
    return dict(**source, pages=sizes)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only', help='Regenerate a single source ID')
    args = parser.parse_args()
    sources = json.loads((DATA / 'sources.json').read_text())
    if args.only and args.only not in {s['id'] for s in sources}:
        parser.error('Unknown source ID')
    for executable in ['curl', 'pdftoppm', 'pdfinfo', 'cwebp']:
        if not shutil.which(executable):
            parser.error(f'Missing required tool: {executable}')
    selected = [s for s in sources if not args.only or s['id'] == args.only]
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(render, selected))
    manifest = DATA / 'manifest.json'
    if args.only:
        existing = {s['id']: s for s in json.loads(manifest.read_text())} if manifest.exists() else {}
        existing.update({s['id']: s for s in results})
        results = [existing[s['id']] for s in sources if s['id'] in existing]
    temp = manifest.with_suffix('.tmp')
    temp.write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')
    temp.replace(manifest)
    assets = [f'/gallery/{deck["id"]}/{name}' for deck in results for name in ['cover.webp'] + [f'{i + 1}.webp' for i in range(len(deck['pages']))]]
    (OUTPUT / 'asset-index.json').write_text(json.dumps(assets) + '\n')
    print(json.dumps({'status': 'success', 'decks': len(results), 'pages': sum(len(s['pages']) for s in results)}))


if __name__ == '__main__':
    main()
