"""
Integration tests for Codex provider retry logic.

These tests hit the real Codex API via the running backend to verify
the retry mechanism works end-to-end. They require:
  - Backend running on localhost (port from env or 5005)
  - AI_PROVIDER_FORMAT=codex with a valid API key configured

Skipped automatically if the backend is unreachable or not using codex.
"""

import os
import pytest
import requests

BACKEND_PORT = os.environ.get("BACKEND_PORT", "5005")
BASE_URL = f"http://localhost:{BACKEND_PORT}"


def _backend_is_codex():
    """Check if backend is reachable and using codex provider."""
    try:
        resp = requests.get(f"{BASE_URL}/api/settings", timeout=5)
        if resp.status_code != 200:
            return False
        data = resp.json().get("data", {})
        return data.get("ai_provider_format") == "codex"
    except Exception:
        return False


skip_unless_codex = pytest.mark.skipif(
    not _backend_is_codex(),
    reason="Backend not running or not using codex provider",
)


@skip_unless_codex
class TestCodexRetryIntegration:

    def test_text_model_verify_succeeds(self):
        """Verify text model works via the settings verify endpoint.

        This exercises CodexTextProvider.generate_text (and its retry logic)
        through the real backend.
        """
        resp = requests.post(
            f"{BASE_URL}/api/settings/verify",
            json={"type": "text-model"},
            timeout=60,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("success") is True, f"Text model verify failed: {data}"

    def test_caption_model_verify_succeeds(self):
        """Verify caption model works (also uses CodexTextProvider)."""
        resp = requests.post(
            f"{BASE_URL}/api/settings/verify",
            json={"type": "caption-model"},
            timeout=60,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("success") is True, f"Caption model verify failed: {data}"

    def test_image_model_verify_succeeds(self):
        """Verify image model works via the settings verify endpoint.

        This exercises CodexImageProvider.generate_image (and its retry logic)
        through the real backend.
        """
        resp = requests.post(
            f"{BASE_URL}/api/settings/verify",
            json={"type": "image-model"},
            timeout=120,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("success") is True, f"Image model verify failed: {data}"
