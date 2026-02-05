"""
In-memory sliding window rate limiter with decorator support.
"""
import os
import time
import threading
import logging
from functools import wraps
from collections import defaultdict
from flask import request

from utils.response import rate_limit_error

logger = logging.getLogger(__name__)

# Global lock for thread-safe access
_lock = threading.Lock()

# Storage: { limiter_key: { client_key: [timestamp, ...] } }
_request_log: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))

# Track last cleanup time per limiter to avoid cleaning on every request
_last_cleanup: dict[str, float] = {}

_CLEANUP_INTERVAL = 60  # seconds between cleanups


def _is_testing() -> bool:
    """Check if we are in testing mode."""
    return os.environ.get('TESTING', '').lower() in ('true', '1', 'yes')


def clear_rate_limit_storage():
    """Clear all rate limit storage. Useful for testing."""
    with _lock:
        _request_log.clear()
        _last_cleanup.clear()


def _cleanup_expired(limiter_key: str, window_seconds: int):
    """Remove expired entries to prevent memory leaks."""
    now = time.time()
    last = _last_cleanup.get(limiter_key, 0)
    if now - last < _CLEANUP_INTERVAL:
        return

    _last_cleanup[limiter_key] = now
    cutoff = now - window_seconds
    bucket = _request_log[limiter_key]
    expired_keys = []
    for key, timestamps in bucket.items():
        bucket[key] = [t for t in timestamps if t > cutoff]
        if not bucket[key]:
            expired_keys.append(key)
    for key in expired_keys:
        del bucket[key]


def _is_rate_limited(limiter_key: str, client_key: str, max_requests: int, window_seconds: int) -> bool:
    """
    Check if a client has exceeded the rate limit and record the request.

    Returns True if the client should be blocked.
    """
    now = time.time()
    cutoff = now - window_seconds

    with _lock:
        _cleanup_expired(limiter_key, window_seconds)

        timestamps = _request_log[limiter_key][client_key]
        # Remove timestamps outside the window
        timestamps[:] = [t for t in timestamps if t > cutoff]

        if len(timestamps) >= max_requests:
            return True

        timestamps.append(now)
        return False


def _get_client_ip() -> str:
    """Get the client IP address, respecting proxy headers."""
    # Trust X-Forwarded-For if present (first IP in the chain)
    forwarded_for = request.headers.get('X-Forwarded-For')
    if forwarded_for:
        return forwarded_for.split(',')[0].strip()
    return request.remote_addr or '127.0.0.1'


def rate_limit(max_requests: int, window_seconds: int, key_func=None):
    """
    Rate limit decorator for Flask routes.

    Args:
        max_requests: Maximum number of requests allowed in the window.
        window_seconds: Time window in seconds.
        key_func: Optional callable(request) -> str to derive the rate limit key.
                  Defaults to client IP address.

    Usage:
        @app.route('/api/auth/register', methods=['POST'])
        @rate_limit(max_requests=5, window_seconds=3600)
        def register():
            ...
    """
    def decorator(f):
        # Use the fully qualified endpoint name as the limiter key
        limiter_key = f'{f.__module__}.{f.__qualname__}'

        @wraps(f)
        def wrapper(*args, **kwargs):
            # Skip rate limiting in test mode
            if _is_testing():
                return f(*args, **kwargs)

            if key_func:
                client_key = key_func(request)
            else:
                client_key = _get_client_ip()

            if _is_rate_limited(limiter_key, client_key, max_requests, window_seconds):
                logger.warning(f"Rate limit exceeded for {limiter_key} by {client_key}")
                return rate_limit_error("请求过于频繁，请稍后再试")

            return f(*args, **kwargs)
        return wrapper
    return decorator
