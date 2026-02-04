"""
Security utilities for password hashing and encryption
"""
import secrets
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple


def hash_password(password: str) -> str:
    """
    Hash a password using PBKDF2 with SHA-256.
    
    Returns a string in format: salt$hash
    """
    salt = secrets.token_hex(32)
    hash_bytes = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        iterations=100000
    )
    password_hash = hash_bytes.hex()
    return f"{salt}${password_hash}"


def verify_password(password: str, stored_hash: str) -> bool:
    """
    Verify a password against a stored hash.
    
    Args:
        password: Plain text password to verify
        stored_hash: Stored hash in format salt$hash
        
    Returns:
        True if password matches, False otherwise
    """
    try:
        salt, expected_hash = stored_hash.split('$')
        hash_bytes = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            iterations=100000
        )
        actual_hash = hash_bytes.hex()
        # Use constant-time comparison to prevent timing attacks
        return secrets.compare_digest(actual_hash, expected_hash)
    except (ValueError, AttributeError):
        return False


def generate_token(length: int = 32) -> str:
    """
    Generate a secure random token.
    
    Args:
        length: Length of the token in bytes (default 32)
        
    Returns:
        Hex-encoded token string
    """
    return secrets.token_hex(length)


def generate_verification_code(length: int = 6, expires_minutes: int = 10) -> Tuple[str, datetime]:
    """
    Generate a numeric verification code with expiration time.
    Reusable for email/phone verification.

    Args:
        length: Number of digits (default 6)
        expires_minutes: Expiration time in minutes (default 10)

    Returns:
        Tuple of (code, expires_at)
    """
    code = ''.join([str(secrets.randbelow(10)) for _ in range(length)])
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    return code, expires_at


def generate_verification_token() -> Tuple[str, datetime]:
    """
    Generate an email verification token with expiration time.

    Returns:
        Tuple of (token, expires_at)
    """
    token = generate_token(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    return token, expires_at


def generate_password_reset_token() -> Tuple[str, datetime]:
    """
    Generate a password reset token with expiration time.
    
    Returns:
        Tuple of (token, expires_at)
    """
    token = generate_token(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    return token, expires_at


def is_token_expired(expires_at: Optional[datetime]) -> bool:
    """
    Check if a token has expired.
    
    Args:
        expires_at: Token expiration datetime
        
    Returns:
        True if expired or no expiration set, False otherwise
    """
    if expires_at is None:
        return True
    
    # Handle timezone-naive datetime
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    return datetime.now(timezone.utc) > expires_at
