"""Private PDF submissions; deliberately unrelated to the public gallery catalog."""
from datetime import datetime
from . import db


class GallerySubmission(db.Model):
    __tablename__ = 'gallery_submission'
    id = db.Column(db.String(36), primary_key=True)
    visitor_hash = db.Column(db.String(64), nullable=False, index=True)
    sha256 = db.Column(db.String(64), nullable=False)
    filename = db.Column(db.String(240), nullable=False)
    page_count = db.Column(db.Integer, nullable=False)
    byte_size = db.Column(db.Integer, nullable=False)
    metadata_json = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    __table_args__ = (db.UniqueConstraint('visitor_hash', 'sha256', name='uq_submission_visitor_pdf'),)

    def to_dict(self):
        import json
        return dict(id=self.id, filename=self.filename, page_count=self.page_count,
                    byte_size=self.byte_size, metadata=json.loads(self.metadata_json),
                    created_at=self.created_at.isoformat() + 'Z')
