from unittest.mock import Mock, patch

import pytest
import requests

from controllers import openai_oauth_controller


def _token_response():
    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {
        "access_token": "access-token",
        "refresh_token": "refresh-token",
        "expires_in": 3600,
    }
    return response


def _token_response_without_access_token():
    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {
        "refresh_token": "refresh-token",
        "expires_in": 3600,
    }
    return response


def _token_response_with_invalid_expires_in():
    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {
        "access_token": "access-token",
        "refresh_token": "refresh-token",
        "expires_in": "not-a-number",
    }
    return response


def _list_token_response():
    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = ["unexpected"]
    return response


def _token_error_response():
    response = Mock()
    response.json.return_value = {
        "error": {
            "message": "authorization code is invalid",
        },
    }
    http_error = requests.HTTPError("400 Client Error")
    http_error.response = response
    response.raise_for_status.side_effect = http_error
    return response


def _token_error_response_with_raw_text():
    response = Mock()
    response.json.return_value = {"unexpected": "shape"}
    response.text = "invalid callback code"
    http_error = requests.HTTPError("400 Client Error")
    http_error.response = response
    response.raise_for_status.side_effect = http_error
    return response


def _token_error_response_with_broken_json():
    response = Mock()
    response.json.side_effect = RuntimeError("json parser failed")
    response.text = "raw upstream error"
    http_error = requests.HTTPError("400 Client Error")
    http_error.response = response
    response.raise_for_status.side_effect = http_error
    return response


def test_failed_auto_callback_keeps_state_for_manual_retry(client, app):
    """Manual paste should still work after the automatic callback cannot exchange tokens."""
    state = "state-123"
    callback_url = f"http://localhost:1455/auth/callback?code=auth-code&state={state}"

    openai_oauth_controller._pending_flows.clear()
    openai_oauth_controller._pending_flows[state] = {
        "code_verifier": "verifier-123",
        "app": app,
    }

    try:
        with patch(
            "controllers.openai_oauth_controller.http_requests.post",
            side_effect=requests.ConnectionError("container cannot reach OpenAI"),
        ):
            result = openai_oauth_controller._exchange_and_store("auth-code", state)

        assert result["success"] is False
        assert result["message"] == "Token exchange failed，请检查部署机器或容器是否可以访问 OpenAI"
        assert state in openai_oauth_controller._pending_flows

        with patch(
            "controllers.openai_oauth_controller.http_requests.post",
            side_effect=requests.ConnectionError("container still cannot reach OpenAI"),
        ):
            failed_response = client.post(
                "/api/settings/openai-oauth/manual-callback",
                json={"callback_url": callback_url},
            )

        assert failed_response.status_code == 500
        failed_data = failed_response.get_json()
        assert failed_data["error"]["code"] == "OPENAI_OAUTH_TOKEN_EXCHANGE_FAILED"
        assert failed_data["error"]["message"] == "Token exchange failed，请检查部署机器或容器是否可以访问 OpenAI"
        assert state in openai_oauth_controller._pending_flows

        with patch(
            "controllers.openai_oauth_controller.http_requests.post",
            return_value=_token_response(),
        ):
            response = client.post(
                "/api/settings/openai-oauth/manual-callback",
                json={"callback_url": callback_url},
            )

        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert state not in openai_oauth_controller._pending_flows

        with app.app_context():
            from models import Settings

            settings = Settings.get_settings()
            assert settings.openai_oauth_access_token == "access-token"
            assert settings.openai_oauth_refresh_token == "refresh-token"
    finally:
        openai_oauth_controller._pending_flows.clear()


def test_store_failure_rolls_back_and_keeps_state(app):
    state = "state-store-failure"
    openai_oauth_controller._pending_flows.clear()
    openai_oauth_controller._pending_flows[state] = {
        "code_verifier": "verifier-456",
        "app": app,
    }

    try:
        with (
            patch(
                "controllers.openai_oauth_controller.http_requests.post",
                return_value=_token_response(),
            ),
            patch(
                "controllers.openai_oauth_controller.db.session.commit",
                side_effect=RuntimeError("commit failed"),
            ),
            patch("controllers.openai_oauth_controller.db.session.rollback") as rollback,
        ):
            result = openai_oauth_controller._exchange_and_store("auth-code", state)

        assert result["success"] is False
        assert result["error_code"] == "OPENAI_OAUTH_TOKEN_STORE_FAILED"
        rollback.assert_called_once()
        assert state in openai_oauth_controller._pending_flows
    finally:
        openai_oauth_controller._pending_flows.clear()


