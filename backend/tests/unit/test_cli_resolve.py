"""Tests for CLI short ID resolution and working project context."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from cli.banana_cli.resolve import (
    _context_path,
    _is_full_uuid,
    clear_working_project,
    get_working_project,
    resolve_page_id,
    resolve_project_id,
    set_working_project,
)
from cli.banana_cli.errors import InputError

# Note: The API uses "project_id" as key for projects and "page_id" for pages,
# but the resolver also supports "id" as fallback for flexibility.


# --- _is_full_uuid ---

def test_is_full_uuid_valid():
    assert _is_full_uuid("a1b2c3d4-e5f6-7890-abcd-ef1234567890") is True


def test_is_full_uuid_short():
    assert _is_full_uuid("a1b2") is False


def test_is_full_uuid_no_dashes():
    assert _is_full_uuid("a1b2c3d4e5f67890abcdef1234567890xxxx") is False


# --- Working project context ---

def test_set_and_get_working_project(tmp_path, monkeypatch):
    ctx_file = tmp_path / "context.json"
    monkeypatch.setattr("cli.banana_cli.resolve._context_path", lambda: ctx_file)

    set_working_project("abc-123")
    assert get_working_project() == "abc-123"


def test_clear_working_project(tmp_path, monkeypatch):
    ctx_file = tmp_path / "context.json"
    monkeypatch.setattr("cli.banana_cli.resolve._context_path", lambda: ctx_file)

    set_working_project("abc-123")
    clear_working_project()
    assert get_working_project() is None


def test_get_working_project_no_file(tmp_path, monkeypatch):
    ctx_file = tmp_path / "nonexistent" / "context.json"
    monkeypatch.setattr("cli.banana_cli.resolve._context_path", lambda: ctx_file)

    assert get_working_project() is None


def test_get_working_project_corrupt_file(tmp_path, monkeypatch):
    ctx_file = tmp_path / "context.json"
    ctx_file.write_text("not json", encoding="utf-8")
    monkeypatch.setattr("cli.banana_cli.resolve._context_path", lambda: ctx_file)

    assert get_working_project() is None


# --- resolve_project_id ---

def test_resolve_full_uuid():
    full = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    assert resolve_project_id(full) == full


def test_resolve_short_prefix_unique():
    api = MagicMock()
    api.get.return_value = {
        "data": {
            "projects": [
                {"project_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "idea_prompt": "test"},
                {"project_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901", "idea_prompt": "other"},
            ]
        }
    }

    result = resolve_project_id("a1b2", api=api)
    assert result == "a1b2c3d4-e5f6-7890-abcd-ef1234567890"


def test_resolve_short_prefix_ambiguous():
    api = MagicMock()
    api.get.return_value = {
        "data": {
            "projects": [
                {"project_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "idea_prompt": "test1"},
                {"project_id": "a1b2d5e6-f7a8-9012-cdef-123456789012", "idea_prompt": "test2"},
            ]
        }
    }

    with pytest.raises(InputError, match="Ambiguous prefix"):
        resolve_project_id("a1b2", api=api)


def test_resolve_short_prefix_no_match():
    api = MagicMock()
    api.get.return_value = {"data": {"projects": []}}

    with pytest.raises(InputError, match="No project found"):
        resolve_project_id("zzzz", api=api)


def test_resolve_falls_back_to_context(tmp_path, monkeypatch):
    ctx_file = tmp_path / "context.json"
    monkeypatch.setattr("cli.banana_cli.resolve._context_path", lambda: ctx_file)

    full_id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    set_working_project(full_id)

    result = resolve_project_id(None)
    assert result == full_id


def test_resolve_none_no_context_raises():
    with patch("cli.banana_cli.resolve.get_working_project", return_value=None):
        with pytest.raises(InputError, match="No project ID provided"):
            resolve_project_id(None)


def test_resolve_none_context_disabled_raises():
    with pytest.raises(InputError, match="Project ID is required"):
        resolve_project_id(None, allow_context=False)


# --- resolve_page_id ---

def test_resolve_page_full_uuid():
    full = "p1b2c3d4-e5f6-7890-abcd-ef1234567890"
    assert resolve_page_id(full, "proj-id") == full


def test_resolve_page_short_prefix():
    api = MagicMock()
    api.get.return_value = {
        "data": {
            "pages": [
                {"page_id": "p1b2c3d4-e5f6-7890-abcd-ef1234567890", "outline_content": {"title": "Intro"}},
                {"page_id": "q2c3d4e5-f6a7-8901-bcde-f12345678901", "outline_content": {"title": "Main"}},
            ]
        }
    }

    result = resolve_page_id("p1b2", "proj-id", api=api)
    assert result == "p1b2c3d4-e5f6-7890-abcd-ef1234567890"


def test_resolve_page_no_match():
    api = MagicMock()
    api.get.return_value = {"data": {"pages": []}}

    with pytest.raises(InputError, match="No page found"):
        resolve_page_id("zzzz", "proj-id", api=api)


def test_resolve_page_ambiguous():
    api = MagicMock()
    api.get.return_value = {
        "data": {
            "pages": [
                {"page_id": "p1b2aaaa-0000-0000-0000-000000000001", "outline_content": {"title": "A"}},
                {"page_id": "p1b2bbbb-0000-0000-0000-000000000002", "outline_content": {"title": "B"}},
            ]
        }
    }

    with pytest.raises(InputError, match="Ambiguous prefix"):
        resolve_page_id("p1b2", "proj-id", api=api)
