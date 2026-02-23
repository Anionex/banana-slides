"""
Admin service - business logic for the admin dashboard
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from models import db
from models.user import User
from models.credit_transaction import CreditTransaction
from models.payment_order import PaymentOrder
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
    def adjust_user_credits(user_id, amount, reason='', admin_id=None):
        """Adjust a user's credit balance. amount can be positive or negative."""
        user = User.query.get(user_id)
        if not user:
            return None, 'User not found'

        new_balance = user.credits_balance + amount
        if new_balance < 0:
            return None, 'Insufficient credits, balance cannot go below 0'

        user.credits_balance = new_balance

        # Create transaction record for auditing
        description = f"Admin adjustment: {reason}" if reason else "Admin adjustment"
        if admin_id:
            description = f"[by {admin_id[:8]}] {description}"

        transaction = CreditTransaction(
            user_id=user_id,
            operation='ADMIN_ADJUST',
            amount=amount,
            balance_after=new_balance,
            description=description,
        )
        db.session.add(transaction)
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
    def change_user_subscription(user_id, plan, expires_at=None, admin_id=None):
        """Change a user's subscription plan and optional expiry."""
        user = User.query.get(user_id)
        if not user:
            return None, 'User not found'

        old_plan = user.subscription_plan or 'free'
        user.subscription_plan = plan
        if expires_at:
            user.subscription_expires_at = datetime.fromisoformat(
                expires_at.replace('Z', '+00:00')
            )
        else:
            user.subscription_expires_at = None

        # Create a zero-amount order for auditing
        order = PaymentOrder(
            id=str(uuid.uuid4()),
            user_id=user_id,
            package_id='plan_change',
            package_name=f'Plan: {old_plan} → {plan}',
            credits=0,
            bonus_credits=0,
            total_credits=0,
            amount=0,
            currency='CNY',
            payment_provider='admin',
            payment_type=f'by {admin_id[:8]}' if admin_id else 'admin',
            status='paid',
            created_at=datetime.now(timezone.utc),
            paid_at=datetime.now(timezone.utc),
        )
        db.session.add(order)
        db.session.commit()

        logger.info(
            'Admin changed subscription for user %s: plan=%s, expires=%s',
            user_id, plan, expires_at,
        )

        return user.to_dict(), None

    @staticmethod
    def get_all_transactions(
        limit: int = 50,
        offset: int = 0,
        user_search: Optional[str] = None,
        operation: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ):
        """
        Get all credit transactions for auditing with optional filters.
        """
        query = CreditTransaction.query

        if user_search:
            query = query.join(User, CreditTransaction.user_id == User.id).filter(
                db.or_(
                    CreditTransaction.user_id == user_search,
                    User.username.ilike(f'%{user_search}%'),
                    User.email.ilike(f'%{user_search}%'),
                )
            )

        if operation:
            query = query.filter(CreditTransaction.operation == operation)

        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                query = query.filter(CreditTransaction.created_at >= start_dt)
            except ValueError:
                pass

        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                query = query.filter(CreditTransaction.created_at <= end_dt)
            except ValueError:
                pass

        total = query.count()
        transactions = (
            query.order_by(CreditTransaction.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        # Include user info in each transaction
        result = []
        for tx in transactions:
            tx_dict = tx.to_dict()
            if tx.user:
                tx_dict['user'] = {
                    'id': tx.user.id,
                    'email': tx.user.email,
                    'username': tx.user.username,
                }
            result.append(tx_dict)

        return {
            'transactions': result,
            'total': total,
            'limit': limit,
            'offset': offset,
            'has_more': offset + limit < total,
        }

    @staticmethod
    def get_all_orders(
        limit: int = 50,
        offset: int = 0,
        user_id: Optional[str] = None,
        status: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ):
        """
        Get all payment orders for auditing with optional filters.

        Args:
            limit: Max number of records to return
            offset: Number of records to skip
            user_id: Filter by specific user ID
            status: Filter by order status
            start_date: Filter by start date (ISO format)
            end_date: Filter by end date (ISO format)

        Returns:
            Dict with orders list, total count, and pagination info
        """
        query = PaymentOrder.query

        if user_id:
            query = query.filter(PaymentOrder.user_id == user_id)

        if status:
            query = query.filter(PaymentOrder.status == status)

        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                query = query.filter(PaymentOrder.created_at >= start_dt)
            except ValueError:
                pass

        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                query = query.filter(PaymentOrder.created_at <= end_dt)
            except ValueError:
                pass

        total = query.count()
        orders = (
            query.order_by(PaymentOrder.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        return {
            'orders': [order.to_dict(include_user=True) for order in orders],
            'total': total,
            'limit': limit,
            'offset': offset,
            'has_more': offset + limit < total,
        }
