"""Private configuration for an anonymous public-demo visitor."""
from . import db


def public_asset_owner():
    """Assign new assets to the same request/worker visitor as personal keys."""
    from services.public_demo import enabled, visitor
    owner = visitor() if enabled() else None
    return owner['token'] if owner else None


def public_asset_query(model):
    """Keep global asset behavior outside public mode; fail closed without an owner."""
    from services.public_demo import enabled
    query = model.query
    if not enabled():
        return query
    owner = public_asset_owner()
    return query.filter_by(public_visitor_hash=owner) if owner else query.filter(False)


class PublicVisitor(db.Model):
    __tablename__ = 'public_visitors'
    token_hash = db.Column(db.String(64), primary_key=True)
    config_json = db.Column(db.Text, nullable=False, default='{}')
