"""Receive exported PDFs privately. No approval state or publishing endpoint."""
import hashlib
import hmac
import io
import json
import re
import uuid
from datetime import datetime, timedelta
from pathlib import Path

import fitz
from flask import g, make_response, request, send_file
from sqlalchemy.exc import SQLAlchemyError
from models import db, GallerySubmission
from utils import error_response, success_response

MAX_PDF_BYTES = 50 * 1024 * 1024
MAX_PAGES = 500


def inspect_export(content):
    if not content.startswith(b'%PDF-'):
        raise ValueError('INVALID_PDF')
    try:
        with fitz.open(stream=content, filetype='pdf') as doc:
            if doc.needs_pass or doc.is_repaired or not 1 <= doc.page_count <= MAX_PAGES:
                raise ValueError('INVALID_PDF')
            metadata = {key: (doc.metadata.get(key) or '').strip() for key in ('author', 'creator', 'producer')}
            if any(value != 'banana-slides' for value in metadata.values()):
                raise ValueError('NOT_BANANA_EXPORT')
            for page in doc:
                if page.rect.is_empty or page.rect.is_infinite:
                    raise ValueError('INVALID_PDF')
            return doc.page_count, metadata
    except (RuntimeError, fitz.FileDataError) as error:
        raise ValueError('INVALID_PDF') from error


def install(app):
    from services.public_demo import enabled

    def directory():
        # Instance storage is persistent and is never served by /files or nginx.
        return Path(app.instance_path) / 'gallery-submissions'

    def admin_error():
        password = dict.get(app.config, 'PUBLIC_DEMO_ADMIN_PASSWORD', '')
        if not enabled() or not password:
            return error_response('NOT_FOUND', '入口未启用。', 404)
        data = request.get_json(silent=True)
        supplied = data.get('password') if isinstance(data, dict) else None
        if not isinstance(supplied, str) or not hmac.compare_digest(supplied.encode(), password.encode()):
            return error_response('UNAUTHORIZED', '管理员口令错误。', 401)

    def private(response):
        response = make_response(response)
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        return response

    @app.post('/api/gallery/submissions')
    def submit():
        if not enabled():
            return error_response('NOT_FOUND', '入口未启用。', 404)
        request.max_content_length = MAX_PDF_BYTES + 64 * 1024
        if request.content_length and request.content_length > request.max_content_length:
            return error_response('PDF_TOO_LARGE', 'PDF 不能超过 50 MB。', 413)
        files = request.files.getlist('file')
        if len(files) != 1 or len(request.files) != 1:
            return error_response('INVALID_PDF', '请选择一份完整 PDF。', 400)
        content = files[0].stream.read(MAX_PDF_BYTES + 1)
        if len(content) > MAX_PDF_BYTES:
            return error_response('PDF_TOO_LARGE', 'PDF 不能超过 50 MB。', 413)
        digest = hashlib.sha256(content).hexdigest()
        visitor = g.public_visitor['token']
        existing = GallerySubmission.query.filter_by(visitor_hash=visitor, sha256=digest).first()
        if existing:
            return private(success_response({'received': True, 'id': existing.id, 'page_count': existing.page_count}))
        since = datetime.utcnow() - timedelta(seconds=60)
        recent = GallerySubmission.query.filter(GallerySubmission.created_at >= since)
        if recent.filter_by(visitor_hash=visitor).count() or recent.count() >= 20:
            return error_response('SUBMISSION_RATE_LIMIT', '提交太频繁，请稍后重试。', 429)
        try:
            page_count, metadata = inspect_export(content)
        except ValueError as error:
            code = str(error)
            if code != 'NOT_BANANA_EXPORT':
                code = 'INVALID_PDF'
            return error_response(code, '请上传从 Banana Slides 直接导出的完整、未加密 PDF（最多 500 页）。', 400)
        filename = re.sub(r'[\x00-\x1f\x7f/\\]', '_', files[0].filename or 'presentation.pdf')[:236]
        if not filename.lower().endswith('.pdf'):
            filename += '.pdf'
        row = GallerySubmission(id=str(uuid.uuid4()), visitor_hash=visitor, sha256=digest,
                                filename=filename, page_count=page_count, byte_size=len(content),
                                metadata_json=json.dumps(metadata))
        path = directory() / f'{row.id}.pdf'
        try:
            directory().mkdir(parents=True, exist_ok=True, mode=0o700)
            with path.open('xb') as file:
                file.write(content)
            path.chmod(0o600)
            db.session.add(row)
            db.session.commit()
        except (OSError, SQLAlchemyError):
            db.session.rollback()
            path.unlink(missing_ok=True)
            existing = GallerySubmission.query.filter_by(visitor_hash=visitor, sha256=digest).first()
            if existing:
                return private(success_response({'received': True, 'id': existing.id, 'page_count': existing.page_count}))
            return error_response('SUBMISSION_UNAVAILABLE', '暂时无法保存，请稍后重试。', 503)
        return private(success_response({'received': True, 'id': row.id, 'page_count': page_count}))

    @app.post('/api/admin/gallery-submissions')
    def listing():
        error = admin_error()
        if error is not None:
            return error
        limit = min(max(request.args.get('limit', 20, type=int), 1), 100)
        offset = max(request.args.get('offset', 0, type=int), 0)
        rows = GallerySubmission.query.order_by(GallerySubmission.created_at.desc(), GallerySubmission.id.desc()).offset(offset).limit(limit).all()
        return private(success_response({'items': [row.to_dict() for row in rows], 'total': GallerySubmission.query.count()}))

    @app.post('/api/admin/gallery-submissions/<uuid:submission_id>/<action>')
    def file(submission_id, action):
        error = admin_error()
        if error is not None:
            return error
        row = db.session.get(GallerySubmission, str(submission_id))
        if not row or action not in ('pdf', 'preview'):
            return error_response('NOT_FOUND', '作品不存在。', 404)
        path = directory() / f'{row.id}.pdf'
        if not path.is_file():
            return error_response('NOT_FOUND', '文件暂时不可用。', 404)
        if action == 'pdf':
            return private(send_file(path, mimetype='application/pdf', as_attachment=True, download_name=row.filename))
        page = request.args.get('page', 1, type=int)
        if not 1 <= page <= row.page_count:
            return error_response('INVALID_PAGE', '页码无效。', 400)
        try:
            with fitz.open(path) as pdf:
                sheet = pdf[page - 1]
                scale = min(1200 / max(sheet.rect.width, sheet.rect.height), 2)
                image = sheet.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False).tobytes('png')
            return private(send_file(io.BytesIO(image), mimetype='image/png'))
        except (RuntimeError, ValueError):
            return error_response('PREVIEW_UNAVAILABLE', '预览暂时不可用，请下载 PDF 查看。', 422)
