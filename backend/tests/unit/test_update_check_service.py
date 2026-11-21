from unittest.mock import Mock, patch

from services.update_check_service import check_for_update, get_current_version_metadata


def _tag(name, digest, last_updated="2026-06-01T08:11:22Z", status="active", images=None):
    return {
        "name": name,
        "tag_status": status,
        "last_updated": last_updated,
        "images": images if images is not None else [{"digest": digest, "architecture": "amd64", "os": "linux"}],
    }


def _mock_response(tags):
    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {"results": tags}
    return response


def test_check_for_update_reports_up_to_date_for_matching_docker_sha(monkeypatch):
    monkeypatch.setenv("IN_DOCKER", "1")
    monkeypatch.setenv("APP_COMMIT_SHA", "abcdef1234567890")
    monkeypatch.setenv("APP_COMMIT_SHORT_SHA", "abcdef1")

    tags = [
        _tag("latest", "sha256:latest"),
        _tag("sha-abcdef1", "sha256:latest"),
    ]

    with patch("services.update_check_service.requests.get", return_value=_mock_response(tags)):
        result = check_for_update()

    assert result["status"] == "up_to_date"
    assert result["update_available"] is False
    assert result["latest"]["sha"] == "abcdef1"


def test_check_for_update_accepts_sha256_length_version_tags(monkeypatch):
    full_sha = "a" * 64
    monkeypatch.setenv("IN_DOCKER", "1")
    monkeypatch.setenv("APP_COMMIT_SHA", full_sha)
    monkeypatch.setenv("APP_COMMIT_SHORT_SHA", full_sha[:7])

    tags = [
        _tag("latest", "sha256:latest"),
        _tag(f"sha-{full_sha}", "sha256:latest"),
    ]

    with patch("services.update_check_service.requests.get", return_value=_mock_response(tags)):
        result = check_for_update()

    assert result["status"] == "up_to_date"
    assert result["latest"]["sha"] == full_sha


def test_check_for_update_reports_newer_docker_image(monkeypatch):
    monkeypatch.setenv("IN_DOCKER", "1")
    monkeypatch.setenv("APP_COMMIT_SHA", "1111111222222222")
    monkeypatch.setenv("APP_COMMIT_SHORT_SHA", "1111111")

    tags = [
        _tag("latest", "sha256:latest"),
        _tag("sha-2222222", "sha256:latest"),
        _tag("sha-1111111", "sha256:old", "2026-05-01T08:11:22Z"),
    ]

    with patch("services.update_check_service.requests.get", return_value=_mock_response(tags)):
        result = check_for_update()

    assert result["status"] == "update_available"
    assert result["update_available"] is True
    assert result["latest"]["image"] == "anoinex/banana-slides:latest"


def test_check_for_update_does_not_report_update_for_newer_local_build(monkeypatch):
    monkeypatch.setenv("IN_DOCKER", "1")
    monkeypatch.setenv("APP_COMMIT_SHA", "1111111222222222")
    monkeypatch.setenv("APP_COMMIT_SHORT_SHA", "1111111")
    monkeypatch.setenv("APP_BUILD_DATE", "2026-06-01T08:20:00Z")

    tags = [
        _tag("latest", "sha256:latest", "2026-06-01T08:11:22Z"),
        _tag("sha-2222222", "sha256:latest", "2026-06-01T08:11:22Z"),
    ]

    with patch("services.update_check_service.requests.get", return_value=_mock_response(tags)):
        result = check_for_update()

    assert result["status"] == "up_to_date"
    assert result["update_available"] is False


def test_check_for_update_reports_newer_main_for_local_source(monkeypatch):
    monkeypatch.setenv("IN_DOCKER", "0")
    monkeypatch.setenv("APP_COMMIT_SHA", "3333333444444444")
    monkeypatch.setenv("APP_COMMIT_SHORT_SHA", "3333333")

    with (
        patch("services.update_check_service._git_remote_branch_sha", return_value="2222222444444444"),
        patch("services.update_check_service._git_ancestor_status", return_value=False),
        patch("services.update_check_service.requests.get") as docker_request,
    ):
        result = check_for_update()

    assert result["status"] == "update_available"
    assert result["update_available"] is True
    assert result["latest"]["sha"] == "2222222444444444"
    assert result["repository"] == "origin/main"
    docker_request.assert_not_called()


