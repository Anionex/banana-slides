"""Test _smart_merge_pages logic with a minimal Flask app (no flask_migrate)."""
import json
import os
import sys
import tempfile
import pytest

# Ensure backend is on path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
os.environ.setdefault('TESTING', 'true')
os.environ.setdefault('GOOGLE_API_KEY', 'mock')


@pytest.fixture(scope='module')
def merge_app():
    """Minimal Flask app for testing _smart_merge_pages."""
    from flask import Flask
    from models import db, Page, Project

    app = Flask(__name__)
    tmp = tempfile.mkdtemp()
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{tmp}/test.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)
    with app.app_context():
        db.create_all()
    yield app
    import shutil
    shutil.rmtree(tmp, ignore_errors=True)


@pytest.fixture
def ctx(merge_app):
    with merge_app.app_context():
        from models import db
        yield
        db.session.rollback()
        for t in reversed(db.metadata.sorted_tables):
            db.session.execute(t.delete())
        db.session.commit()


def _make_project(pid='test-proj'):
    from models import db, Project
    p = Project(id=pid, creation_type='idea', idea_prompt='test')
    db.session.add(p)
    db.session.commit()
    return pid


def _make_page(project_id, title, order, desc=None, image_path=None, status='DRAFT'):
    from models import db, Page
    page = Page(project_id=project_id, order_index=order, status=status)
    page.set_outline_content({'title': title, 'points': ['p1']})
    if desc:
        page.set_description_content({'text': desc})
    if image_path:
        page.generated_image_path = image_path
    db.session.add(page)
    db.session.commit()
    return page


class TestSmartMergePages:

    def test_preserves_description_on_title_match(self, ctx):
        from controllers.project_controller import _smart_merge_pages
        from models import db

        pid = _make_project()
        old = _make_page(pid, 'Page A', 0, desc='desc A')

        result = _smart_merge_pages(pid, [
            {'title': 'Page A', 'points': ['new point']},
            {'title': 'Page B', 'points': ['b1']},
        ])
        db.session.flush()

        assert len(result) == 2
        assert result[0].id == old.id  # same record
        assert result[0].get_description_content()['text'] == 'desc A'
        assert result[0].get_outline_content()['points'] == ['new point']
        assert result[1].get_description_content() is None

    def test_preserves_image_path_on_title_match(self, ctx):
        from controllers.project_controller import _smart_merge_pages
        from models import db

        pid = _make_project()
        old = _make_page(pid, 'Img Page', 0, image_path='/img/test.png', status='IMAGE_GENERATED')

        result = _smart_merge_pages(pid, [
            {'title': 'Img Page', 'points': ['updated']},
        ])
        db.session.flush()

        assert result[0].id == old.id
        assert result[0].generated_image_path == '/img/test.png'
        assert result[0].status == 'IMAGE_GENERATED'

    def test_deletes_unmatched_old_pages(self, ctx):
        from controllers.project_controller import _smart_merge_pages
        from models import db, Page

        pid = _make_project()
        _make_page(pid, 'Keep', 0)
        removed = _make_page(pid, 'Remove', 1)

        result = _smart_merge_pages(pid, [
            {'title': 'Keep', 'points': []},
        ])
        db.session.flush()

        assert len(result) == 1
        assert Page.query.get(removed.id) is None

    def test_creates_new_pages_for_new_titles(self, ctx):
        from controllers.project_controller import _smart_merge_pages
        from models import db

        pid = _make_project()

        result = _smart_merge_pages(pid, [
            {'title': 'Brand New', 'points': ['x']},
        ])
        db.session.flush()

        assert len(result) == 1
        assert result[0].status == 'DRAFT'
        assert result[0].get_outline_content()['title'] == 'Brand New'

    def test_handles_duplicate_titles_first_match_only(self, ctx):
        from controllers.project_controller import _smart_merge_pages
        from models import db

        pid = _make_project()
        p1 = _make_page(pid, 'Dup', 0, desc='first')
        p2 = _make_page(pid, 'Dup', 1, desc='second')

        result = _smart_merge_pages(pid, [
            {'title': 'Dup', 'points': []},
            {'title': 'Dup', 'points': []},
        ])
        db.session.flush()

        # First match reuses p1, second creates new (p2 deleted since not matched)
        assert result[0].id == p1.id
        assert result[0].get_description_content()['text'] == 'first'
        assert result[1].id != p2.id
