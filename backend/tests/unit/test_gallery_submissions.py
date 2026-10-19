import io
from pathlib import Path

import fitz
import pytest
from flask import Flask
from models import db, GallerySubmission
from services.public_demo import install, PublicConfig
from services.gallery_submissions import inspect_export

A = {'X-User-Token': 'gallery-visitor-00000000000000001'}
B = {'X-User-Token': 'gallery-visitor-00000000000000002'}


@pytest.fixture
def site(tmp_path):
    app = Flask(__name__, instance_path=str(tmp_path / 'instance'))
    app.config = PublicConfig(app.root_path, dict(app.config))
    app.config.update(TESTING=True, PUBLIC_DEMO=True, PUBLIC_DEMO_ADMIN_PASSWORD='test-admin',
                      SQLALCHEMY_DATABASE_URI='sqlite:///' + str(tmp_path / 'test.db'))
    db.init_app(app)
    install(app)
    with app.app_context():
        db.create_all()
    return app


def pdf(marked=True, encrypted=False):
    with fitz.open() as doc:
        for label in ('Cover', 'Content', 'Closing'):
            doc.new_page(width=960, height=540).insert_text((50, 60), label)
        if marked:
            doc.set_metadata(dict(author='banana-slides', creator='banana-slides', producer='banana-slides'))
        return doc.tobytes(encryption=fitz.PDF_ENCRYPT_AES_256, owner_pw='owner', user_pw='user') if encrypted else doc.tobytes()


def upload(client, content, headers=A):
    return client.post('/api/gallery/submissions', headers=headers, data={'file': (io.BytesIO(content), '我的完整作品.pdf')})


def test_valid_submission_private_preview_download_and_retry(site):
    client = site.test_client()
    content = pdf()
    assert upload(client, content, {}).status_code == 401
    response = upload(client, content)
    assert response.status_code == 200
    receipt = response.json['data']
    assert receipt['page_count'] == 3
    assert upload(client, content).json['data']['id'] == receipt['id']
    assert client.post('/api/admin/gallery-submissions', headers=A, json={'password': 'wrong'}).status_code == 401
    listing = client.post('/api/admin/gallery-submissions', headers=B, json={'password': 'test-admin'})
    assert listing.headers['Cache-Control'] == 'no-store'
    assert listing.json['data']['total'] == 1
    item = listing.json['data']['items'][0]
    assert item['filename'] == '我的完整作品.pdf'
    assert 'visitor_hash' not in item and 'sha256' not in item
    base = f"/api/admin/gallery-submissions/{receipt['id']}"
    for action in ('pdf', 'preview'):
        assert client.post(f'{base}/{action}', headers=A, json={'password': 'wrong'}).status_code == 401
        assert client.get(f'{base}/{action}', headers=A).status_code == 405
    download = client.post(f'{base}/pdf', headers=B, json={'password': 'test-admin'})
    assert download.data == content
    assert download.headers['Content-Disposition'].startswith('attachment;')
    preview = client.post(f'{base}/preview?page=2', headers=B, json={'password': 'test-admin'})
    assert preview.data.startswith(b'\x89PNG') and preview.headers['Cache-Control'] == 'no-store'
    assert client.post(f'{base}/preview?page=4', headers=B, json={'password': 'test-admin'}).status_code == 400
    with site.app_context():
        assert GallerySubmission.query.count() == 1
    assert len(list((Path(site.instance_path) / 'gallery-submissions').glob('*.pdf'))) == 1
    assert client.post('/api/admin/gallery-submissions?offset=1', headers=A, json={'password': 'test-admin'}).json['data']['items'] == []


@pytest.mark.parametrize('content,code', [(b'not pdf', 'INVALID_PDF'), (pdf(False), 'NOT_BANANA_EXPORT'), (pdf(encrypted=True), 'INVALID_PDF'), (b'%PDF-1.7\ntruncated', 'INVALID_PDF')])
def test_rejects_unsupported_pdf_without_persisting(site, content, code):
    response = upload(site.test_client(), content)
    assert response.status_code == 400 and response.json['error']['code'] == code
    with site.app_context():
        assert GallerySubmission.query.count() == 0
    assert not (Path(site.instance_path) / 'gallery-submissions').exists()


def test_file_limit_and_rate_limit(site, monkeypatch):
    from services import gallery_submissions
    monkeypatch.setattr(gallery_submissions, 'MAX_PDF_BYTES', 10)
    assert upload(site.test_client(), pdf()).status_code == 413
    monkeypatch.setattr(gallery_submissions, 'MAX_PDF_BYTES', 50 * 1024 * 1024)
    client = site.test_client()
    assert upload(client, pdf()).status_code == 200
    assert upload(client, pdf() + b'\n').status_code == 429
    assert upload(client, pdf(), B).status_code == 200


def test_uses_actual_export_metadata():
    from services.export_service import ExportService
    content = ExportService._add_pdf_metadata(pdf(False))
    assert inspect_export(content) == (3, {'author': 'banana-slides', 'creator': 'banana-slides', 'producer': 'banana-slides'})


def test_disabled_in_non_public_app(site):
    site.config['PUBLIC_DEMO'] = False
    assert upload(site.test_client(), pdf()).status_code == 404
    assert site.test_client().post('/api/admin/gallery-submissions', json={'password': 'test-admin'}).status_code == 404
