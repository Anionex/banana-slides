"""Email address submitted for the hosted beta invitation list."""
from datetime import datetime, timezone

from . import db


class WaitlistSignup(db.Model):
    __tablename__ = 'waitlist_signups'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(254), nullable=False, unique=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False,
                           default=lambda: datetime.now(timezone.utc))
