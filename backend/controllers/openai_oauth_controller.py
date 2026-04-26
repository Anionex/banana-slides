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


@openai_oauth_bp.route("/models", methods=["GET"])
def list_models():
    """Return available models for Codex OAuth users, split by type."""
    settings = Settings.get_settings()
    token = settings.get_openai_oauth_token()
    if not token:
        return error_response("OpenAI OAuth is not connected", 401)

    text_models = [
        "gpt-5.5",
        "gpt-5.5-pro",
        "gpt-5.4",
        "gpt-5.4-pro",
        "gpt-5.4-mini",
        "gpt-5.3-codex",
        "gpt-5.2",
        "gpt-4.1",
        "gpt-4.1-mini",
        "gpt-4.1-nano",
        "gpt-4o",
        "gpt-4o-mini",
        "o3",
        "o3-pro",
        "o4-mini",
        "o1",
        "o1-pro",
        "codex-mini-latest",
    ]
    image_models = [
        "gpt-image-2",
        "gpt-image-1.5",
        "gpt-image-1",
        "gpt-image-1-mini",
    ]
    return success_response({
        "text_models": text_models,
        "image_models": image_models,
        # Keep flat list for backward compatibility
        "models": text_models + image_models,
    })


@openai_oauth_bp.route("/manual-callback", methods=["POST"])
def manual_callback():
    """Accept a pasted callback URL and complete the token exchange.

    Used when port 1455 is blocked (e.g. Windows Hyper-V reserved ports)
    and the automatic callback server cannot receive the redirect.
    """
    data = request.get_json(silent=True) or {}
    callback_url = data.get("callback_url", "")
    if not callback_url:
        return error_response("callback_url is required", 400)

    parsed = urlparse(callback_url)
    params = parse_qs(parsed.query)
    code = params.get("code", [None])[0]
    state = params.get("state", [None])[0]
    error_param = params.get("error", [None])[0]

    if error_param:
        return error_response(f"OAuth error: {error_param}", 400)
    if not code or not state:
        return error_response("URL missing code or state parameter", 400)

    from flask import current_app
    result = _exchange_and_store(code, state, current_app._get_current_object())
    if not result["success"]:
        return error_response(result["message"], 400)

    return success_response({
        "message": "Connected",
        "account_id": result.get("account_id"),
    })


# ---------------------------------------------------------------------------
# Standalone callback server on port 1455
# ---------------------------------------------------------------------------

_callback_server: HTTPServer | None = None
_callback_lock = threading.Lock()


def _exchange_and_store(code: str, state: str, app=None) -> dict:
    """Exchange an authorization code for tokens and persist them.

    Returns {"success": True, "account_id": ...} or {"success": False, "message": ...}.
    """
    flow = _pending_flows.get(state)
    if not flow:
        return {"success": False, "message": "Unknown state — please retry"}

    code_verifier = flow["code_verifier"]
    if app is None:
        app = flow.get("app")

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
        return {"success": False, "message": "Token exchange failed"}

    access_token = data.get("access_token")
    refresh_token = data.get("refresh_token")
    expires_in = data.get("expires_in", 3600)
    account_id = _extract_account_id(data.get("id_token"))

    try:
        with app.app_context():
            settings = Settings.get_settings()
            settings.openai_oauth_access_token = access_token
            settings.openai_oauth_refresh_token = refresh_token
            settings.openai_oauth_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
            settings.openai_oauth_account_id = account_id
            db.session.commit()
    except Exception as e:
        logger.error("Failed to store OAuth tokens: %s", e)
        return {"success": False, "message": "Failed to store tokens"}

    _pending_flows.pop(state, None)
    logger.info("OpenAI OAuth connected for account: %s", account_id)
    return {"success": True, "account_id": account_id}


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

        result = _exchange_and_store(code, state)
        if result["success"]:
            self._send_html(_build_callback_html(True, "Connected"))
        else:
            self._send_html(_build_callback_html(False, result["message"]))

    def _send_html(self, html: str):
        encoded = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, format, *args):
        logger.debug("OAuth callback server: %s", format % args)


def _ensure_callback_server():
    """Start the callback server on port 1455 if not already running."""
    global _callback_server
    with _callback_lock:
        if _callback_server is not None:
            return
        try:
            server = HTTPServer(("0.0.0.0", _CALLBACK_PORT), _OAuthCallbackHandler)
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
    close_script = "setTimeout(function(){ window.close(); }, 2000);" if success else ""
    hint = "" if success else "<p style='margin-top:1rem;font-size:0.85rem;color:#666'>Please copy the full URL from the address bar and paste it into the manual input on the Settings page.</p>"
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>OpenAI OAuth</title></head>
<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="text-align:center">
<p style="font-size:1.5rem;color:{color}">{status_text}</p>
{"<p>This window will close automatically.</p>" if success else ""}{hint}
</div>
<script>
if (window.opener) {{
    window.opener.postMessage({{type:'openai-oauth-callback',success:{str(success).lower()},message:{json_message}}}, '*');
}}
{close_script}
</script>
</body></html>"""