def test_check_for_update_reports_local_source_up_to_date(monkeypatch):
    monkeypatch.setenv("IN_DOCKER", "0")
    monkeypatch.setenv("APP_COMMIT_SHA", "2222222444444444")
    monkeypatch.setenv("APP_COMMIT_SHORT_SHA", "2222222")

    with (
        patch("services.update_check_service._git_remote_branch_sha", return_value="2222222444444444"),
        patch("services.update_check_service.requests.get") as docker_request,
    ):
        result = check_for_update()

    assert result["status"] == "up_to_date"
    assert result["update_available"] is False
    assert result["latest"]["sha"] == "2222222444444444"
    docker_request.assert_not_called()


def test_check_for_update_reports_local_source_up_to_date_when_latest_is_ancestor(monkeypatch):
    monkeypatch.setenv("IN_DOCKER", "0")
    monkeypatch.setenv("APP_COMMIT_SHA", "3333333444444444")
    monkeypatch.setenv("APP_COMMIT_SHORT_SHA", "3333333")

    with (
        patch("services.update_check_service._git_remote_branch_sha", return_value="2222222444444444"),
        patch("services.update_check_service._git_ancestor_status", return_value=True),
        patch("services.update_check_service.requests.get") as docker_request,
    ):
        result = check_for_update()

    assert result["status"] == "up_to_date"
    assert result["update_available"] is False
    docker_request.assert_not_called()


def test_check_for_update_matches_short_sha_against_full_source_sha(monkeypatch):
    monkeypatch.setenv("IN_DOCKER", "0")
    monkeypatch.setenv("APP_COMMIT_SHA", "abcdef1234567890abcdef1234567890abcdef12")
    monkeypatch.setenv("APP_COMMIT_SHORT_SHA", "abcdef1")

    with patch("services.update_check_service._git_remote_branch_sha", return_value="abcdef1234567890abcdef1234567890abcdef12"):
        result = check_for_update()

    assert result["status"] == "up_to_date"
    assert result["update_available"] is False
    assert result["latest"]["sha"] == "abcdef1234567890abcdef1234567890abcdef12"


def test_check_for_update_reports_unknown_when_source_latest_is_missing(monkeypatch):
    monkeypatch.setenv("IN_DOCKER", "0")
    monkeypatch.setenv("APP_COMMIT_SHA", "abcdef1234567890")
    monkeypatch.setenv("APP_COMMIT_SHORT_SHA", "abcdef1")

    with (
        patch("services.update_check_service._git_remote_branch_sha", return_value=""),
        patch("services.update_check_service.requests.get") as docker_request,
    ):
        result = check_for_update()

    assert result["status"] == "unknown"
    assert result["latest"] is None
    docker_request.assert_not_called()


def test_check_for_update_reports_unknown_when_source_current_is_missing(monkeypatch):
    monkeypatch.setenv("IN_DOCKER", "0")
    monkeypatch.setenv("APP_COMMIT_SHA", "")
    monkeypatch.setenv("APP_COMMIT_SHORT_SHA", "")

    with (
        patch("services.update_check_service._git_value", return_value=""),
        patch("services.update_check_service._git_remote_branch_sha", return_value="abcdef1234567890"),
        patch("services.update_check_service.requests.get") as docker_request,
    ):
        result = check_for_update()

    assert result["status"] == "unknown"
    assert result["update_available"] is False
    docker_request.assert_not_called()


def test_check_for_update_uses_latest_timestamp_when_sha_tag_is_missing(monkeypatch):
    monkeypatch.setenv("IN_DOCKER", "1")
    monkeypatch.setenv("APP_COMMIT_SHA", "")
    monkeypatch.setenv("APP_COMMIT_SHORT_SHA", "")
    monkeypatch.setenv("APP_BUILD_DATE", "2026-06-01T08:00:00Z")

    tags = [
        _tag("latest", "sha256:latest", "2026-06-01T08:11:22Z"),
    ]

    with patch("services.update_check_service.requests.get", return_value=_mock_response(tags)):
        result = check_for_update()

    assert result["status"] == "update_available"
    assert result["update_available"] is True
    assert result["latest"]["sha"] == ""


