"""Durable request/lineage for one editable export attempt. Task owns status."""
from . import db


class ExportRun(db.Model):
    __tablename__ = 'export_runs'
    task = db.relationship('Task', back_populates='export_run')

    task_id = db.Column(db.String(36), db.ForeignKey('tasks.id', ondelete='CASCADE'), primary_key=True)
    project_id = db.Column(db.String(36), db.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False, index=True)
    parent_task_id = db.Column(db.String(36), nullable=True, unique=True)
    request_json = db.Column(db.Text, nullable=False)
    request_hash = db.Column(db.String(64), nullable=False)
    artifact_filename = db.Column(db.String(255), nullable=False, unique=True)
    artifact_sha256 = db.Column(db.String(64), nullable=True)
    queue_deadline_at = db.Column(db.Float, nullable=False)
