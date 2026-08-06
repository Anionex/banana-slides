"""Durable, secret-free receipt for platform-owned submissions."""
from datetime import datetime

from . import db


class PlatformSubmissionReceipt(db.Model):
    __tablename__ = 'platform_submission_receipts'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    platform_project_id = db.Column(db.BigInteger, nullable=False, index=True)
    platform_job_id = db.Column(db.BigInteger, nullable=True, index=True)
    external_project_id = db.Column(db.String(36), nullable=True, index=True)
    operation = db.Column(db.String(64), nullable=False)
    idempotency_key = db.Column(db.String(191), nullable=False, unique=True)
    request_hash = db.Column(db.String(64), nullable=False)
    current_task_id = db.Column(db.String(36), nullable=True, index=True)
    attempt_no = db.Column(db.Integer, nullable=False, default=1)
    status = db.Column(db.String(32), nullable=False, default='PENDING')
    error_code = db.Column(db.String(64), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
