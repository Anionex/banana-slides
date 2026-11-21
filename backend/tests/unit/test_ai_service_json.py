import json
from unittest.mock import Mock

import pytest

from services.ai_service import AIService


@pytest.fixture(params=['text', 'image'])
def model_json(request):
    provider = Mock()
    service = AIService(text_provider=provider, image_provider=provider, caption_provider=provider)
    if request.param == 'image':
        return provider.generate_with_image, lambda: service.generate_json_with_image('Return JSON', 'slide.png')
    return provider.generate_text, lambda: service.generate_json('Return JSON')


@pytest.mark.parametrize('prefix,suffix', [
    ('', ''),
    ('```json\n', '\n```'),
    ('以下是结果：\n', '\n以上是结果。'),
    ('Here is the result [preview]:\n```json\n', '\n```\nThis is the final result.'),
])
def test_loads_json_with_optional_model_explanation(model_json, prefix, suffix):
    generate, parse = model_json
    expected = [{'title': 'Brackets [ ] and quote "', 'points': ['路径', 'a\\b']}]
    generate.return_value = prefix + json.dumps(expected, ensure_ascii=False) + suffix

    assert parse() == expected
    assert generate.call_count == 1


def test_retries_instead_of_returning_a_nested_fragment_of_invalid_json(model_json):
    generate, parse = model_json
    generate.return_value = 'Here is the result:\n[{"title": "Partial"},'

    with pytest.raises(json.JSONDecodeError):
        parse()
    assert generate.call_count == 3
