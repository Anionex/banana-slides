"""Tests for CLI plain-text --help output in non-TTY mode."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

# Resolve the cli directory relative to this test file
_CLI_DIR = str(Path(__file__).resolve().parents[3] / "cli")


def test_help_plain_text_in_pipe():
    """When stdout is piped (non-TTY), help output should be plain text without Rich boxes."""
    result = subprocess.run(
        [sys.executable, "-m", "banana_cli", "--help"],
        capture_output=True,
        text=True,
        cwd=_CLI_DIR,
    )

    output = result.stdout
    # Should not contain Rich box-drawing characters
    assert "╭" not in output, "Help output contains Rich box-drawing characters in pipe mode"
    assert "╰" not in output, "Help output contains Rich box-drawing characters in pipe mode"
    # Should contain standard help text
    assert "banana-cli" in output.lower() or "Usage" in output


def test_help_contains_new_commands():
    """Help output should list the new 'use' and 'unuse' project commands."""
    result = subprocess.run(
        [sys.executable, "-m", "banana_cli", "projects", "--help"],
        capture_output=True,
        text=True,
        cwd=_CLI_DIR,
    )

    output = result.stdout
    assert "use" in output, "projects subcommand should list 'use'"
    assert "unuse" in output, "projects subcommand should list 'unuse'"
