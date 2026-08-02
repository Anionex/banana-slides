"""
ProjectTemplateAsset model - per-project template image library.
"""
import uuid
from datetime import datetime
from pathlib import Path
from . import db


class ProjectTemplateAsset(db.Model):
    """Template asset belonging to a project."""

    __tablename__ = 'project_template_assets'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = db.Column(
        db.String(36),
        db.ForeignKey('projects.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    image_path = db.Column(db.String(500), nullable=False)
    thumb_path = db.Column(db.String(500), nullable=True)
    file_size = db.Column(db.Integer, nullable=True)
    source = db.Column(db.String(20), nullable=False, default='upload')
    source_pdf_id = db.Column(db.String(36), nullable=True)
    source_page_index = db.Column(db.Integer, nullable=True)

    analysis_status = db.Column(db.String(20), nullable=False, default='pending')
    analysis_json = db.Column(db.Text, nullable=True)
    analysis_notes = db.Column(db.Text, nullable=True)
    analysis_error = db.Column(db.Text, nullable=True)
    user_label = db.Column(db.String(200), nullable=True)
    user_edited_analysis = db.Column(db.Boolean, nullable=False, default=False)

    sort_order = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    project = db.relationship('Project', back_populates='template_assets')
    pages_referenced = db.relationship(
        'Page',
        back_populates='template_asset',
        foreign_keys='Page.template_asset_id',
    )

    def get_image_url(self) -> str:
        filename = Path(self.image_path).name if self.image_path else None
        if not filename:
            return None
        return f'/files/{self.project_id}/template-assets/{self.id}/{filename}'

    def get_thumb_url(self) -> str:
        if not self.thumb_path:
            return None
        filename = Path(self.thumb_path).name
        return f'/files/{self.project_id}/template-assets/{self.id}/{filename}'

    def get_analysis(self) -> dict:
        if not self.analysis_json:
            return None
        import json
        try:
            return json.loads(self.analysis_json)
        except json.JSONDecodeError:
            return None

    def set_analysis(self, data) -> None:
        if data is None:
            self.analysis_json = None
            return
        import json
        self.analysis_json = json.dumps(data, ensure_ascii=False)

    def to_dict(self, include_referenced_pages: bool = True) -> dict:
        data = {
            'id': self.id,
            'project_id': self.project_id,
            'image_url': self.get_image_url(),
            'thumb_url': self.get_thumb_url(),
            'file_size': self.file_size,
            'source': self.source,
            'source_pdf_id': self.source_pdf_id,
            'source_page_index': self.source_page_index,
            'analysis_status': self.analysis_status,
            'analysis_json': self.get_analysis(),
            'analysis_notes': self.analysis_notes,
            'analysis_error': self.analysis_error,
            'user_label': self.user_label,
            'user_edited_analysis': bool(self.user_edited_analysis),
            'sort_order': self.sort_order,
            'created_at': self.created_at.isoformat() + 'Z' if self.created_at else None,
            'updated_at': self.updated_at.isoformat() + 'Z' if self.updated_at else None,
        }
        if include_referenced_pages:
            data['referenced_page_ids'] = [p.id for p in self.pages_referenced]
        return data

    def __repr__(self):
        return f'<ProjectTemplateAsset {self.id} project={self.project_id} status={self.analysis_status}>'
