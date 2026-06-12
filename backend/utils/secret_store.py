"""Small helpers for encrypting secrets stored in the local settings DB."""
import base64
import hashlib
import logging
import os
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)

_PREFIX = "enc:v1:"


def _secret_material() -> Optional[bytes]:
    explicit = os.getenv("BANANA_SECRET_ENCRYPTION_KEY") or os.getenv("TOKEN_ENCRYPTION_KEY")
    if explicit:
        return explicit.encode("utf-8")

    try:
        from flask import current_app, has_app_context

        if has_app_context():
            secret_key = current_app.config.get("SECRET_KEY")
            if secret_key:
                return str(secret_key).encode("utf-8")
    except Exception:
        pass

    try:
        from config import Config

        secret_key = getattr(Config, "SECRET_KEY", None)
        if secret_key:
            return str(secret_key).encode("utf-8")
    except Exception:
        pass

    return None


def _fernet() -> Optional[Fernet]:
    material = _secret_material()
    if not material:
        return None
    key = base64.urlsafe_b64encode(hashlib.sha256(material).digest())
    return Fernet(key)


def is_encrypted_secret(value: Optional[str]) -> bool:
    return isinstance(value, str) and value.startswith(_PREFIX)


def encrypt_secret(value: Optional[str]) -> Optional[str]:
    if value is None or value == "":
        return value
    if is_encrypted_secret(value):
        return value

    fernet = _fernet()
    if fernet is None:
        logger.warning("Secret encryption key is unavailable; storing value without encryption")
        return value

    token = fernet.encrypt(str(value).encode("utf-8")).decode("utf-8")
    return f"{_PREFIX}{token}"


def decrypt_secret(value: Optional[str]) -> Optional[str]:
    if value is None or value == "":
        return value
    if not is_encrypted_secret(value):
        return value

    fernet = _fernet()
    if fernet is None:
        logger.warning("Secret encryption key is unavailable; encrypted value cannot be read")
        return None

    token = value[len(_PREFIX):]
    try:
        return fernet.decrypt(token.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError):
        logger.warning("Stored secret could not be decrypted")
        return None
