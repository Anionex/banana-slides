"""Configuration loading and precedence resolution."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .errors import ConfigError


@dataclass
class CLIConfig:
    base_url: str = "http://localhost:5000"
    access_code: str = ""
    poll_interval: int = 3
    request_timeout: int = 60
    continue_on_error: bool = True
    json_output: bool = False
    verbose: bool = False


ENV_MAP = {
    "base_url": "BANANA_CLI_BASE_URL",
    "access_code": "BANANA_CLI_ACCESS_CODE",
    "poll_interval": "BANANA_CLI_POLL_INTERVAL",
    "request_timeout": "BANANA_CLI_REQUEST_TIMEOUT",
    "continue_on_error": "BANANA_CLI_CONTINUE_ON_ERROR",
}


def default_config_path() -> Path:
    """Return platform-default config path."""
    appdata = os.getenv("APPDATA")
    if appdata:
        return Path(appdata) / "banana-slides" / "cli.toml"

    xdg_home = os.getenv("XDG_CONFIG_HOME")
    if xdg_home:
        return Path(xdg_home) / "banana-slides" / "cli.toml"

    return Path.home() / ".config" / "banana-slides" / "cli.toml"


def _parse_bool(value: str | bool | None) -> bool | None:
    if value is None or isinstance(value, bool):
        return value
    v = value.strip().lower()
    if v in {"1", "true", "yes", "y", "on"}:
        return True
    if v in {"0", "false", "no", "n", "off"}:
        return False
    raise ConfigError(f"Invalid boolean value: {value}")


def _read_toml(path: Path) -> dict[str, Any]:
    try:
        import tomllib  # py3.11+
    except ModuleNotFoundError:
        try:
            import tomli as tomllib  # type: ignore[no-redef]
        except ModuleNotFoundError as exc:  # pragma: no cover
            raise ConfigError("Reading TOML config requires tomllib (py3.11+) or tomli") from exc

    try:
        return tomllib.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    except Exception as exc:  # noqa: BLE001
        raise ConfigError(f"Failed to parse config file: {path}", details=str(exc)) from exc


def _load_file_config(path: Path) -> dict[str, Any]:
    raw = _read_toml(path)
    if not isinstance(raw, dict):
        raise ConfigError("Config file root must be an object")
    return raw


def _validate(cfg: CLIConfig) -> CLIConfig:
    if not cfg.base_url.startswith(("http://", "https://")):
        raise ConfigError("base_url must start with http:// or https://")
    if cfg.poll_interval <= 0:
        raise ConfigError("poll_interval must be > 0")
    if cfg.request_timeout <= 0:
        raise ConfigError("request_timeout must be > 0")
    return cfg


def resolve_config(
    *,
    base_url: str | None = None,
    access_code: str | None = None,
    poll_interval: int | None = None,
    request_timeout: int | None = None,
    continue_on_error: bool | None = None,
    config_path: str | None = None,
    json_output: bool = False,
    verbose: bool = False,
) -> CLIConfig:
    """Resolve config with priority: explicit params > env > file > defaults."""
    cfg = CLIConfig()

    config_file = Path(config_path) if config_path else default_config_path()
    file_cfg = _load_file_config(config_file)

    if "base_url" in file_cfg:
        cfg.base_url = str(file_cfg["base_url"]).rstrip("/")
    if "access_code" in file_cfg:
        cfg.access_code = str(file_cfg["access_code"] or "")
    if "poll_interval" in file_cfg:
        cfg.poll_interval = int(file_cfg["poll_interval"])
    if "request_timeout" in file_cfg:
        cfg.request_timeout = int(file_cfg["request_timeout"])
    if "continue_on_error" in file_cfg:
        parsed = _parse_bool(file_cfg["continue_on_error"])
        cfg.continue_on_error = True if parsed is None else parsed

    for key, env_name in ENV_MAP.items():
        val = os.getenv(env_name)
        if val is None:
            continue
        if key in {"poll_interval", "request_timeout"}:
            setattr(cfg, key, int(val))
        elif key == "continue_on_error":
            parsed = _parse_bool(val)
            setattr(cfg, key, True if parsed is None else parsed)
        elif key == "base_url":
            setattr(cfg, key, val.rstrip("/"))
        else:
            setattr(cfg, key, val)

    if base_url:
        cfg.base_url = base_url.rstrip("/")
    if access_code is not None:
        cfg.access_code = access_code
    if poll_interval is not None:
        cfg.poll_interval = int(poll_interval)
    if request_timeout is not None:
        cfg.request_timeout = int(request_timeout)
    if continue_on_error is not None:
        cfg.continue_on_error = bool(continue_on_error)

    cfg.json_output = json_output
    cfg.verbose = verbose

    return _validate(cfg)
