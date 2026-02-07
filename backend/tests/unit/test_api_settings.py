"""
Settings API unit tests
"""

import pytest

from conftest import assert_success_response, assert_error_response


class TestSettingsAspectRatio:
    """Image aspect ratio settings tests"""

    def test_get_settings_includes_image_aspect_ratio(self, client):
        response = client.get("/api/settings")
        data = assert_success_response(response)
        assert data["data"]["image_aspect_ratio"] == "16:9"

    def test_update_settings_persists_image_aspect_ratio(self, client):
        response = client.put("/api/settings", json={"image_aspect_ratio": "4:3"})
        data = assert_success_response(response)
        assert data["data"]["image_aspect_ratio"] == "4:3"
        assert client.application.config["DEFAULT_ASPECT_RATIO"] == "4:3"

        response = client.get("/api/settings")
        data = assert_success_response(response)
        assert data["data"]["image_aspect_ratio"] == "4:3"

    def test_update_settings_normalizes_image_aspect_ratio(self, client):
        response = client.put("/api/settings", json={"image_aspect_ratio": "1920:1080"})
        data = assert_success_response(response)
        assert data["data"]["image_aspect_ratio"] == "16:9"

    @pytest.mark.parametrize(
        "value",
        [
            "",
            None,
            "16x9",
            "16:0",
            "0:16",
            "abc",
            "1:1000",
            "1000:1",
        ],
    )
    def test_update_settings_rejects_invalid_image_aspect_ratio(self, client, value):
        response = client.put("/api/settings", json={"image_aspect_ratio": value})
        assert_error_response(response, expected_status=400)

