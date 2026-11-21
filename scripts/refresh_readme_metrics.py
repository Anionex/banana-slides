#!/usr/bin/env python3
"""Refresh local README statistics; failed requests leave the last good SVGs intact.

Run: python3 scripts/refresh_readme_metrics.py
Uses the public GitHub API, or GITHUB_TOKEN when supplied by GitHub Actions.
Only visible number changes rewrite files; the hero renderer remains offline.
"""
import json
import os
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import render_readme_hero as hero

REPOSITORY = hero.REPO.removeprefix('https://github.com/')


def fetch_repository():
    headers = {'Accept': 'application/vnd.github+json',
               'X-GitHub-Api-Version': '2022-11-28',
               'User-Agent': 'banana-slides-readme-metrics'}
    if token := os.environ.get('GITHUB_TOKEN'):
        headers['Authorization'] = 'Bearer ' + token
    request = Request('https://api.github.com/repos/' + REPOSITORY, headers=headers)
    for attempt in range(3):
        try:
            with urlopen(request, timeout=20) as response:
                return json.load(response)
        except HTTPError as error:
            if error.code != 429 and error.code < 500:
                raise
            if attempt == 2:
                raise
        except (URLError, TimeoutError):
            if attempt == 2:
                raise
        time.sleep(2 ** (attempt + 1))


def compact(value):
    for scale, suffix in ((1_000_000_000, 'B'), (1_000_000, 'M'), (1_000, 'k')):
        if value >= scale:
            return f'{value / scale:.1f}'.removesuffix('.0') + suffix
    return str(value)


def metric_assets(data, root):
    if not isinstance(data, dict) or data.get('full_name', '').lower() != REPOSITORY.lower():
        raise ValueError('Expected the configured GitHub repository')
    # Validate the entire response before rendering or writing any metric.
    for _, _, _, field, _ in hero.METRICS:
        if type(data.get(field)) is not int or data[field] < 0:
            raise ValueError('Invalid GitHub count: ' + field)
    outputs = {}
    for name, label, _, field, width in hero.METRICS:
        value = label + '\u00a0\u00a0' + compact(data[field])
        for theme, color in [('light', '#24262B'), ('dark', '#EEEDE7')]:
            path = root / f'assets/readme/metric-{name}-{theme}.svg'
            outputs[path] = hero.svg(width, 26, hero.text(value, width / 2, 18, 14, color), value)
    return outputs


def refresh(root=hero.ROOT):
    outputs = metric_assets(fetch_repository(), root)
    changed = {path: value for path, value in outputs.items()
               if not path.exists() or path.read_text() != value}
    hero.i18n.commit_files(changed)
    return {'status': 'ok', 'changed_files': [str(path.relative_to(root)) for path in changed]}


def main():
    try:
        result = refresh()
    except Exception as error:
        # Never put upstream response bodies or credentials in images or logs.
        print(json.dumps({'status': 'failed', 'error': type(error).__name__,
                          'message': 'Refresh failed; previous metric SVGs preserved.'}), file=sys.stderr)
        return 1
    print(json.dumps(result))
    return 0


if __name__ == '__main__':
    sys.exit(main())
