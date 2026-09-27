"""A message submitted through the public website's problem report form."""
from datetime import datetime

from . import db


class Feedback(db.Model):
    __tablename__ = 'feedback'

    id = db.Column(db.Integer, primary_key=True)
    message = db.Column(db.Text, nullable=False)
    reply_email = db.Column(db.String(254), nullable=True)
    page_path = db.Column(db.String(300), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            'id': self.id,
            'message': self.message,
            'reply_email': self.reply_email,
            'page_path': self.page_path,
            'created_at': self.created_at.isoformat() + 'Z',
        }
