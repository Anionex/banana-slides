"""Hosted beta email signup and owner-only CSV export."""
import csv
import hmac
import io
import re
from datetime import timezone

from flask import Response, jsonify, request
from sqlalchemy.exc import IntegrityError

from models import db, WaitlistSignup


EMAIL_RE = re.compile(r'^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$')


def install(app):
    @app.post('/api/waitlist')
    def join_waitlist():
        if not app.config.get('PUBLIC_DEMO'):
            return jsonify(error='NOT_FOUND'), 404
        data = request.get_json(silent=True)
        email = data.get('email') if isinstance(data, dict) else None
        if not isinstance(email, str):
            return jsonify(error='INVALID_EMAIL'), 400
        email = email.strip().lower()
        if len(email) > 254 or not EMAIL_RE.fullmatch(email):
            return jsonify(error='INVALID_EMAIL'), 400
        db.session.add(WaitlistSignup(email=email))
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            if db.session.query(WaitlistSignup.id).filter_by(email=email).first() is None:
                raise
            # Identical response avoids revealing whether an address is already on the list.
        response = jsonify(data={'accepted': True})
        response.headers['Cache-Control'] = 'no-store'
        return response

    @app.post('/api/admin/waitlist/export')
    def export_waitlist():
        password = dict.get(app.config, 'PUBLIC_DEMO_ADMIN_PASSWORD', '')
        if not app.config.get('PUBLIC_DEMO') or not password:
            return jsonify(error='NOT_FOUND'), 404
        data = request.get_json(silent=True)
        supplied = data.get('password') if isinstance(data, dict) else None
        if not isinstance(supplied, str) or not hmac.compare_digest(supplied.encode(), password.encode()):
            return jsonify(error='UNAUTHORIZED'), 401
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['email', 'created_at_utc'])
        for signup in db.session.query(WaitlistSignup).order_by(WaitlistSignup.created_at, WaitlistSignup.id):
            created = signup.created_at
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            writer.writerow([signup.email, created.astimezone(timezone.utc).isoformat()])
        response = Response(output.getvalue(), mimetype='text/csv; charset=utf-8')
        response.headers['Content-Disposition'] = 'attachment; filename="banana-slides-beta-waitlist.csv"'
        response.headers['Cache-Control'] = 'no-store'
        return response
