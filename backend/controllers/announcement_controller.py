"""Announcement controller - admin CRUD + public list"""
import logging
from flask import Blueprint, request
from middlewares.auth import auth_required, admin_required
from models import db, Announcement
from utils.response import success_response, error_response

logger = logging.getLogger(__name__)

announcement_bp = Blueprint('announcement', __name__, url_prefix='/api/announcements')


@announcement_bp.route('', methods=['GET'])
@auth_required
def list_active():
    """Public: list active announcements (newest first)."""
    items = Announcement.query.filter_by(is_active=True) \
        .order_by(Announcement.created_at.desc()).all()
    return success_response([a.to_dict() for a in items])


@announcement_bp.route('/all', methods=['GET'])
@auth_required
@admin_required
def list_all():
    """Admin: list all announcements with pagination."""
    limit = min(request.args.get('limit', 50, type=int), 200)
    offset = max(request.args.get('offset', 0, type=int), 0)

    query = Announcement.query.order_by(Announcement.created_at.desc())
    total = query.count()
    items = query.offset(offset).limit(limit).all()
    return success_response({
        'items': [a.to_dict() for a in items],
        'total': total,
    })


@announcement_bp.route('', methods=['POST'])
@auth_required
@admin_required
def create():
    """Admin: create announcement."""
    body = request.get_json(silent=True) or {}
    title = (body.get('title') or '').strip()
    content = (body.get('content') or '').strip()
    if not title or not content:
        return error_response('INVALID_REQUEST', 'title and content are required')

    ann = Announcement(title=title, content=content,
                       is_active=body.get('is_active', True))
    db.session.add(ann)
    db.session.commit()
    return success_response(ann.to_dict(), status_code=201)


@announcement_bp.route('/<ann_id>', methods=['PUT'])
@auth_required
@admin_required
def update(ann_id):
    """Admin: update announcement."""
    ann = Announcement.query.get(ann_id)
    if not ann:
        return error_response('NOT_FOUND', 'Announcement not found', 404)

    body = request.get_json(silent=True) or {}
    if 'title' in body:
        ann.title = (body['title'] or '').strip()
    if 'content' in body:
        ann.content = (body['content'] or '').strip()
    if 'is_active' in body:
        ann.is_active = bool(body['is_active'])

    if not ann.title or not ann.content:
        return error_response('INVALID_REQUEST', 'title and content cannot be empty')

    db.session.commit()
    return success_response(ann.to_dict())


@announcement_bp.route('/<ann_id>', methods=['DELETE'])
@auth_required
@admin_required
def delete(ann_id):
    """Admin: delete announcement."""
    ann = Announcement.query.get(ann_id)
    if not ann:
        return error_response('NOT_FOUND', 'Announcement not found', 404)
    db.session.delete(ann)
    db.session.commit()
    return success_response(message='Deleted')
