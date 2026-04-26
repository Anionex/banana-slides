"""Custom exceptions for banana-cli."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class CLIError(Exception):
    """Base CLI error with machine-readable code."""

    code: str
    message: str
    details: Any | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "message": self.message,
            "details": self.details,
        }


class ConfigError(CLIError):
    def __init__(self, message: str, details: Any | None = None):
        super().__init__("CONFIG_ERROR", message, details)


class InputError(CLIError):
    def __init__(self, message: str, details: Any | None = None):
        super().__init__("INPUT_ERROR", message, details)


class HTTPError(CLIError):
    def __init__(self, message: str, details: Any | None = None):
        super().__init__("HTTP_ERROR", message, details)


class TaskError(CLIError):
    def __init__(self, message: str, details: Any | None = None):
        super().__init__("TASK_FAILED", message, details)


class TimeoutError(CLIError):
    def __init__(self, message: str, details: Any | None = None):
        super().__init__("TASK_TIMEOUT", message, details)


class IOErrorCLI(CLIError):
    def __init__(self, message: str, details: Any | None = None):
        super().__init__("IO_ERROR", message, details)
