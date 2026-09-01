import pytest
from unittest.mock import MagicMock, patch
from services.prompts import get_style_from_content_prompt
from services.ai_service import AIService
from app import create_app


def test_get_style_from_content_prompt_structure_zh():
    content = "人工智能与现代医疗的结合，主要讲解 AI 在医学影像识别中的应用与未来趋势。"
    prompt = get_style_from_content_prompt(content=content, language='zh')

    assert content in prompt
    assert "视觉描述" in prompt
    assert "配色与材质" in prompt
    assert "内容与排版" in prompt
    assert "插图与渲染要求" in prompt
    assert "简约商务" in prompt
    assert "现代科技" in prompt


def test_get_style_from_content_prompt_structure_en():
    content = "AI in Healthcare and Medical Imaging Diagnostics."
    prompt = get_style_from_content_prompt(content=content, language='en')

    assert content in prompt
    assert "Visual Description" in prompt
    assert "Color & Material" in prompt
    assert "Content & Typography" in prompt
    assert "Illustration & Rendering" in prompt


def test_ai_service_generate_style_from_content():
    ai_service = AIService.__new__(AIService)
    mock_provider = MagicMock()
    mock_provider.generate_text.return_value = "视觉描述：极简医疗科技风...\n配色与材质：背景采用纯白（#FFFFFF）..."
    ai_service.text_provider = mock_provider

    res = ai_service.generate_style_from_content("AI 医疗", language='zh')
    assert "极简医疗科技风" in res
    mock_provider.generate_text.assert_called_once()


def test_ai_service_generate_style_from_content_empty():
    ai_service = AIService.__new__(AIService)
    with pytest.raises(ValueError, match="Content cannot be empty"):
        ai_service.generate_style_from_content("   ")


@pytest.fixture
def client():
    app = create_app()
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


def test_generate_style_from_content_api_success(client):
    with patch('controllers.project_controller.get_ai_service') as mock_get_ai:
        mock_ai = MagicMock()
        mock_ai.generate_style_from_content.return_value = "视觉描述：简约商务...\n配色与材质：#0B1F3B"
        mock_get_ai.return_value = mock_ai

        response = client.post('/api/generate-style-from-content', json={
            'content': '2026年企业数字化转型战略规划',
            'language': 'zh'
        })
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert "视觉描述：简约商务" in data['data']['style_description']
        mock_ai.generate_style_from_content.assert_called_once_with(
            content='2026年企业数字化转型战略规划',
            language='zh'
        )


def test_generate_style_from_content_api_validation(client):
    response = client.post('/api/generate-style-from-content', json={
        'content': '   '
    })
    assert response.status_code == 400
    data = response.get_json()
    assert data['success'] is False
