#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["google-genai>=1.52.0,<2", "httpx[socks]>=0.28,<1"]
# ///
"""Compatibility entrypoint; README translation now uses persistent incremental state."""
from translate_readme_incremental import main

if __name__ == "__main__":
    raise SystemExit(main())
