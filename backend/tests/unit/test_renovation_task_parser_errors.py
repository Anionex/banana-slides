from pathlib import Path
from unittest.mock import MagicMock, patch

from models import Page, Project, Task, db
from services.task_manager import process_ppt_renovation_task


def test_renovation_marks_mineru_parser_credential_error_as_failed(app):
    """A MinerU 401 must reach the task API instead of becoming a blank success."""
    with app.app_context():
        project = Project(creation_type='ppt_renovation', status='PROCESSING')
        db.session.add(project)
        db.session.flush()

        page = Page(project_id=project.id, order_index=0, status='DRAFT')
        db.session.add(page)
        task = Task(project_id=project.id, task_type='PPT_RENOVATION', status='PENDING')
        db.session.add(task)
        db.session.commit()

        template_dir = Path(app.config['UPLOAD_FOLDER']) / project.id / 'template'
        template_dir.mkdir(parents=True)
        pdf_path = template_dir / 'original.pdf'
        pdf_path.write_bytes(b'%PDF-1.4')

        parser = MagicMock()
        parser.parse_file.return_value = (
            None,
            None,
            None,
            'MinerU API returned 401 Unauthorized: token expired',
            0,
        )

        with patch('services.task_manager.split_pdf_to_pages', return_value=['/tmp/page-1.pdf']):
            process_ppt_renovation_task(
                task.id,
                project.id,
                MagicMock(),
                MagicMock(),
                parser,
                app=app,
            )

        db.session.expire_all()
        failed_task = db.session.get(Task, task.id)
        assert failed_task.status == 'FAILED'
        assert failed_task.error_message is not None
        assert 'MinerU parsing failed' in failed_task.error_message
        assert '401 Unauthorized' in failed_task.error_message
