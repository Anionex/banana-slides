"""Private configuration for an anonymous public-demo visitor."""
from . import db


class PublicVisitor(db.Model):
    __tablename__ = 'public_visitors'
    token_hash = db.Column(db.String(64), primary_key=True)
    config_json = db.Column(db.Text, nullable=False, default='{}')
