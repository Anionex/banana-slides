"""Hosted beta email signup and owner-only CSV export."""
import csv
import hmac
import ipaddress
import io
import re
import time
from collections import deque
from datetime import timezone
from threading import Lock

from flask import Response, jsonify, request
from sqlalchemy.exc import IntegrityError

from models import db, WaitlistSignup


LOCAL_RE = re.compile(r"[a-z0-9.!#$%&'*+/=?^_`{|}~-]+", re.IGNORECASE)
DOMAIN_LABEL_RE = re.compile(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', re.IGNORECASE)
CF_EDGE_NETWORKS = tuple(ipaddress.ip_network(cidr) for cidr in (
    '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22',
    '103.31.4.0/22', '141.101.64.0/18', '108.162.192.0/18',
    '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22',
    '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
    '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
    '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32',
    '2405:b500::/32', '2405:8100::/32', '2a06:98c0::/29',
    '2c0f:f248::/32',
))


def _valid_email(email):
    if len(email) > 254 or email.startswith(('=', '+', '-', '@')) or email.count('@') != 1:
        return False
    local, domain = email.split('@')
    if (not 1 <= len(local) <= 64 or not LOCAL_RE.fullmatch(local)
            or local.startswith('.') or local.endswith('.') or '..' in local):
        return False
    labels = domain.split('.')
    return len(labels) >= 2 and all(DOMAIN_LABEL_RE.fullmatch(label) for label in labels)


def _client_address():
    # The public demo's loopback-only front proxy replaces X-Real-IP with
    # OpenResty's $remote_addr. Only a verified Cloudflare edge may supply
    # CF-Connecting-IP; other requests use the actual origin-facing address.
    address = request.headers.get('X-Real-IP') or request.remote_addr or ''
    try:
        edge = ipaddress.ip_address(address)
    except ValueError:
        return request.remote_addr or 'unknown'
    if any(edge in network for network in CF_EDGE_NETWORKS):
        visitor = request.headers.get('CF-Connecting-IP', '')
        try:
            return str(ipaddress.ip_address(visitor))
        except ValueError:
            pass
    return str(edge)


def _admit_signup(app):
    state = app.extensions['waitlist_rate_limit']
    now = time.monotonic()
    client = _client_address()
    with state['lock']:
        events = state['events']
        callers = state['callers']
        while events and events[0] <= now - 3600:
            events.popleft()
        for address, attempts in list(callers.items()):
            while attempts and attempts[0] <= now - 3600:
                attempts.popleft()
            if not attempts:
                del callers[address]
        own_attempts = callers.setdefault(client, deque())
        if len(own_attempts) >= dict.get(app.config, 'WAITLIST_CLIENT_HOURLY_LIMIT', 20):
            return False
        if len(events) >= dict.get(app.config, 'WAITLIST_HOURLY_LIMIT', 300):
            return False
        own_attempts.append(now)
        events.append(now)
        return True


def install(app):
    app.extensions['waitlist_rate_limit'] = {
        'lock': Lock(), 'events': deque(), 'callers': {},
    }

    @app.post('/api/waitlist')
    def join_waitlist():
        if not app.config.get('PUBLIC_DEMO'):
            return jsonify(error='NOT_FOUND'), 404
        data = request.get_json(silent=True)
        email = data.get('email') if isinstance(data, dict) else None
        if not isinstance(email, str):
            return jsonify(error='INVALID_EMAIL'), 400
        email = email.strip().lower()
        if not _valid_email(email):
            return jsonify(error='INVALID_EMAIL'), 400
        if not _admit_signup(app):
            response = jsonify(error='RATE_LIMITED')
            response.status_code = 429
            response.headers['Retry-After'] = '3600'
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
