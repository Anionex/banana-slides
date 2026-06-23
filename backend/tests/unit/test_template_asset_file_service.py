"""Unit tests for the new FileService methods used by per-page templates.

Covers:
- save_template_asset: writes original + thumb under template-assets/<asset_id>/
- save_template_asset_from_path: copies an existing local file (PDF-split path)
- delete_template_asset: removes the asset directory
- save_template_pdf: validates PDF magic header and writes <task_id>.pdf
- cleanup_template_pdf_temp: clears the per-task scratch dir but keeps the PDF
"""
import io
import os
import uuid
from pathlib import Path

import pytest
from PIL import Image


def _png_bytes(size=(64, 48), color=(120, 200, 80)) -> bytes:
    buf = io.BytesIO()
    Image.new('RGB', size, color).save(buf, format='PNG')
    return buf.getvalue()


class _FakeUpload:
    """Minimal werkzeug FileStorage stand-in."""
    def __init__(self, filename: str, data: bytes):
        self.filename = filename
        self._data = data

    def save(self, dest: str) -> None:
        with open(dest, 'wb') as f:
            f.write(self._data)


@pytest.fixture
def file_service(tmp_path):
    from services.file_service import FileService
    return FileService(str(tmp_path))


@pytest.fixture
def project_id():
    return str(uuid.uuid4())


def test_save_template_asset_writes_original_and_thumb(file_service, project_id):
    asset_id = str(uuid.uuid4())
    upload = _FakeUpload('cover.png', _png_bytes())

    image_path, thumb_path = file_service.save_template_asset(upload, project_id, asset_id)

    base = Path(file_service.upload_folder) / project_id / 'template-assets' / asset_id
    assert (base / 'original.png').exists()
    assert (base / 'thumb.jpg').exists()
    assert image_path.endswith(f'{project_id}/template-assets/{asset_id}/original.png')
    assert thumb_path.endswith(f'{project_id}/template-assets/{asset_id}/thumb.jpg')

    with Image.open(base / 'thumb.jpg') as thumb:
        assert thumb.format == 'JPEG'


def test_save_template_asset_normalises_jpeg_extension(file_service, project_id):
    asset_id = str(uuid.uuid4())
    buf = io.BytesIO()
    Image.new('RGB', (10, 10), (255, 0, 0)).save(buf, format='JPEG')
    upload = _FakeUpload('photo.JPEG', buf.getvalue())

    image_path, _ = file_service.save_template_asset(upload, project_id, asset_id)
    assert image_path.endswith('original.jpg')


def test_save_template_asset_rejects_invalid_image(file_service, project_id):
    asset_id = str(uuid.uuid4())
    upload = _FakeUpload('broken.png', b'not really a png')

    with pytest.raises(ValueError, match='Invalid image file'):
        file_service.save_template_asset(upload, project_id, asset_id)

    base = Path(file_service.upload_folder) / project_id / 'template-assets' / asset_id
    assert not (base / 'original.png').exists()


def test_save_template_asset_from_path_copies_and_thumbs(file_service, project_id, tmp_path):
    asset_id = str(uuid.uuid4())
    src = tmp_path / 'page_3.png'
    src.write_bytes(_png_bytes())

    image_path, thumb_path = file_service.save_template_asset_from_path(
        str(src), project_id, asset_id)

    assert image_path.endswith('original.png')
    assert thumb_path.endswith('thumb.jpg')
    base = Path(file_service.upload_folder) / project_id / 'template-assets' / asset_id
    assert (base / 'original.png').exists()
    assert (base / 'thumb.jpg').exists()


def test_save_template_asset_from_path_missing_source_raises(file_service, project_id):
    asset_id = str(uuid.uuid4())
    with pytest.raises(ValueError, match='does not exist'):
        file_service.save_template_asset_from_path('/no/such/file.png', project_id, asset_id)


def test_delete_template_asset_removes_directory(file_service, project_id):
    asset_id = str(uuid.uuid4())
    upload = _FakeUpload('cover.png', _png_bytes())
    file_service.save_template_asset(upload, project_id, asset_id)

    base = Path(file_service.upload_folder) / project_id / 'template-assets' / asset_id
    assert base.exists()

    file_service.delete_template_asset(project_id, asset_id)
    assert not base.exists()


def test_delete_template_asset_is_noop_for_unknown(file_service, project_id):
    file_service.delete_template_asset(project_id, 'does-not-exist')  # must not raise


def test_save_template_pdf_writes_file(file_service, project_id):
    task_id = str(uuid.uuid4())
    pdf_bytes = b'%PDF-1.4\n%minimal placeholder\n%%EOF'
    upload = _FakeUpload('Style guide.pdf', pdf_bytes)

    rel = file_service.save_template_pdf(upload, project_id, task_id)
    assert rel.endswith(f'{project_id}/template-pdf/{task_id}.pdf')

    full = Path(file_service.upload_folder) / rel
    assert full.exists()
    assert full.read_bytes() == pdf_bytes


def test_save_template_pdf_rejects_non_pdf_magic(file_service, project_id):
    task_id = str(uuid.uuid4())
    upload = _FakeUpload('fake.pdf', b'this is plain text, not a PDF')

    with pytest.raises(ValueError, match='not a valid PDF'):
        file_service.save_template_pdf(upload, project_id, task_id)

    expected = Path(file_service.upload_folder) / project_id / 'template-pdf' / f'{task_id}.pdf'
    assert not expected.exists()


def test_save_template_pdf_rejects_wrong_extension(file_service, project_id):
    task_id = str(uuid.uuid4())
    upload = _FakeUpload('not-a-pdf.txt', b'%PDF-1.4 hi')

    with pytest.raises(ValueError, match='\\.pdf extension'):
        file_service.save_template_pdf(upload, project_id, task_id)


def test_cleanup_template_pdf_temp_removes_only_task_dir(file_service, project_id):
    task_id = str(uuid.uuid4())
    pdf_dir = Path(file_service._get_template_pdf_dir(project_id))
    pdf_path = pdf_dir / f'{task_id}.pdf'
    pdf_path.write_bytes(b'%PDF-1.4 hi')

    task_dir = file_service.get_template_pdf_temp_dir(project_id, task_id)
    (Path(task_dir) / 'page_1.png').write_bytes(_png_bytes())
    assert (Path(task_dir) / 'page_1.png').exists()

    file_service.cleanup_template_pdf_temp(project_id, task_id)
    assert not Path(task_dir).exists()
    assert pdf_path.exists()  # original PDF must be preserved
