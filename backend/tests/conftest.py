"""
Shared pytest fixtures for backend tests.
"""

import os
import sys
import pytest
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch


backend_path = Path(__file__).parent.parent
project_root = backend_path.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(backend_path))

os.environ["TESTING"] = "true"
os.environ["USE_MOCK_AI"] = "true"
os.environ["GOOGLE_API_KEY"] = os.environ.get("GOOGLE_API_KEY", "mock-api-key-for-testing")
os.environ["FLASK_ENV"] = "testing"


@pytest.fixture(scope="session")
def app():
    """Create a Flask test app."""
    temp_dir = tempfile.mkdtemp()
    temp_db = os.path.join(temp_dir, "test.db")
    os.environ["DATABASE_URL"] = f"sqlite:///{temp_db}"

    from app import create_app

    test_app = create_app()
    test_app.config.update(
        {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "UPLOAD_FOLDER": temp_dir,
        }
    )

    with test_app.app_context():
        from models import db

        db.drop_all()
        db.create_all()

    yield test_app

    import shutil

    try:
        shutil.rmtree(temp_dir)
    except Exception:
        pass


@pytest.fixture(scope="function")
def client(app):
    """Create a test client with a fresh schema per test."""
    with app.app_context():
        from models import db

        db.session.remove()
        db.drop_all()
        db.create_all()

        with app.test_client() as test_client:
            yield test_client

        db.session.remove()
        db.drop_all()


@pytest.fixture(scope="function")
def db_session(app):
    """Create a fresh database session per test."""
    with app.app_context():
        from models import db

        db.session.remove()
        db.drop_all()
        db.create_all()
        yield db.session
        db.session.remove()
        db.drop_all()


@pytest.fixture
def sample_project(client):
    """Create a sample project."""
    response = client.post(
        "/api/projects",
        json={
            "creation_type": "idea",
            "idea_prompt": "测试PPT生成",
        },
    )
    data = response.get_json()
    return data["data"] if data.get("success") else None


@pytest.fixture
def mock_ai_service():
    """Mock AI service to avoid real API calls."""
    with patch("services.ai_service.AIService") as mock:
        mock_instance = MagicMock()
        mock.return_value = mock_instance

        mock_instance.generate_outline.return_value = [
            {"title": "测试页面1", "points": ["要点1", "要点2"]},
            {"title": "测试页面2", "points": ["要点3", "要点4"]},
        ]

        mock_instance.flatten_outline.return_value = [
            {"title": "测试页面1", "points": ["要点1", "要点2"]},
            {"title": "测试页面2", "points": ["要点3", "要点4"]},
        ]

        mock_instance.generate_page_description.return_value = {
            "title": "测试标题",
            "text_content": ["内容1", "内容2"],
            "extra_fields": {"排版布局": "居中布局"},
        }

        from PIL import Image

        test_image = Image.new("RGB", (1920, 1080), color="blue")
        mock_instance.generate_image.return_value = test_image

        yield mock_instance


@pytest.fixture
def temp_upload_dir():
    """Create a temporary upload directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def sample_image_file():
    """Create a sample image file."""
    import io
    from PIL import Image

    img = Image.new("RGB", (100, 100), color="red")
    img_bytes = io.BytesIO()
    img.save(img_bytes, format="PNG")
    img_bytes.seek(0)
    return img_bytes


def assert_success_response(response, status_code=200):
    """Assert a successful API response."""
    assert response.status_code == status_code
    data = response.get_json()
    assert data is not None
    assert data.get("success") is True
    return data


def assert_error_response(response, expected_status=None):
    """Assert an error API response."""
    if expected_status:
        assert response.status_code == expected_status
    data = response.get_json()
    assert data is not None
    assert data.get("success") is False or "error" in data
    return data
