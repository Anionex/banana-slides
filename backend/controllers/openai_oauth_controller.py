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
from contextlib import nullcontext
from datetime import datetime, timedelta, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlencode, urlparse, parse_qs

import requests as http_requests
from flask import Blueprint, current_app, request

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
_MAX_EXPIRES_IN_SECONDS = 30 * 24 * 60 * 60

# In-memory store for pending OAuth flows (state -> {code_verifier, app_context})
_pending_flows: dict[str, dict] = {}


def _build_redirect_uri() -> str:
    return f"http://localhost:{_CALLBACK_PORT}/auth/callback"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _token_exchange_error_message(error: Exception) -> str:
    detail = None
    response = getattr(error, "response", None)
    if response is not None:
        try:
            payload = response.json()
            if isinstance(payload, dict):
                error_payload = payload.get("error")
                if isinstance(error_payload, dict):
                    detail = error_payload.get("message") or error_payload.get("error_description")
                elif isinstance(error_payload, str):
                    detail = payload.get("error_description") or error_payload
                detail = detail or payload.get("message")
            elif payload:
                detail = str(payload)
        except Exception:
            pass

        if not detail:
            text = getattr(response, "text", "")
            detail = text.strip() if isinstance(text, str) and text.strip() else None

    message = "Token exchange failed，请检查部署机器或容器是否可以访问 OpenAI"
    return f"{message}: {detail}" if detail else message


def _parse_expires_in(value) -> int:
    try:
        expires_in = int(float(value.strip() if isinstance(value, str) else value))
    except (OverflowError, TypeError, ValueError):
        return 3600
    if expires_in <= 0:
        return 3600
    return min(expires_in, _MAX_EXPIRES_IN_SECONDS)


@openai_oauth_bp.route("/authorize", methods=["GET"])
def authorize():
    """Generate PKCE params, start callback server, return authorization URL."""
    code_verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(code_verifier.encode()).digest()
    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    state = secrets.token_urlsafe(32)

    _pending_flows[state] = {
        "code_verifier": code_verifier,
        "app": current_app._get_current_object(),
    }

    callback_server_available = _ensure_callback_server()

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
    return success_response({
        "auth_url": auth_url,
        "callback_server_available": callback_server_available,
    })


@openai_oauth_bp.route("/disconnect", methods=["POST"])
def disconnect():
    """Clear stored OAuth tokens."""
    settings = Settings.get_settings()
    settings.clear_openai_oauth()
    db.session.commit()
    logger.info("OpenAI OAuth disconnected")
    return success_response({"message": "Disconnected"})