def test_token_exchange_error_includes_openai_detail_and_keeps_state(app):
    state = "state-token-error"
    openai_oauth_controller._pending_flows.clear()
    openai_oauth_controller._pending_flows[state] = {
        "code_verifier": "verifier-789",
        "app": app,
    }

    try:
        with patch(
            "controllers.openai_oauth_controller.http_requests.post",
            return_value=_token_error_response(),
        ):
            result = openai_oauth_controller._exchange_and_store("auth-code", state)

        assert result["success"] is False
        assert result["error_code"] == "OPENAI_OAUTH_TOKEN_EXCHANGE_FAILED"
        assert "authorization code is invalid" in result["message"]
        assert state in openai_oauth_controller._pending_flows
    finally:
        openai_oauth_controller._pending_flows.clear()


def test_token_exchange_requires_access_token_and_keeps_state(app):
    state = "state-missing-access-token"
    openai_oauth_controller._pending_flows.clear()
    openai_oauth_controller._pending_flows[state] = {
        "code_verifier": "verifier-abc",
        "app": app,
    }

    try:
        with patch(
            "controllers.openai_oauth_controller.http_requests.post",
            return_value=_token_response_without_access_token(),
        ):
            result = openai_oauth_controller._exchange_and_store("auth-code", state)

        assert result["success"] is False
        assert result["error_code"] == "OPENAI_OAUTH_TOKEN_EXCHANGE_FAILED"
        assert result["message"] == "OpenAI token 响应缺少 access_token"
        assert state in openai_oauth_controller._pending_flows
    finally:
        openai_oauth_controller._pending_flows.clear()


def test_token_exchange_rejects_non_object_response_and_keeps_state(app):
    state = "state-list-token-response"
    openai_oauth_controller._pending_flows.clear()
    openai_oauth_controller._pending_flows[state] = {
        "code_verifier": "verifier-list",
        "app": app,
    }

    try:
        with patch(
            "controllers.openai_oauth_controller.http_requests.post",
            return_value=_list_token_response(),
        ):
            result = openai_oauth_controller._exchange_and_store("auth-code", state)

        assert result["success"] is False
        assert result["message"] == "OpenAI token 响应格式无效"
        assert state in openai_oauth_controller._pending_flows
    finally:
        openai_oauth_controller._pending_flows.clear()


def test_token_exchange_uses_raw_error_text_when_error_shape_is_unknown(app):
    state = "state-raw-error-text"
    openai_oauth_controller._pending_flows.clear()
    openai_oauth_controller._pending_flows[state] = {
        "code_verifier": "verifier-raw",
        "app": app,
    }

    try:
        with patch(
            "controllers.openai_oauth_controller.http_requests.post",
            return_value=_token_error_response_with_raw_text(),
        ):
            result = openai_oauth_controller._exchange_and_store("auth-code", state)

        assert result["success"] is False
        assert "invalid callback code" in result["message"]
        assert state in openai_oauth_controller._pending_flows
    finally:
        openai_oauth_controller._pending_flows.clear()


def test_token_exchange_uses_raw_error_text_when_error_json_raises(app):
    state = "state-broken-error-json"
    openai_oauth_controller._pending_flows.clear()
    openai_oauth_controller._pending_flows[state] = {
        "code_verifier": "verifier-broken-json",
        "app": app,
    }

    try:
        with patch(
            "controllers.openai_oauth_controller.http_requests.post",
            return_value=_token_error_response_with_broken_json(),
        ):
            result = openai_oauth_controller._exchange_and_store("auth-code", state)

        assert result["success"] is False
        assert "raw upstream error" in result["message"]
        assert state in openai_oauth_controller._pending_flows
    finally:
        openai_oauth_controller._pending_flows.clear()


def test_invalid_expires_in_falls_back_to_default(client, app):
    state = "state-invalid-expires"
    openai_oauth_controller._pending_flows.clear()
    openai_oauth_controller._pending_flows[state] = {
        "code_verifier": "verifier-exp",
        "app": app,
    }

    try:
        with patch(
            "controllers.openai_oauth_controller.http_requests.post",
            return_value=_token_response_with_invalid_expires_in(),
        ):
            result = openai_oauth_controller._exchange_and_store("auth-code", state)

        assert result["success"] is True
        assert state not in openai_oauth_controller._pending_flows
    finally:
        openai_oauth_controller._pending_flows.clear()


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (" 7200.9 ", 7200),
        ("not-a-number", 3600),
        (0, 3600),
        (-1, 3600),
        (10**12, openai_oauth_controller._MAX_EXPIRES_IN_SECONDS),
    ],
)
def test_parse_expires_in_is_defensive(value, expected):
    assert openai_oauth_controller._parse_expires_in(value) == expected
