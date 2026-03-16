"""
User Settings Middleware

On each request, reads X-User-Token header, loads user settings
from database, and stores in g.user_settings for per-request access.

All config consumers use get_user_config() from utils.config_utils
to read g.user_settings with fallback to current_app.config defaults.
No global config mutation happens here.
"""
from flask import request, g
from models import Settings


def load_user_settings():
    """
    Before each request: load user settings into g.user_settings.
    """
    user_token = request.headers.get('X-User-Token')

    if user_token:
        try:
            g.user_settings = Settings.get_settings(user_token)
        except Exception:
            g.user_settings = None
    else:
        g.user_settings = None


def restore_default_settings(response):
    """No-op kept for backward compatibility with app.after_request registration."""
    return response
