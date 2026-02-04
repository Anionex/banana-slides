"""
Admin service - business logic for the admin dashboard
"""
import logging
from datetime import datetime, timedelta, timezone

from models import db
from models.user import User
from sqlalchemy import func

logger = logging.getLogger(__name__)


class AdminService:

    @staticmethod
    def get_overview_stats():
        """Get overview statistics for the admin dashboard."""
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=today_start.weekday())
        month_start = today_start.replace(day=1)

        total_users = db.session.query(func.count(User.id)).scalar() or 0
        active_users = db.session.query(func.count(User.id)).filter(
            User.is_active.is_(True)
        ).scalar() or 0
        verified_users = db.session.query(func.count(User.id)).filter(
            User.email_verified.is_(True)
        ).scalar() or 0
        total_credits_consumed = db.session.query(
            func.coalesce(func.sum(User.credits_used_total), 0)
        ).scalar() or 0

        new_users_today = db.session.query(func.count(User.id)).filter(
            User.created_at >= today_start
        ).scalar() or 0
        new_users_this_week = db.session.query(func.count(User.id)).filter(
            User.created_at >= week_start
        ).scalar() or 0
        new_users_this_month = db.session.query(func.count(User.id)).filter(
            User.created_at >= month_start
        ).scalar() or 0

        return {
            'total_users': total_users,
            'active_users': active_users,
            'verified_users': verified_users,
            'total_credits_consumed': total_credits_consumed,
            'new_users_today': new_users_today,
            'new_users_this_week': new_users_this_week,
            'new_users_this_month': new_users_this_month,
        }

    @staticmethod
    def get_user_growth_trend(days=30):
        """Get daily new user counts for the given number of days."""
        now = datetime.now(timezone.utc)
        start_date = (now - timedelta(days=days - 1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        rows = (
            db.session.query(
                func.date(User.created_at).label('day'),
                func.count(User.id).label('count'),
            )
            .filter(User.created_at >= start_date)
            .group_by(func.date(User.created_at))
            .order_by(func.date(User.created_at))
            .all()
        )

        day_map = {str(row.day): row.count for row in rows}

        labels = []
        values = []
        for i in range(days):
            d = start_date + timedelta(days=i)
            day_str = d.strftime('%Y-%m-%d')
            labels.append(day_str)
            values.append(day_map.get(day_str, 0))

        return {'labels': labels, 'values': values}

    @staticmethod
    def get_users_paginated(limit=20, offset=0, search=None,
                            filter_plan=None, filter_status=None):
        """Get paginated user list with optional search and filters."""
        query = User.query

        if search:
            like_pattern = f'%{search}%'
            query = query.filter(
                db.or_(
                    User.email.ilike(like_pattern),
                    User.username.ilike(like_pattern),
                )
            )

        if filter_plan:
            query = query.filter(User.subscription_plan == filter_plan)

        if filter_status == 'active':
            query = query.filter(User.is_active.is_(True))
        elif filter_status == 'inactive':
            query = query.filter(User.is_active.is_(False))
        elif filter_status == 'verified':
            query = query.filter(User.email_verified.is_(True))

        total = query.count()
        users = (
            query.order_by(User.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        return {
            'users': [u.to_dict() for u in users],
            'total': total,
            'has_more': offset + limit < total,
        }

    @staticmethod
    def adjust_user_credits(user_id, amount, reason=''):
        """Adjust a user's credit balance. amount can be positive or negative."""
        user = User.query.get(user_id)
        if not user:
            return None, 'User not found'

        new_balance = user.credits_balance + amount
        if new_balance < 0:
            return None, 'Insufficient credits, balance cannot go below 0'

        user.credits_balance = new_balance
        db.session.commit()

        logger.info(
            'Admin adjusted credits for user %s: %+d (reason: %s). '
            'New balance: %d',
            user_id, amount, reason, new_balance,
        )

        return user.to_dict(), None

    @staticmethod
    def toggle_user_active(user_id, is_active, admin_id):
        """Enable or disable a user account. Cannot disable yourself."""
        if user_id == admin_id:
            return None, 'Cannot disable your own account'

        user = User.query.get(user_id)
        if not user:
            return None, 'User not found'

        user.is_active = is_active
        db.session.commit()

        logger.info(
            'Admin %s set user %s is_active=%s',
            admin_id, user_id, is_active,
        )

        return user.to_dict(), None

    @staticmethod
    def change_user_subscription(user_id, plan, expires_at=None):
        """Change a user's subscription plan and optional expiry."""
        user = User.query.get(user_id)
        if not user:
            return None, 'User not found'

        user.subscription_plan = plan
        if expires_at:
            user.subscription_expires_at = datetime.fromisoformat(
                expires_at.replace('Z', '+00:00')
            )
        else:
            user.subscription_expires_at = None

        db.session.commit()

        logger.info(
            'Admin changed subscription for user %s: plan=%s, expires=%s',
            user_id, plan, expires_at,
        )

        return user.to_dict(), None
