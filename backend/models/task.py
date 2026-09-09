"""
Task model for tracking async operations
"""
import uuid
import json
from datetime import datetime
from sqlalchemy.orm import validates
from . import db


class Task(db.Model):
    """
    Task model - tracks asynchronous generation tasks
    """
    __tablename__ = 'tasks'

    # 任务被看门狗判定失败后，这些进度键不允许被后续的进度写入覆盖，
    # 否则前端会丢掉失败原因（见 services/task_watchdog.py）
    WATCHDOG_PROGRESS_KEYS = (
        'error_code',
        'error_stage',
        'error_details',
        'help_text',
        'backend_status',
    )
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = db.Column(db.String(36), db.ForeignKey('projects.id'), nullable=False)
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
        """Set progress as JSON string, stamping the last-activity time.

        ``heartbeat_at`` 是"任务最后一次写进度"的时间，看门狗用它判断
        任务是否还在推进（进程重启后也能从数据库读到）。
        """
        if not data:
            existing = self.get_progress() or {}
            if existing.get('error_stage') == 'task_watchdog':
                # 不能用空进度覆盖看门狗写入的失败诊断
                # （例如设置页测试失败时会 set_progress({})）
                return
            self.progress = None
            return

        payload = dict(data)
        payload['heartbeat_at'] = datetime.utcnow().isoformat()

        if self.status == 'FAILED':
            previous = self.get_progress()
            for key in self.WATCHDOG_PROGRESS_KEYS:
                if key in previous and key not in payload:
                    payload[key] = previous[key]

        self.progress = json.dumps(payload)
    
    def update_progress(self, completed=None, failed=None):
        """Update progress incrementally"""
        prog = self.get_progress()
        if completed is not None:
            prog['completed'] = completed
        if failed is not None:
            prog['failed'] = failed
        self.set_progress(prog)

    @validates('status')
    def _keep_watchdog_failure_terminal(self, key, value):
        """看门狗判定的失败是终态，不允许 worker 之后把它改回成功。

        后台任务无法被真正取消：被判"卡住"的 worker 可能稍后恢复并跑完。
        此时用户已经看到失败提示（前端已停止轮询），状态若静默变回
        COMPLETED 会造成误解与重复执行，因此这里保持 FAILED，
        但产物信息（download_url 等）仍由 set_progress 写入。
        """
        if value != 'FAILED' and self.status == 'FAILED':
            progress = self.get_progress() or {}
            if progress.get('error_stage') == 'task_watchdog':
                return 'FAILED'
        return value
    
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

