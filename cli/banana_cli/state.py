"""Global CLI state shared between callback and commands."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from .config import CLIConfig
from .http_client import APIClient


@dataclass
class AppState:
    config: CLIConfig = field(default_factory=CLIConfig)
    api: Optional[APIClient] = None
    json_output: bool = False
    verbose: bool = False


state = AppState()
