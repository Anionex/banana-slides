"""
Task model for tracking async operations
"""
import uuid
import json
from datetime import datetime
from . import db


class Task(db.Model):
    """
    Task model - tracks asynchronous generation tasks
    """
    __tablename__ = 'tasks'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = db.Column(db.String(36), db.ForeignKey('projects.id'), nullable=True)
    task_type = db.Column(db.String(50), nullable=False)  # GENERATE_DESCRIPTIONS|GENERATE_IMAGES
    status = db.Column(db.String(50), nullable=False, default='PENDING')
    progress = db.Column(db.Text, nullable=True)  # JSON string: {"total": 10, "completed": 5, "failed": 0}
    error_message = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    project = db.relationship('Project', back_populates='tasks')
    
    def get_progress(self):
        """Parse progress from JSON string"""
        if self.progress:
            try:
                return json.loads(self.progress)
            except json.JSONDecodeError:
                return {"total": 0, "completed": 0, "failed": 0}
        return {"total": 0, "completed": 0, "failed": 0}
    
    def set_progress(self, data):
        """Set progress as JSON string"""
        if data:
            self.progress = json.dumps(data)
        else:
            self.progress = None
    
    def update_progress(self, completed=None, failed=None):
        """Update progress incrementally"""
        prog = self.get_progress()
        if completed is not None:
            prog['completed'] = completed
        if failed is not None:
            prog['failed'] = failed
        self.set_progress(prog)
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'task_id': self.id,
            'task_type': self.task_type,
            'status': self.status,
            'progress': self.get_progress(),
            'error_message': self.error_message,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
        }
    
    def __repr__(self):
        return f'<Task {self.id}: {self.task_type} - {self.status}>'