def test_check_for_update_timestamp_fallback_can_report_up_to_date(monkeypatch):
    monkeypatch.setenv("IN_DOCKER", "1")
    monkeypatch.setenv("APP_COMMIT_SHA", "")
    monkeypatch.setenv("APP_COMMIT_SHORT_SHA", "")
    monkeypatch.setenv("APP_BUILD_DATE", "2026-06-01T08:20:00Z")

    tags = [
        _tag("latest", "sha256:latest", "2026-06-01T08:11:22Z"),
    ]

    with patch("services.update_check_service.requests.get", return_value=_mock_response(tags)):
        result = check_for_update()

    assert result["status"] == "up_to_date"
    assert result["update_available"] is False
    assert result["latest"]["sha"] == ""


def test_check_for_update_timestamp_fallback_allows_push_latency(monkeypatch):
    monkeypatch.setenv("IN_DOCKER", "1")
    monkeypatch.setenv("APP_COMMIT_SHA", "")
    monkeypatch.setenv("APP_COMMIT_SHORT_SHA", "")
    monkeypatch.setenv("APP_BUILD_DATE", "2026-06-01T08:10:00Z")

    tags = [
        _tag("latest", "sha256:latest", "2026-06-01T08:11:22Z"),
    ]

    with patch("services.update_check_service.requests.get", return_value=_mock_response(tags)):
        result = check_for_update()

    assert result["status"] == "up_to_date"
    assert result["update_available"] is False
    assert result["latest"]["sha"] == ""


def test_check_for_update_handles_naive_build_dates(monkeypatch):
    monkeypatch.setenv("IN_DOCKER", "1")
    monkeypatch.setenv("APP_COMMIT_SHA", "")
    monkeypatch.setenv("APP_COMMIT_SHORT_SHA", "")
    monkeypatch.setenv("APP_BUILD_DATE", "2026-06-01T08:00:00")

    tags = [
        _tag("latest", "sha256:latest", "2026-06-01T08:11:22Z"),
    ]

    with patch("services.update_check_service.requests.get", return_value=_mock_response(tags)):
        result = check_for_update()

    assert result["status"] == "update_available"
    assert result["update_available"] is True


def test_check_for_update_handles_fractional_second_timestamps(monkeypatch):
    monkeypatch.setenv("IN_DOCKER", "1")
    monkeypatch.setenv("APP_COMMIT_SHA", "")
    monkeypatch.setenv("APP_COMMIT_SHORT_SHA", "")
    monkeypatch.setenv("APP_BUILD_DATE", "2026-06-01T08:00:00.123Z")

    tags = [
        _tag("latest", "sha256:latest", "2026-06-01T08:11:22.727985Z"),
    ]

    with patch("services.update_check_service.requests.get", return_value=_mock_response(tags)):
        result = check_for_update()

    assert result["status"] == "update_available"
    assert result["update_available"] is True


def test_check_for_update_reports_unknown_when_latest_updated_fails_to_parse(monkeypatch):
    monkeypatch.setenv("IN_DOCKER", "1")
    monkeypatch.setenv("APP_COMMIT_SHA", "")
    monkeypatch.setenv("APP_COMMIT_SHORT_SHA", "")
    monkeypatch.setenv("APP_BUILD_DATE", "2026-06-01T08:00:00Z")

    tags = [
        _tag("latest", "sha256:latest", "invalid-date-format"),
    ]

    with patch("services.update_check_service.requests.get", return_value=_mock_response(tags)):
        result = check_for_update()

    assert result["status"] == "unknown"
    assert result["update_available"] is False


def test_check_for_update_treats_null_docker_hub_lists_as_empty(monkeypatch):
    monkeypatch.setenv("IN_DOCKER", "1")
    monkeypatch.setenv("APP_COMMIT_SHA", "")
    monkeypatch.setenv("APP_COMMIT_SHORT_SHA", "")
    monkeypatch.setenv("APP_BUILD_DATE", "2026-06-01T08:00:00Z")

    tags = [
        _tag("latest", "sha256:latest", "2026-06-01T08:11:22Z", images=[]),
    ]
    tags[0]["images"] = None

    with patch("services.update_check_service.requests.get", return_value=_mock_response(tags)):
        result = check_for_update()

    assert result["status"] == "update_available"
    assert result["latest"]["sha"] == ""