@openai_oauth_bp.route("/status", methods=["GET"])
def status():
    """Return current OAuth connection status."""
    settings = Settings.get_settings()
    connected = settings.is_openai_oauth_connected()
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
        return error_response("OPENAI_OAUTH_NOT_CONNECTED", "OpenAI 账号未连接", 401)

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

    Used when port 1455 is blocked and the automatic callback server
    cannot receive the redirect.
    """
    data = request.get_json(silent=True) or {}
    callback_url = data.get("callback_url", "")
    if not callback_url:
        return error_response("INVALID_REQUEST", "callback_url is required", 400)

    parsed = urlparse(callback_url)
    params = parse_qs(parsed.query)
    code = params.get("code", [None])[0]
    state = params.get("state", [None])[0]
    error_param = params.get("error", [None])[0]

    if error_param:
        return error_response("OPENAI_OAUTH_ERROR", f"OpenAI 登录失败: {error_param}", 400)
    if not code or not state:
        return error_response("INVALID_REQUEST", "回调地址缺少 code 或 state 参数", 400)

    result = _exchange_and_store(
        code,
        state,
        current_app._get_current_object(),
        missing_message="登录会话已过期或已使用，请重新点击登录后粘贴新的 URL",
    )
    if not result["success"]:
        return error_response(result["error_code"], result["message"], result["status_code"])

    return success_response({
        "message": "Connected",
        "account_id": result.get("account_id"),
    })


# ---------------------------------------------------------------------------
# Standalone callback server on port 1455
# ---------------------------------------------------------------------------

_callback_server: HTTPServer | None = None
_callback_lock = threading.Lock()


def _exchange_and_store(
    code: str,
    state: str,
    app=None,
    missing_message: str = "Unknown state — please retry",
) -> dict:
    """Exchange an OAuth code and persist tokens without consuming state on failure."""
    flow = _pending_flows.get(state)
    if not flow:
        return {
            "success": False,
            "error_code": "OPENAI_OAUTH_SESSION_EXPIRED",
            "message": missing_message,
            "status_code": 400,
        }

    code_verifier = flow["code_verifier"]
    app = app or flow.get("app")

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
        token_data = resp.json()
        if not isinstance(token_data, dict):
            logger.error("Token exchange response was not a JSON object")
            return {
                "success": False,
                "error_code": "OPENAI_OAUTH_TOKEN_EXCHANGE_FAILED",
                "message": "OpenAI token 响应格式无效",
                "status_code": 500,
            }
    except http_requests.RequestException as e:
        logger.error("Token exchange failed: %s", e)
        return {
            "success": False,
            "error_code": "OPENAI_OAUTH_TOKEN_EXCHANGE_FAILED",
            "message": _token_exchange_error_message(e),
            "status_code": 500,
        }
    except Exception as e:
        logger.error("Token exchange failed: %s", e)
        return {
            "success": False,
            "error_code": "OPENAI_OAUTH_TOKEN_EXCHANGE_FAILED",
            "message": "Token exchange failed，请检查部署机器或容器是否可以访问 OpenAI",
            "status_code": 500,
        }

    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    expires_in = _parse_expires_in(token_data.get("expires_in", 3600))
    account_id = _extract_account_id(token_data.get("id_token"))
    if not access_token:
        logger.error("Token exchange response missing access_token")
        return {
            "success": False,
            "error_code": "OPENAI_OAUTH_TOKEN_EXCHANGE_FAILED",
            "message": "OpenAI token 响应缺少 access_token",
            "status_code": 500,
        }

    with app.app_context() if app else nullcontext():
        try:
            settings = Settings.get_settings()
            settings.openai_oauth_access_token = access_token
            settings.openai_oauth_refresh_token = refresh_token
            settings.openai_oauth_expires_at = _utcnow() + timedelta(seconds=expires_in)
            settings.openai_oauth_account_id = account_id
            db.session.commit()
        except Exception as e:
            logger.error("Failed to store OAuth tokens: %s", e)
            db.session.rollback()
            return {
                "success": False,
                "error_code": "OPENAI_OAUTH_TOKEN_STORE_FAILED",
                "message": "保存 OpenAI 登录凭据失败",
                "status_code": 500,
            }

    _pending_flows.pop(state, None)
    logger.info("OpenAI OAuth connected for account: %s", account_id)
    return {"success": True, "account_id": account_id, "status_code": 200}


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
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(html.encode())

    def log_message(self, format, *args):
        logger.debug("OAuth callback server: %s", format % args)


def _ensure_callback_server():
    """Start the callback server on port 1455 if not already running."""
    global _callback_server
    with _callback_lock:
        if _callback_server is not None:
            return True
        try:
            server = HTTPServer(("0.0.0.0", _CALLBACK_PORT), _OAuthCallbackHandler)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            _callback_server = server
            logger.info("OAuth callback server started on port %d", _CALLBACK_PORT)
            return True
        except OSError as e:
            logger.warning("Port %d occupied — automatic callback unavailable, manual paste required: %s", _CALLBACK_PORT, e)
            return False


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
    hint = "" if success else '<p style="margin-top:1rem;font-size:0.85rem;color:#666">If the connection failed, copy the full URL from the address bar above and paste it into the manual input on the Settings page.</p>'
    return f"""<!DOCTYPE html>
<html><head><title>OpenAI OAuth</title></head>
<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="text-align:center">
<p style="font-size:1.5rem;color:{color}">{status_text}</p>
<p>This window will close automatically.</p>
{hint}
</div>
<script>
if (window.opener) {{
    window.opener.postMessage({{type:'openai-oauth-callback',success:{str(success).lower()},message:{json_message}}}, '*');
}}
setTimeout(function(){{ window.close(); }}, 2000);
</script>
</body></html>"""
