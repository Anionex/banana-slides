"""
Admin controller - API endpoints for the admin dashboard
"""
import logging

from flask import Blueprint, request
from middlewares.auth import auth_required, admin_required, get_current_user
from services.admin_service import AdminService
from utils.response import success_response, error_response

logger = logging.getLogger(__name__)

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')


@admin_bp.route('/stats/overview', methods=['GET'])
@auth_required
@admin_required
def stats_overview():
    """Get overview statistics."""
    stats = AdminService.get_overview_stats()
    return success_response(stats)


@admin_bp.route('/stats/user-growth', methods=['GET'])
@auth_required
@admin_required
def stats_user_growth():
    """Get daily new-user trend."""
    days = request.args.get('days', 30, type=int)
    if days < 1 or days > 365:
        return error_response('INVALID_REQUEST', 'days must be between 1 and 365')
    data = AdminService.get_user_growth_trend(days)
    return success_response(data)


@admin_bp.route('/users', methods=['GET'])
@auth_required
@admin_required
def list_users():
    """Paginated user list with search and filters."""
    limit = request.args.get('limit', 20, type=int)
    offset = request.args.get('offset', 0, type=int)
    search = request.args.get('search', '').strip() or None
    filter_plan = request.args.get('filter_plan', '').strip() or None
    filter_status = request.args.get('filter_status', '').strip() or None

    data = AdminService.get_users_paginated(
        limit=limit, offset=offset,
        search=search, filter_plan=filter_plan,
        filter_status=filter_status,
    )
    return success_response(data)


@admin_bp.route('/transactions', methods=['GET'])
@auth_required
@admin_required
def list_all_transactions():
    """
    Get all credit transactions for auditing.

    Query params:
        limit: int (default 50, max 200)
        offset: int (default 0)
        user_id: filter by user ID
        operation: filter by operation type
        start_date: filter by start date (ISO format)
        end_date: filter by end date (ISO format)
    """
    limit = min(request.args.get('limit', 50, type=int), 200)
    offset = max(request.args.get('offset', 0, type=int), 0)
    user_id = request.args.get('user_id', '').strip() or None
    operation = request.args.get('operation', '').strip() or None
    start_date = request.args.get('start_date', '').strip() or None
    end_date = request.args.get('end_date', '').strip() or None

    data = AdminService.get_all_transactions(
        limit=limit, offset=offset,
        user_id=user_id, operation=operation,
        start_date=start_date, end_date=end_date,
    )
    return success_response(data)


@admin_bp.route('/orders', methods=['GET'])
@auth_required
@admin_required
def list_all_orders():
    """
    Get all payment orders for auditing.

    Query params:
        limit: int (default 50, max 200)
        offset: int (default 0)
        user_id: filter by user ID
        status: filter by order status (pending/paid/failed/refunded/cancelled)
        start_date: filter by start date (ISO format)
        end_date: filter by end date (ISO format)
    """
    limit = min(request.args.get('limit', 50, type=int), 200)
    offset = max(request.args.get('offset', 0, type=int), 0)
    user_id = request.args.get('user_id', '').strip() or None
    status = request.args.get('status', '').strip() or None
    start_date = request.args.get('start_date', '').strip() or None
    end_date = request.args.get('end_date', '').strip() or None

    data = AdminService.get_all_orders(
        limit=limit, offset=offset,
        user_id=user_id, status=status,
        start_date=start_date, end_date=end_date,
    )
    return success_response(data)


@admin_bp.route('/users/<user_id>/credits', methods=['POST'])
@auth_required
@admin_required
def adjust_credits(user_id):
    """Adjust a user's credit balance."""
    body = request.get_json(silent=True) or {}
    amount = body.get('amount')
    reason = body.get('reason', '')

    if amount is None or not isinstance(amount, int):
        return error_response('INVALID_REQUEST', 'amount (integer) is required')

    admin = get_current_user()
    user_data, err = AdminService.adjust_user_credits(user_id, amount, reason, admin.id)
    if err:
        return error_response('INVALID_REQUEST', err, 400)
    return success_response(user_data)


@admin_bp.route('/users/<user_id>/toggle-active', methods=['POST'])
@auth_required
@admin_required
def toggle_active(user_id):
    """Enable or disable a user account."""
    body = request.get_json(silent=True) or {}
    is_active = body.get('is_active')

    if is_active is None or not isinstance(is_active, bool):
        return error_response('INVALID_REQUEST', 'is_active (boolean) is required')

    admin = get_current_user()
    user_data, err = AdminService.toggle_user_active(
        user_id, is_active, admin.id
    )
    if err:
        return error_response('INVALID_REQUEST', err, 400)
    return success_response(user_data)


@admin_bp.route('/users/<user_id>/subscription', methods=['POST'])
@auth_required
@admin_required
def change_subscription(user_id):
    """Change a user's subscription plan."""
    body = request.get_json(silent=True) or {}
    plan = body.get('subscription_plan')

    if not plan or plan not in ('free', 'pro', 'enterprise'):
        return error_response(
            'INVALID_REQUEST',
            'subscription_plan must be one of: free, pro, enterprise',
        )

    admin = get_current_user()
    expires_at = body.get('subscription_expires_at')
    user_data, err = AdminService.change_user_subscription(
        user_id, plan, expires_at, admin.id
    )
    if err:
        return error_response('INVALID_REQUEST', err, 400)
    return success_response(user_data)
