"""Hosted beta email signup and owner-only CSV export."""
import csv
import hmac
import io
import re
import time
from collections import deque
from datetime import timezone
from ipaddress import ip_address
from threading import Lock

from flask import Response, jsonify, request
from sqlalchemy.exc import IntegrityError

from models import db, WaitlistSignup


EMAIL_RE = re.compile(r'^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$')


def _client_address():
    # The public site has an outer proxy and an inner frontend nginx. The
    # penultimate forwarded address is the outer proxy's observed client.
    forwarded = [part.strip() for part in request.headers.get('X-Forwarded-For', '').split(',')]
    if len(forwarded) >= 2:
        try:
            return str(ip_address(forwarded[-2]))
        except ValueError:
            pass
    return request.remote_addr or 'unknown'


def _admit_signup(app):
    state = app.extensions['waitlist_rate_limit']
    now = time.monotonic()
    address = _client_address()
    with state['lock']:
        global_events = state['global']
        while global_events and global_events[0] <= now - 3600:
            global_events.popleft()
        by_address = state['by_address']
        events = by_address.setdefault(address, deque())
        while events and events[0] <= now - 60:
            events.popleft()
        if len(events) >= 5 or len(global_events) >= 300:
            return False
        events.append(now)
        global_events.append(now)
        if len(by_address) > 300:
            for key in list(by_address):
                if not by_address[key] or by_address[key][-1] <= now - 60:
                    del by_address[key]
        return True


def install(app):
    app.extensions['waitlist_rate_limit'] = {'lock': Lock(), 'global': deque(), 'by_address': {}}

    @app.post('/api/waitlist')
    def join_waitlist():
        if not app.config.get('PUBLIC_DEMO'):
            return jsonify(error='NOT_FOUND'), 404
        data = request.get_json(silent=True)
        email = data.get('email') if isinstance(data, dict) else None
        if not isinstance(email, str):
            return jsonify(error='INVALID_EMAIL'), 400
        email = email.strip().lower()
        if len(email) > 254 or email.startswith(('=', '+', '-', '@')) or not EMAIL_RE.fullmatch(email):
            return jsonify(error='INVALID_EMAIL'), 400
        if not _admit_signup(app):
            response = jsonify(error='RATE_LIMITED')
            response.status_code = 429
            response.headers['Retry-After'] = '60'
            response.headers['Cache-Control'] = 'no-store'
            return response
        if db.session.query(WaitlistSignup.id).filter_by(email=email).first() is not None:
            response = jsonify(data={'accepted': True})
            response.headers['Cache-Control'] = 'no-store'
            return response
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
            safe_email = "'" + signup.email if signup.email.startswith(('=', '+', '-', '@')) else signup.email
            writer.writerow([safe_email, created.astimezone(timezone.utc).isoformat()])
        response = Response(output.getvalue(), mimetype='text/csv; charset=utf-8')
        response.headers['Content-Disposition'] = 'attachment; filename="banana-slides-beta-waitlist.csv"'
        response.headers['Cache-Control'] = 'no-store'
        return response
