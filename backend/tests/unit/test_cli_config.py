"""Tests for banana-cli config resolution."""

from __future__ import annotations

from pathlib import Path

from cli.banana_cli.config import resolve_config


def test_resolve_config_precedence(tmp_path: Path, monkeypatch):
    cfg_file = tmp_path / "cli.toml"
    cfg_file.write_text(
        (
            'base_url = "http://file:5000"\n'
            'access_code = "from-file"\n'
            "poll_interval = 7\n"
            "request_timeout = 33\n"
            "continue_on_error = false\n"
        ),
        encoding="utf-8",
    )

    monkeypatch.setenv("BANANA_CLI_BASE_URL", "http://env:5000")
    monkeypatch.setenv("BANANA_CLI_ACCESS_CODE", "from-env")
    monkeypatch.setenv("BANANA_CLI_POLL_INTERVAL", "9")
    monkeypatch.setenv("BANANA_CLI_REQUEST_TIMEOUT", "66")
    monkeypatch.setenv("BANANA_CLI_CONTINUE_ON_ERROR", "true")

    cfg = resolve_config(
        base_url="http://arg:5000",
        access_code="from-arg",
        poll_interval=11,
        request_timeout=77,
        continue_on_error=False,
        config_path=str(cfg_file),
        json_output=False,
        verbose=False,
    )

    assert cfg.base_url == "http://arg:5000"
    assert cfg.access_code == "from-arg"
    assert cfg.poll_interval == 11
    assert cfg.request_timeout == 77
    assert cfg.continue_on_error is False
