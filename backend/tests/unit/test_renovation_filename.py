"""
翻新模式非 ASCII 文件名回归测试

Bug: secure_filename() 会剥除中文等非 ASCII 字符，导致
  '演示文稿.pdf' → 'pdf'（无扩展名），后台任务找不到 .pdf 文件。

修复: 改为固定命名 'original.<ext>'，彻底绕开编码问题。
"""

import io
import os
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock


def _make_minimal_pdf() -> bytes:
    """返回一个最小的合法单页 PDF（不依赖任何外部库）"""
    return b"""%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
190
%%EOF"""


def _post_renovation(client, filename: str, pdf_bytes: bytes):
    """向 /api/projects/renovation 发送文件上传请求"""
    return client.post(
        '/api/projects/renovation',
        data={
            'file': (io.BytesIO(pdf_bytes), filename, 'application/pdf'),
        },
        content_type='multipart/form-data',
    )


@pytest.fixture(autouse=True)
def mock_heavy_deps():
    """Mock 掉 AI、任务队列和 PDF 渲染，让文件保存逻辑正常运行"""
    mock_ai = MagicMock()
    mock_ai.extract_page_content.return_value = {
        'title': 'Test', 'points': [], 'description': ''
    }

    # fitz 在 controller 内部 `import fitz`，需要 patch 全局模块
    mock_fitz = MagicMock()
    mock_doc = MagicMock()
    first_page = MagicMock()
    first_page.rect.width = 792
    first_page.rect.height = 612
    mock_doc.__len__ = MagicMock(return_value=1)
    mock_doc.__iter__ = MagicMock(return_value=iter([first_page]))
    mock_doc.__getitem__ = MagicMock(return_value=first_page)
    mock_doc.close = MagicMock()
    mock_fitz.open.return_value = mock_doc
    mock_fitz.Matrix.return_value = MagicMock()

    pix = MagicMock()
    first_page.get_pixmap.return_value = pix

    from PIL import Image as PILImage

    def fake_pix_save(path):
        img = PILImage.new('RGB', (1, 1), color='white')
        img.save(path, 'PNG')

    pix.save.side_effect = fake_pix_save

    with (
        patch('controllers.project_controller.get_ai_service', return_value=mock_ai),
        patch('controllers.project_controller.task_manager') as mock_tm,
        patch('controllers.project_controller.subprocess.run'),   # 跳过 LibreOffice
        patch('services.file_parser_service.FileParserService', return_value=MagicMock()),
        patch.dict('sys.modules', {
            'fitz': mock_fitz,                                      # fitz 内联 import
        }),
    ):
        mock_tm.submit_task = MagicMock()
        yield mock_tm


class TestRenovationFilename:
    """验证上传文件名规范化及后台任务 PDF 发现逻辑"""

    def test_chinese_filename_saved_as_original_pdf(self, client, app):
        """中文文件名应被存为 original.pdf，而不是无扩展名的 'pdf'"""
        pdf_bytes = _make_minimal_pdf()
        response = _post_renovation(client, '演示文稿.pdf', pdf_bytes)

        assert response.status_code == 202, (
            f"Expected 202, got {response.status_code}: {response.get_json()}"
        )

        data = response.get_json()
        project_id = data['data']['project_id']

        upload_folder = app.config['UPLOAD_FOLDER']
        template_dir = Path(upload_folder) / project_id / 'template'

        # 文件必须以 .pdf 扩展名存在
        pdf_files = list(template_dir.glob('*.pdf'))
        assert pdf_files, (
            f"No .pdf file found in {template_dir}. "
            f"Files present: {list(template_dir.iterdir())}"
        )

        # 验证就是固定名 original.pdf
        assert pdf_files[0].name == 'original.pdf', (
            f"Expected 'original.pdf', got '{pdf_files[0].name}'"
        )

    def test_task_manager_can_discover_pdf(self, client, app):
        """模拟任务管理器的文件发现逻辑，确认能找到正确的 PDF"""
        pdf_bytes = _make_minimal_pdf()
        response = _post_renovation(client, '报告材料.pdf', pdf_bytes)
        assert response.status_code == 202

        data = response.get_json()
        project_id = data['data']['project_id']

        upload_folder = app.config['UPLOAD_FOLDER']
        project_dir = Path(upload_folder) / project_id
        template_dir = project_dir / 'template'

        # 复现 task_manager.py 中的文件发现逻辑
        pdf_path = None
        for f in template_dir.iterdir() if template_dir.exists() else []:
            if f.suffix.lower() == '.pdf':
                pdf_path = str(f)
                break

        assert pdf_path is not None, (
            "task_manager 的 PDF 发现逻辑找不到文件 — "
            f"template/ 中的文件: {list(template_dir.iterdir())}"
        )

    def test_ascii_filename_also_works(self, client, app):
        """ASCII 文件名在修复后仍应正常工作"""
        pdf_bytes = _make_minimal_pdf()
        response = _post_renovation(client, 'presentation.pdf', pdf_bytes)
        assert response.status_code == 202

        data = response.get_json()
        project_id = data['data']['project_id']

        upload_folder = app.config['UPLOAD_FOLDER']
        template_dir = Path(upload_folder) / project_id / 'template'

        pdf_files = list(template_dir.glob('*.pdf'))
        assert pdf_files, "ASCII 文件名的翻新项目也应有 .pdf 文件"
        assert pdf_files[0].name == 'original.pdf'
