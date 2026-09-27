"""Exercise the public signup and protected export against a real SQLite database."""
import csv
import io

from flask import Flask

from models import db, WaitlistSignup
from services.public_demo import PublicConfig, install as install_public_demo
from services.waitlist import install as install_waitlist


def test_signup_deduplicates_and_exports_with_owner_password(tmp_path):
    app = Flask(__name__)
    app.config = PublicConfig(app.root_path, dict(app.config))
    app.config.update(PUBLIC_DEMO=True, TESTING=True,
                      PUBLIC_DEMO_ADMIN_PASSWORD='owner-secret',
                      SQLALCHEMY_DATABASE_URI='sqlite:///' + str(tmp_path / 'waitlist.db'))
    db.init_app(app)
    install_public_demo(app)
    install_waitlist(app)
    with app.app_context():
        db.create_all()
    client = app.test_client()

    for invalid in ({}, {'email': 'wrong'}, {'email': 'a@b'}, {'email': 'a@b.com\nOther: x'}):
        assert client.post('/api/waitlist', json=invalid).status_code == 400
    for address in ('  Alice@Example.com  ', 'alice@example.com'):
        response = client.post('/api/waitlist', json={'email': address})
        assert response.status_code == 200
        assert response.json == {'data': {'accepted': True}}
    with app.app_context():
        assert db.session.query(WaitlistSignup).count() == 1
        assert db.session.query(WaitlistSignup).one().email == 'alice@example.com'

    export = '/api/admin/waitlist/export'
    assert client.post(export, json={'password': 'wrong'}).status_code == 401
    assert client.get(export, headers={'X-User-Token': 'visitor-a-0000000000000000000000000'}).status_code == 405
    response = client.post(export, json={'password': 'owner-secret'},
                           headers={'X-User-Token': 'visitor-a-0000000000000000000000000'})
    assert response.status_code == 200
    assert response.headers['Cache-Control'] == 'no-store'
    rows = list(csv.DictReader(io.StringIO(response.get_data(as_text=True))))
    assert len(rows) == 1
    assert rows[0]['email'] == 'alice@example.com'
    assert rows[0]['created_at_utc'].endswith('+00:00')

    app.config['PUBLIC_DEMO'] = False
    assert client.post('/api/waitlist', json={'email': 'new@example.com'}).status_code == 404
    assert client.post(export, json={'password': 'owner-secret'}).status_code == 404
