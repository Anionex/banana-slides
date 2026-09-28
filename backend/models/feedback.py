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
    images = db.relationship('FeedbackImage', back_populates='feedback', cascade='all, delete-orphan', lazy='selectin')

    def to_dict(self):
        return {
            'id': self.id,
            'message': self.message,
            'reply_email': self.reply_email,
            'page_path': self.page_path,
            'created_at': self.created_at.isoformat() + 'Z',
            'images': [{'id': image.id} for image in self.images],
        }


class FeedbackImage(db.Model):
    __tablename__ = 'feedback_image'

    id = db.Column(db.Integer, primary_key=True)
    feedback_id = db.Column(db.Integer, db.ForeignKey('feedback.id'), nullable=False, index=True)
    mime_type = db.Column(db.String(32), nullable=False)
    data = db.Column(db.LargeBinary, nullable=False)
    feedback = db.relationship('Feedback', back_populates='images')
