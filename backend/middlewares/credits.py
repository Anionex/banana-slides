"""
Credits middleware for checking and consuming user credits
积分检查中间件
"""
import logging
from functools import wraps
from typing import Optional, Callable

from flask import g
from utils.response import error_response
from services.credits_service import CreditsService, CreditOperation

logger = logging.getLogger(__name__)


def check_credits(operation: CreditOperation, quantity_func: Optional[Callable] = None):
    """
    Decorator that checks if user has enough credits for an operation.
    
    Usage:
        @app.route('/api/projects/<project_id>/generate/outline')
        @auth_required
        @check_credits(CreditOperation.GENERATE_OUTLINE)
        def generate_outline(project_id):
            # ...
        
        # With dynamic quantity based on request
        @app.route('/api/projects/<project_id>/generate/images')
        @auth_required
        @check_credits(CreditOperation.GENERATE_IMAGE, quantity_func=lambda: len(request.json.get('page_ids', [])) or 1)
        def generate_images(project_id):
            # ...
    
    Args:
        operation: The credit operation type
        quantity_func: Optional callable that returns the quantity (e.g., number of pages)
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user = getattr(g, 'current_user', None)
            
            if not user:
                logger.error("check_credits decorator used without @auth_required")
                return error_response('UNAUTHORIZED', '请先登录', 401)
            
            # Calculate quantity
            quantity = 1
            if quantity_func:
                try:
                    quantity = quantity_func()
                    if quantity < 1:
                        quantity = 1
                except Exception as e:
                    logger.warning(f"Failed to calculate quantity: {e}, using default 1")
                    quantity = 1
            
            # Check credits
            has_enough, required = CreditsService.check_credits(user, operation, quantity)
            
            if not has_enough:
                logger.info(f"User {user.id} has insufficient credits for {operation.value}: {user.credits_balance} < {required}")
                return error_response(
                    'INSUFFICIENT_CREDITS',
                    f'积分不足，需要 {required} 积分，当前余额 {user.credits_balance}',
                    402  # Payment Required
                )
            
            # Store operation info in g for later consumption
            g.credit_operation = operation
            g.credit_quantity = quantity
            g.credit_cost = required
            
            return f(*args, **kwargs)
        
        return decorated
    return decorator


def consume_credits_after_success(f):
    """
    Decorator that consumes credits after successful operation.
    Must be used after @check_credits.
    
    Usage:
        @app.route('/api/projects/<project_id>/generate/outline')
        @auth_required
        @check_credits(CreditOperation.GENERATE_OUTLINE)
        @consume_credits_after_success
        def generate_outline(project_id):
            # ... do work ...
            return success_response(data)
    
    Note: This decorator consumes credits after the function returns successfully.
    For async tasks, credits should be consumed in the task itself.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        result = f(*args, **kwargs)
        
        # Check if the response indicates success
        # Flask responses are tuples (body, status_code) or Response objects
        is_success = False
        if isinstance(result, tuple):
            status_code = result[1] if len(result) > 1 else 200
            is_success = 200 <= status_code < 300
        else:
            # Assume success if not a tuple (direct return)
            is_success = True
        
        if is_success:
            user = getattr(g, 'current_user', None)
            operation = getattr(g, 'credit_operation', None)
            quantity = getattr(g, 'credit_quantity', 1)
            
            if user and operation:
                success, error = CreditsService.consume_credits(user, operation, quantity)
                if not success:
                    logger.error(f"Failed to consume credits after success: {error}")
        
        return result
    
    return decorated


def get_pending_credit_cost() -> int:
    """
    Get the pending credit cost from the current request context.
    Useful for including in response data.
    
    Returns:
        The credit cost that will be/was consumed
    """
    return getattr(g, 'credit_cost', 0)
