"""OpenAI Codex OAuth Controller — PKCE authorization flow for OpenAI accounts.

The OAuth callback must arrive at localhost:1455/auth/callback (the only redirect_uri
registered with OpenAI's auth server). We spin up a temporary HTTP server on that port
to receive the callback, exchange the code for tokens, and store them in the database.
"""

import hashlib
import json
import logging
import os
import secrets
import base64
import threading
from datetime import datetime, timedelta, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlencode, urlparse, parse_qs

import requests as http_requests
from flask import Blueprint, request

from models import db, Settings
from utils import success_response, error_response

logger = logging.getLogger(__name__)

openai_oauth_bp = Blueprint(
    "openai_oauth", __name__, url_prefix="/api/settings/openai-oauth"
)

_OPENAI_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
_OPENAI_AUTH_URL = "https://auth.openai.com/oauth/authorize"
_OPENAI_TOKEN_URL = "https://auth.openai.com/oauth/token"
_SCOPES = "openid profile email offline_access api.connectors.read api.connectors.invoke"
_CALLBACK_PORT = 1455

# In-memory store for pending OAuth flows (state -> {code_verifier, app_context})
_pending_flows: dict[str, dict] = {}


def _build_redirect_uri() -> str:
    return f"http://localhost:{_CALLBACK_PORT}/auth/callback"


@openai_oauth_bp.route("/authorize", methods=["GET"])
def authorize():
    """Generate PKCE params, start callback server, return authorization URL."""
    code_verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(code_verifier.encode()).digest()
    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    state = secrets.token_urlsafe(32)

    from flask import current_app
    _pending_flows[state] = {
        "code_verifier": code_verifier,
        "app": current_app._get_current_object(),
    }

    _ensure_callback_server()

    params = {
        "response_type": "code",
        "client_id": _OPENAI_CLIENT_ID,
        "redirect_uri": _build_redirect_uri(),
        "scope": _SCOPES,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "id_token_add_organizations": "true",
        "codex_cli_simplified_flow": "true",
        "state": state,
        "originator": "codex_cli_rs",
    }
    qs = urlencode(params)
    auth_url = f"{_OPENAI_AUTH_URL}?{qs}"
    return success_response({"auth_url": auth_url})


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


# ---------------------------------------------------------------------------
# Standalone callback server on port 1455
# ---------------------------------------------------------------------------

_callback_server: HTTPServer | None = None
_callback_lock = threading.Lock()


class _OAuthCallbackHandler(BaseHTTPRequestHandler):
    """Handles GET /auth/callback from OpenAI's auth redirect."""

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path != "/auth/callback":
            self.send_error(404)
            return

        params = parse_qs(parsed.query)
        code = params.get("code", [None])[0]
        state = params.get("state", [None])[0]
        error = params.get("error", [None])[0]

        if error:
            logger.warning("OAuth callback error: %s", error)
            self._send_html(_build_callback_html(False, error))
            return

        if not code or not state:
            self._send_html(_build_callback_html(False, "Missing code or state"))
            return

        flow = _pending_flows.pop(state, None)
        if not flow:
            self._send_html(_build_callback_html(False, "Unknown state — please retry"))
            return

        code_verifier = flow["code_verifier"]
        app = flow["app"]

        try:
            resp = http_requests.post(
                _OPENAI_TOKEN_URL,
                data=urlencode({
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": _build_redirect_uri(),
                    "client_id": _OPENAI_CLIENT_ID,
                    "code_verifier": code_verifier,
                }),
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            logger.error("Token exchange failed: %s", e)
            self._send_html(_build_callback_html(False, "Token exchange failed"))
            return

        access_token = data.get("access_token")
        refresh_token = data.get("refresh_token")
        expires_in = data.get("expires_in", 3600)
        account_id = _extract_account_id(data.get("id_token"))

        with app.app_context():
            settings = Settings.get_settings()
            settings.openai_oauth_access_token = access_token
            settings.openai_oauth_refresh_token = refresh_token
            settings.openai_oauth_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
            settings.openai_oauth_account_id = account_id
            db.session.commit()

        logger.info("OpenAI OAuth connected for account: %s", account_id)
        self._send_html(_build_callback_html(True, "Connected"))

    def _send_html(self, html: str):
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(html.encode())

    def log_message(self, format, *args):
        logger.debug("OAuth callback server: %s", format % args)


def _ensure_callback_server():
    """Start the callback server on port 1455 if not already running."""
    global _callback_server
    with _callback_lock:
        if _callback_server is not None:
            return
        try:
            server = HTTPServer(("127.0.0.1", _CALLBACK_PORT), _OAuthCallbackHandler)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            _callback_server = server
            logger.info("OAuth callback server started on port %d", _CALLBACK_PORT)
        except OSError as e:
            logger.error("Failed to start OAuth callback server on port %d: %s", _CALLBACK_PORT, e)
            raise


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
        claims = json.loads(base64.urlsafe_b64decode(payload))
        return claims.get("email") or claims.get("sub")
    except Exception:
        return None


def _build_callback_html(success: bool, message: str) -> str:
    """Return HTML that notifies the opener window and closes itself."""
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
</body></html>"""
