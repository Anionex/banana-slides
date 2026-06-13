"""
Regression coverage for PPT renovation MinerU credential failures.
"""

from pathlib import Path
from unittest.mock import MagicMock, patch

from models import Page, Project, Task, db
from services.file_parser_service import MINERU_AUTH_ERROR_MESSAGE
from services.task_manager import process_ppt_renovation_task


def test_ppt_renovation_task_surfaces_mineru_auth_error(client, app):
    """The task error shown to users should name expired/invalid MinerU credentials."""
    with app.app_context():
        project = Project(creation_type='ppt_renovation', status='PROCESSING')
        db.session.add(project)
        db.session.flush()

        page = Page(project_id=project.id, order_index=0, status='DRAFT')
        task = Task(project_id=project.id, task_type='PPT_RENOVATION', status='PENDING')
        db.session.add_all([page, task])
        db.session.commit()

        project_dir = Path(app.config['UPLOAD_FOLDER']) / project.id
        template_dir = project_dir / "template"
        split_dir = project_dir / "split_pages"
        template_dir.mkdir(parents=True, exist_ok=True)
        split_dir.mkdir(parents=True, exist_ok=True)
        (template_dir / "original.pdf").write_bytes(b"%PDF-1.4\n%%EOF")
        page_pdf = split_dir / "page_1.pdf"
        page_pdf.write_bytes(b"%PDF-1.4\n%%EOF")

        parser = MagicMock()
        parser.parse_file.return_value = (
            None,
            None,
            None,
            f"{MINERU_AUTH_ERROR_MESSAGE}MinerU 返回：token expired",
            0,
        )
        ai_service = MagicMock()

        with patch('services.task_manager.split_pdf_to_pages', return_value=[str(page_pdf)]):
            process_ppt_renovation_task(
                task.id,
                project.id,
                ai_service,
                MagicMock(),
                parser,
                max_workers=1,
                app=app,
            )

        db.session.expire_all()
        saved_task = Task.query.get(task.id)
        saved_project = Project.query.get(project.id)

        assert saved_task.status == 'FAILED'
        assert MINERU_AUTH_ERROR_MESSAGE in saved_task.error_message
        assert "token expired" in saved_task.error_message
        assert saved_project.status == 'DRAFT'
        ai_service.extract_page_content.assert_not_called()
