#!/usr/bin/env python3
"""Refresh the website's shared GitHub snapshot; failures preserve the last success."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import os
import sys
import tempfile
from urllib.request import Request, urlopen

REPOSITORY = 'Anionex/banana-slides'


def fetch_snapshot():
    request = Request('https://api.github.com/repos/' + REPOSITORY, headers={
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'banana-slides-website-stats',
    })
    with urlopen(request, timeout=20) as response:
        data = json.load(response)
    if not isinstance(data, dict) or data.get('full_name', '').lower() != REPOSITORY.lower():
        raise ValueError('Unexpected repository')
    for field in ('stargazers_count', 'forks_count'):
        if type(data.get(field)) is not int or data[field] < 0:
            raise ValueError('Invalid GitHub count')
    return {'repository': REPOSITORY, 'stars': data['stargazers_count'],
            'forks': data['forks_count'], 'updated_at': datetime.now(timezone.utc).isoformat()}


def refresh(output):
    snapshot = fetch_snapshot()
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', dir=output.parent, prefix='.github-', delete=False) as stream:
            temporary = Path(stream.name)
            json.dump(snapshot, stream, indent=2)
            stream.write('\n')
        temporary.chmod(0o644)
        os.replace(temporary, output)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return snapshot


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    try:
        result = refresh(args.output)
    except Exception as error:
        print(json.dumps({'status': 'failed', 'error': type(error).__name__,
                          'message': 'Previous shared snapshot preserved.'}), file=sys.stderr)
        return 1
    print(json.dumps({'status': 'ok', **result}))
    return 0


if __name__ == '__main__':
    sys.exit(main())
