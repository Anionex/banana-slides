"""
pytest配置文件 - 提供测试fixtures和配置

用于后端所有测试的共享配置和fixtures
"""

import os
import sys
import pytest
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

# 确保backend目录在Python路径中
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

# 设置测试环境变量 - 必须在导入app之前设置
os.environ['TESTING'] = 'true'
os.environ['USE_MOCK_AI'] = 'true'  # 标记使用mock AI服务
os.environ['GOOGLE_API_KEY'] = os.environ.get('GOOGLE_API_KEY', 'mock-api-key-for-testing')
os.environ['FLASK_ENV'] = 'testing'


@pytest.fixture(scope='session')
def app():
    """创建Flask测试应用"""
    # 创建临时目录用于测试
    temp_dir = tempfile.mkdtemp()
    temp_db = os.path.join(temp_dir, 'test.db')
    
    # 设置测试数据库路径
    os.environ['DATABASE_URL'] = f'sqlite:///{temp_db}'
    
    # 现在导入app
    from app import create_app
    
    # 使用工厂函数创建测试应用
    test_app = create_app()
    
    # 覆盖配置
    test_app.config.update({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': f'sqlite:///{temp_db}',
        'WTF_CSRF_ENABLED': False,
        'UPLOAD_FOLDER': temp_dir,
    })
    
    # 创建应用上下文
    with test_app.app_context():
        from models import db
        db.create_all()
    
    yield test_app
    
    # 清理
    import shutil
    try:
        shutil.rmtree(temp_dir)
    except Exception:
        pass


@pytest.fixture(scope='function')
def client(app):
    """创建测试客户端"""
    with app.test_client() as test_client:
        with app.app_context():
            from models import db
            # 清理旧数据，保持测试隔离
            db.session.rollback()
            for table in reversed(db.metadata.sorted_tables):
                db.session.execute(table.delete())
            db.session.commit()
            yield test_client
            db.session.rollback()


@pytest.fixture(scope='function')
def db_session(app):
    """创建数据库会话"""
    with app.app_context():
        from models import db
        db.create_all()
        yield db.session
        db.session.remove()
        db.drop_all()


@pytest.fixture
def sample_project(client):
    """创建示例项目"""
    response = client.post('/api/projects', 
        json={
            'creation_type': 'idea',
            'idea_prompt': '测试PPT生成'
        }
    )
    data = response.get_json()
    return data['data'] if data.get('success') else None


@pytest.fixture
def mock_ai_service():
    """Mock AI服务，避免真实API调用（使用标准库unittest.mock）"""
    with patch('services.ai_service.AIService') as mock:
        # Mock实例
        mock_instance = MagicMock()
        mock.return_value = mock_instance
        
        # Mock大纲生成
        mock_instance.generate_outline.return_value = [
            {'title': '测试页面1', 'points': ['要点1', '要点2']},
            {'title': '测试页面2', 'points': ['要点3', '要点4']},
        ]
        
        # Mock扁平化大纲
        mock_instance.flatten_outline.return_value = [
            {'title': '测试页面1', 'points': ['要点1', '要点2']},
            {'title': '测试页面2', 'points': ['要点3', '要点4']},
        ]
        
        # Mock描述生成
        mock_instance.generate_page_description.return_value = {
            'title': '测试标题',
            'text_content': ['内容1', '内容2'],
            'layout_suggestion': '居中布局'
        }
        
        # Mock图片生成 - 返回一个简单的测试图片
        from PIL import Image
        test_image = Image.new('RGB', (1920, 1080), color='blue')
        mock_instance.generate_image.return_value = test_image
        
        yield mock_instance


@pytest.fixture
def temp_upload_dir():
    """创建临时上传目录"""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def sample_image_file():
    """创建示例图片文件"""
    # 创建一个简单的PNG文件（1x1像素的红色图片）
    import io
    from PIL import Image
    
    img = Image.new('RGB', (100, 100), color='red')
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')
    img_bytes.seek(0)
    
    return img_bytes


# =====================================
# 测试工具函数
# =====================================

def assert_success_response(response, status_code=200):
    """断言成功响应"""
    assert response.status_code == status_code
    data = response.get_json()
    assert data is not None
    assert data.get('success') is True
    return data


def assert_error_response(response, expected_status=None):
    """断言错误响应"""
    if expected_status:
        assert response.status_code == expected_status
    data = response.get_json()
    assert data is not None
    assert data.get('success') is False or 'error' in data
    return data