def test_check_for_update_ignores_null_image_entries(monkeypatch):
    monkeypatch.setenv("IN_DOCKER", "1")
    monkeypatch.setenv("APP_COMMIT_SHA", "abcdef1234567890")
    monkeypatch.setenv("APP_COMMIT_SHORT_SHA", "abcdef1")

    tags = [
        _tag("latest", "sha256:latest", images=[None, {"digest": "sha256:latest"}]),
        _tag("sha-abcdef1", "sha256:latest", images=[None, {"digest": "sha256:latest"}]),
    ]

    with patch("services.update_check_service.requests.get", return_value=_mock_response(tags)):
        result = check_for_update()

    assert result["status"] == "up_to_date"
    assert result["latest"]["sha"] == "abcdef1"


def test_check_for_update_ignores_non_dict_image_entries(monkeypatch):
    monkeypatch.setenv("IN_DOCKER", "1")
    monkeypatch.setenv("APP_COMMIT_SHA", "abcdef1234567890")
    monkeypatch.setenv("APP_COMMIT_SHORT_SHA", "abcdef1")

    tags = [
        _tag("latest", "sha256:latest", images=["unexpected", {"digest": "sha256:latest"}]),
        _tag("sha-abcdef1", "sha256:latest", images=["unexpected", {"digest": "sha256:latest"}]),
    ]

    with patch("services.update_check_service.requests.get", return_value=_mock_response(tags)):
        result = check_for_update()

    assert result["status"] == "up_to_date"
    assert result["latest"]["sha"] == "abcdef1"


def test_check_for_update_treats_non_list_images_as_empty(monkeypatch):
    monkeypatch.setenv("IN_DOCKER", "1")
    monkeypatch.setenv("APP_COMMIT_SHA", "")
    monkeypatch.setenv("APP_COMMIT_SHORT_SHA", "")
    monkeypatch.setenv("APP_BUILD_DATE", "2026-06-01T08:00:00Z")

    tags = [
        _tag("latest", "sha256:latest", "2026-06-01T08:11:22Z"),
    ]
    tags[0]["images"] = {"digest": "sha256:latest"}

    with patch("services.update_check_service.requests.get", return_value=_mock_response(tags)):
        result = check_for_update()

    assert result["status"] == "update_available"
    assert result["latest"]["sha"] == ""


def test_check_for_update_treats_null_results_as_empty(monkeypatch):
    monkeypatch.setenv("IN_DOCKER", "1")
    response = _mock_response([])
    response.json.return_value = {"results": None}

    with patch("services.update_check_service.requests.get", return_value=response):
        result = check_for_update()

    assert result["status"] == "unknown"
    assert result["latest"] is None


def test_check_for_update_treats_non_list_results_as_empty(monkeypatch):
    monkeypatch.setenv("IN_DOCKER", "1")
    response = _mock_response([])
    response.json.return_value = {"results": 1}

    with patch("services.update_check_service.requests.get", return_value=response):
        result = check_for_update()

    assert result["status"] == "unknown"
    assert result["latest"] is None


def test_check_for_update_treats_non_dict_response_payload_as_empty(monkeypatch):
    monkeypatch.setenv("IN_DOCKER", "1")
    response = _mock_response([])
    response.json.return_value = []

    with patch("services.update_check_service.requests.get", return_value=response):
        result = check_for_update()

    assert result["status"] == "unknown"
    assert result["latest"] is None


def test_check_for_update_ignores_non_dict_tag_results(monkeypatch):
    monkeypatch.setenv("IN_DOCKER", "1")
    response = _mock_response([])
    response.json.return_value = {"results": ["unexpected", _tag("latest", "sha256:latest")]}

    with patch("services.update_check_service.requests.get", return_value=response):
        result = check_for_update()

    assert result["status"] == "unknown"
    assert result["latest"]["sha"] == ""


def test_current_metadata_skips_git_fallback_inside_docker(monkeypatch):
    monkeypatch.setenv("IN_DOCKER", "1")
    monkeypatch.setenv("APP_COMMIT_SHA", "")
    monkeypatch.setenv("APP_COMMIT_SHORT_SHA", "")
    monkeypatch.setenv("APP_VERSION_TAG", "")

    with patch("services.update_check_service._git_value") as git_value:
        result = get_current_version_metadata()

    git_value.assert_not_called()
    assert result["is_docker"] is True
    assert result["commit_sha"] == ""
    assert result["short_sha"] == ""
