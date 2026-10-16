#!/usr/bin/env python3
"""Honor nightly's official PyPI setting without resolving new dependencies."""

import os
from pathlib import Path


def prepare_lock(text: str, index_url: str) -> str:
    # --frozen keeps artifact URLs from uv.lock even when UV_INDEX_URL changes.
    # TUNA mirrors the same PyPI package paths; retain every version and hash.
    # Leave custom index configurations untouched.
    if index_url.rstrip('/') != 'https://pypi.org/simple':
        return text
    return text.replace(
        'https://pypi.tuna.tsinghua.edu.cn/simple', 'https://pypi.org/simple'
    ).replace(
        'https://pypi.tuna.tsinghua.edu.cn/packages/',
        'https://files.pythonhosted.org/packages/',
    )


if __name__ == '__main__':
    lock_path = Path(__file__).resolve().parents[1] / 'uv.lock'
    original = lock_path.read_text()
    prepared = prepare_lock(original, os.environ.get('PYPI_INDEX_URL', ''))
    if prepared != original:
        lock_path.write_text(prepared)
        print('Prepared locked PyPI URLs; dependency versions and hashes unchanged.')
    else:
        print('Lockfile URLs unchanged.')
