"""Test _smart_merge_pages position-based logic with a minimal Flask app."""
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


class TestPositionBasedMerge:

    def test_equal_pages_preserves_description_and_image(self, ctx):
        """Same number of pages: outline updated, description/image kept."""
        from controllers.project_controller import _smart_merge_pages
        from models import db

        pid = _make_project()
        old0 = _make_page(pid, 'Old Title A', 0, desc='desc A', image_path='/img/a.png', status='IMAGE_GENERATED')
        old1 = _make_page(pid, 'Old Title B', 1, desc='desc B', image_path='/img/b.png', status='IMAGE_GENERATED')

        result = _smart_merge_pages(pid, [
            {'title': 'New Title A', 'points': ['new']},
            {'title': 'New Title B', 'points': ['new']},
        ])
        db.session.flush()

        assert len(result) == 2
        # Same page objects reused
        assert result[0].id == old0.id
        assert result[1].id == old1.id
        # Outline updated
        assert result[0].get_outline_content()['title'] == 'New Title A'
        assert result[1].get_outline_content()['title'] == 'New Title B'
        # Description and image preserved
        assert result[0].get_description_content()['text'] == 'desc A'
        assert result[0].generated_image_path == '/img/a.png'
        assert result[1].get_description_content()['text'] == 'desc B'
        assert result[1].generated_image_path == '/img/b.png'

    def test_more_pages_creates_new_ones(self, ctx):
        """New outline has more pages: old pages kept, new pages created."""
        from controllers.project_controller import _smart_merge_pages
        from models import db

        pid = _make_project('proj-more')
        old0 = _make_page(pid, 'Page A', 0, desc='desc A')

        result = _smart_merge_pages(pid, [
            {'title': 'Page A updated', 'points': []},
            {'title': 'Page B new', 'points': ['b1']},
        ])
        db.session.flush()

        assert len(result) == 2
        assert result[0].id == old0.id
        assert result[0].get_description_content()['text'] == 'desc A'
        assert result[1].status == 'DRAFT'
        assert result[1].get_description_content() is None

    def test_fewer_pages_deletes_trailing(self, ctx):
        """New outline has fewer pages: trailing old pages deleted."""
        from controllers.project_controller import _smart_merge_pages
        from models import db, Page

        pid = _make_project('proj-fewer')
        old0 = _make_page(pid, 'Keep', 0, desc='keep me')
        old1 = _make_page(pid, 'Delete', 1, desc='gone')
        old2 = _make_page(pid, 'Also Delete', 2, desc='also gone')

        result = _smart_merge_pages(pid, [
            {'title': 'Kept Page', 'points': []},
        ])
        db.session.flush()

        assert len(result) == 1
        assert result[0].id == old0.id
        assert result[0].get_description_content()['text'] == 'keep me'
        assert Page.query.get(old1.id) is None
        assert Page.query.get(old2.id) is None

    def test_no_old_pages_creates_all_new(self, ctx):
        """No existing pages: all new pages created."""
        from controllers.project_controller import _smart_merge_pages
        from models import db

        pid = _make_project('proj-empty')

        result = _smart_merge_pages(pid, [
            {'title': 'Brand New', 'points': ['x']},
        ])
        db.session.flush()

        assert len(result) == 1
        assert result[0].status == 'DRAFT'
        assert result[0].get_outline_content()['title'] == 'Brand New'

    def test_part_field_updated(self, ctx):
        """Part field is updated from new data."""
        from controllers.project_controller import _smart_merge_pages
        from models import db

        pid = _make_project('proj-part')
        old0 = _make_page(pid, 'Page', 0)

        result = _smart_merge_pages(pid, [
            {'title': 'Page', 'points': [], 'part': 'Chapter 2'},
        ])
        db.session.flush()

        assert result[0].part == 'Chapter 2'

    def test_order_index_updated(self, ctx):
        """Order indices are set sequentially."""
        from controllers.project_controller import _smart_merge_pages
        from models import db

        pid = _make_project('proj-order')
        _make_page(pid, 'A', 0)
        _make_page(pid, 'B', 1)

        result = _smart_merge_pages(pid, [
            {'title': 'X', 'points': []},
            {'title': 'Y', 'points': []},
            {'title': 'Z', 'points': []},
        ])
        db.session.flush()

        assert [p.order_index for p in result] == [0, 1, 2]
