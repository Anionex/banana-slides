"""Task manager image prompt field filtering regression tests."""

import json

import pytest

from models import Settings, db
from services.task_manager import _append_extra_fields, get_image_prompt_field_names


@pytest.fixture(autouse=True)
def restore_image_prompt_fields(client):
    with client.application.app_context():
        settings = Settings.get_settings()
        original_value = settings.image_prompt_extra_fields
    yield
    with client.application.app_context():
        db.session.rollback()
        settings = Settings.get_settings()
        settings.image_prompt_extra_fields = original_value
        db.session.commit()


def _set_image_prompt_fields(client, value):
    with client.application.app_context():
        settings = Settings.get_settings()
        settings.image_prompt_extra_fields = value
        db.session.commit()


def test_image_prompt_field_names_fallback_to_default_when_not_set(client):
    _set_image_prompt_fields(client, None)

    with client.application.app_context():
        fields = get_image_prompt_field_names()
        assert fields == set(Settings.DEFAULT_IMAGE_PROMPT_FIELDS)
        assert '演讲者备注' not in fields


def test_append_extra_fields_filters_by_allowlist(client):
    _set_image_prompt_fields(client, json.dumps(['视觉元素', '视觉焦点']))

    with client.application.app_context():
        desc_content = {
            'extra_fields': {
                '视觉元素': '蓝色配色',
                '演讲者备注': '右下角证明内容',
            }
        }
        result = _append_extra_fields('页面正文', desc_content)
        assert '视觉元素：蓝色配色' in result
        assert '演讲者备注' not in result


def test_append_extra_fields_respects_empty_allowlist(client):
    _set_image_prompt_fields(client, json.dumps([]))

    with client.application.app_context():
        desc_content = {
            'extra_fields': {
                '视觉元素': '蓝色配色',
                '视觉焦点': '中心人物',
            }
        }
        result = _append_extra_fields('页面正文', desc_content)
        assert result == '页面正文'


def test_append_extra_fields_uses_prefetched_allowlist(monkeypatch):
    def fail_if_fetching_settings():
        raise AssertionError('settings should be pre-fetched by the task')

    monkeypatch.setattr(
        'services.task_manager.get_image_prompt_field_names',
        fail_if_fetching_settings,
    )

    desc_content = {
        'extra_fields': {
            '视觉元素': '蓝色配色',
            '演讲者备注': '不要进入图片提示词',
        }
    }

    result = _append_extra_fields('页面正文', desc_content, {'视觉元素'})
    assert '视觉元素：蓝色配色' in result
    assert '演讲者备注' not in result


def test_append_extra_fields_handles_missing_description_text():
    result = _append_extra_fields(None, {'extra_fields': {'视觉元素': '蓝色配色'}}, {'视觉元素'})

    assert result == '视觉元素：蓝色配色'


def test_append_extra_fields_handles_missing_description_content():
    result = _append_extra_fields('页面正文', None, {'视觉元素'})

    assert result == '页面正文'


def test_append_extra_fields_keeps_zero_values():
    result = _append_extra_fields(
        '页面正文',
        {'extra_fields': {'数量': 0, '空白': '   ', '缺失': None}},
        {'数量', '空白', '缺失'},
    )

    assert '数量：0' in result
    assert '空白' not in result
    assert '缺失' not in result
