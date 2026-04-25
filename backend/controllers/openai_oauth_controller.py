"""OpenAI Codex OAuth Controller — PKCE authorization flow for OpenAI accounts"""

import hashlib
import json
import logging
import os
import secrets
import base64
from datetime import datetime, timedelta, timezone

import requests
from flask import Blueprint, redirect, request, session

from models import db, Settings
from utils import success_response, error_response

logger = logging.getLogger(__name__)

openai_oauth_bp = Blueprint(
    "openai_oauth", __name__, url_prefix="/api/settings/openai-oauth"
)

_OPENAI_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
_OPENAI_AUTH_URL = "https://auth.openai.com/oauth/authorize"
_OPENAI_TOKEN_URL = "https://auth.openai.com/oauth/token"
_SCOPES = "openid profile email offline_access"


def _build_redirect_uri() -> str:
    backend_port = os.getenv("BACKEND_PORT", "5000")
    return f"http://localhost:{backend_port}/api/settings/openai-oauth/callback"


@openai_oauth_bp.route("/authorize", methods=["GET"])
def authorize():
    """Generate PKCE params and return the authorization URL."""
    code_verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(code_verifier.encode()).digest()
    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    state = secrets.token_urlsafe(32)

    session["openai_oauth_verifier"] = code_verifier
    session["openai_oauth_state"] = state

    params = {
        "client_id": _OPENAI_CLIENT_ID,
        "redirect_uri": _build_redirect_uri(),
        "response_type": "code",
        "scope": _SCOPES,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "state": state,
    }
    qs = "&".join(f"{k}={requests.utils.quote(str(v))}" for k, v in params.items())
    auth_url = f"{_OPENAI_AUTH_URL}?{qs}"
    return success_response({"auth_url": auth_url})


@openai_oauth_bp.route("/callback", methods=["GET"])
def callback():
    """Receive the authorization code, exchange for tokens, store in DB."""
    code = request.args.get("code")
    state = request.args.get("state")
    error = request.args.get("error")

    if error:
        logger.warning("OAuth callback error: %s", error)
        return _callback_html(success=False, message=error)

    expected_state = session.pop("openai_oauth_state", None)
    code_verifier = session.pop("openai_oauth_verifier", None)

    if not code or not state:
        return _callback_html(success=False, message="Missing code or state")
    if state != expected_state:
        return _callback_html(success=False, message="State mismatch — possible CSRF")
    if not code_verifier:
        return _callback_html(success=False, message="Missing PKCE verifier — please retry")

    try:
        resp = requests.post(_OPENAI_TOKEN_URL, json={
            "grant_type": "authorization_code",
            "client_id": _OPENAI_CLIENT_ID,
            "code": code,
            "redirect_uri": _build_redirect_uri(),
            "code_verifier": code_verifier,
        }, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        logger.error("Token exchange failed: %s", e)
        return _callback_html(success=False, message="Token exchange failed")

    access_token = data.get("access_token")
    refresh_token = data.get("refresh_token")
    expires_in = data.get("expires_in", 3600)

    account_id = _extract_account_id(data.get("id_token"))

    settings = Settings.get_settings()
    settings.openai_oauth_access_token = access_token
    settings.openai_oauth_refresh_token = refresh_token
    settings.openai_oauth_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    settings.openai_oauth_account_id = account_id
    db.session.commit()

    logger.info("OpenAI OAuth connected for account: %s", account_id)
    return _callback_html(success=True, message="Connected")


@openai_oauth_bp.route("/disconnect", methods=["POST"])
def disconnect():
    """Clear stored OAuth tokens."""
    settings = Settings.get_settings()
    settings.openai_oauth_access_token = None
    settings.openai_oauth_refresh_token = None
    settings.openai_oauth_expires_at = None
    settings.openai_oauth_account_id = None
    db.session.commit()
    logger.info("OpenAI OAuth disconnected")
    return success_response({"message": "Disconnected"})


@openai_oauth_bp.route("/status", methods=["GET"])
def status():
    """Return current OAuth connection status."""
    settings = Settings.get_settings()
    connected = bool(settings.openai_oauth_access_token)
    return success_response({
        "connected": connected,
        "account_id": settings.openai_oauth_account_id if connected else None,
    })


def _extract_account_id(id_token: str | None) -> str | None:
    """Decode the JWT id_token (without verification) to get the subject."""
    if not id_token:
        return None
    try:
        parts = id_token.split(".")
        if len(parts) < 2:
            return None
        payload = parts[1]
        padding = 4 - len(payload) % 4
        if padding != 4:
            payload += "=" * padding
        import json
        claims = json.loads(base64.urlsafe_b64decode(payload))
        return claims.get("email") or claims.get("sub")
    except Exception:
        return None


def _callback_html(success: bool, message: str) -> str:
    """Return an HTML page that notifies the opener window and closes itself."""
    import html as html_mod
    safe_message = html_mod.escape(message)
    status_text = "Connected" if success else f"Error: {safe_message}"
    color = "#22c55e" if success else "#ef4444"
    json_message = json.dumps(message)
    return f"""<!DOCTYPE html>
<html><head><title>OpenAI OAuth</title></head>
<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="text-align:center">
<p style="font-size:1.5rem;color:{color}">{status_text}</p>
<p>This window will close automatically.</p>
</div>
<script>
if (window.opener) {{
    window.opener.postMessage({{type:'openai-oauth-callback',success:{str(success).lower()},message:{json_message}}}, '*');
}}
setTimeout(function(){{ window.close(); }}, 2000);
</script>
</body></html>""", 200, {"Content-Type": "text/html"}
