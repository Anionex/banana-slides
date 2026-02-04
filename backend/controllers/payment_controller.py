"""
Payment Controller - handles payment and credits endpoints
支付控制器 - 处理支付和积分相关接口
"""
import logging
from flask import Blueprint, request, current_app
from models import db, User
from utils import success_response, error_response, bad_request, not_found
from middlewares.auth import auth_required, get_current_user
from services.credits_service import CreditsService, CreditOperation
from services.payment import (
    get_payment_provider, 
    get_credit_package, 
    CREDIT_PACKAGES,
    PaymentStatus
)

logger = logging.getLogger(__name__)

payment_bp = Blueprint('payment', __name__, url_prefix='/api/payment')


@payment_bp.route('/packages', methods=['GET'])
def list_packages():
    """
    GET /api/payment/packages - List available credit packages
    
    Returns:
        List of credit packages with pricing
    """
    return success_response({
        'packages': [p.to_dict() for p in CREDIT_PACKAGES]
    })


@payment_bp.route('/credits', methods=['GET'])
@auth_required
def get_credits():
    """
    GET /api/payment/credits - Get current user's credits info

    Returns:
        User's credits balance and usage
    """
    user = get_current_user()
    return success_response(CreditsService.get_user_credits_info(user))


@payment_bp.route('/transactions', methods=['GET'])
@auth_required
def list_transactions():
    """
    GET /api/payment/transactions - Get current user's credit transaction history

    Query params:
        limit: int (default 20, max 100)
        offset: int (default 0)

    Returns:
        Paginated list of credit transactions
    """
    user = get_current_user()
    limit = min(int(request.args.get('limit', 20)), 100)
    offset = max(int(request.args.get('offset', 0)), 0)

    transactions, total = CreditsService.get_transactions(user, limit, offset)
    return success_response({
        'transactions': transactions,
        'total': total,
        'limit': limit,
        'offset': offset,
    })


@payment_bp.route('/estimate', methods=['POST'])
@auth_required
def estimate_cost():
    """
    POST /api/payment/estimate - Estimate credits cost for a project
    
    Request body:
    {
        "pages_count": 10,
        "include_outline": true,
        "include_descriptions": true,
        "include_images": true
    }
    
    Returns:
        Breakdown of credits cost
    """
    data = request.get_json() or {}
    pages_count = data.get('pages_count', 10)
    
    estimate = CreditsService.estimate_project_cost(
        pages_count=pages_count,
        include_outline=data.get('include_outline', True),
        include_descriptions=data.get('include_descriptions', True),
        include_images=data.get('include_images', True)
    )
    
    return success_response(estimate)


@payment_bp.route('/create-order', methods=['POST'])
@auth_required
def create_order():
    """
    POST /api/payment/create-order - Create a payment order
    
    Request body:
    {
        "package_id": "standard",
        "payment_type": "wechat"  // or "alipay" for xunhupay
    }
    
    Returns:
        Payment URL and order info
    """
    user = get_current_user()
    data = request.get_json() or {}
    
    package_id = data.get('package_id')
    if not package_id:
        return bad_request("package_id is required")
    
    package = get_credit_package(package_id)
    if not package:
        return bad_request(f"Invalid package_id: {package_id}")
    
    payment_type = data.get('payment_type', 'wechat')
    
    # Get base URL for callbacks
    base_url = request.url_root.rstrip('/')
    notify_url = f"{base_url}/api/payment/webhook"
    return_url = data.get('return_url', f"{base_url}/payment/success")
    
    # Get client IP
    client_ip = request.remote_addr
    
    try:
        provider = get_payment_provider()
        result = provider.create_order(
            user_id=user.id,
            package=package,
            notify_url=notify_url,
            return_url=return_url,
            client_ip=client_ip,
            payment_type=payment_type if hasattr(provider.create_order, 'payment_type') else None
        )
        
        if result.success:
            logger.info(f"Payment order created: {result.order_id} for user {user.id}")
            return success_response(result.to_dict())
        else:
            logger.error(f"Payment order creation failed: {result.error_message}")
            return error_response('PAYMENT_ERROR', result.error_message, 400)
            
    except Exception as e:
        logger.error(f"Payment error: {e}", exc_info=True)
        return error_response('PAYMENT_ERROR', str(e), 500)


@payment_bp.route('/webhook', methods=['POST'])
def payment_webhook():
    """
    POST /api/payment/webhook - Handle payment webhook callbacks
    
    This endpoint is called by the payment provider when payment status changes.
    """
    try:
        # Get raw payload
        payload = request.get_json() or request.form.to_dict()
        
        if not payload:
            logger.warning("Empty webhook payload received")
            return 'OK', 200
        
        # Get signature from header (for Lemon Squeezy)
        signature = request.headers.get('X-Signature')
        
        # Try to determine provider and process
        provider = get_payment_provider()
        
        # Verify webhook signature
        if not provider.verify_webhook(payload, signature):
            logger.warning(f"Webhook signature verification failed for {provider.provider_name}")
            # Still return 200 to avoid retries, but log the issue
            return 'OK', 200
        
        # Parse webhook data
        order_info = provider.parse_webhook(payload)
        
        if order_info.get('status') == PaymentStatus.PAID:
            # Process successful payment
            user_id = order_info.get('user_id')
            package_id = order_info.get('package_id')
            
            if user_id and package_id:
                user = User.query.get(user_id)
                package = get_credit_package(package_id)
                
                if user and package:
                    # Add credits to user
                    success, error = CreditsService.add_credits(
                        user=user,
                        amount=package.total_credits,
                        operation=CreditOperation.PURCHASE,
                        description=f"Purchase {package.name} ({order_info.get('order_id')})"
                    )
                    
                    if success:
                        logger.info(f"Credits added for user {user_id}: {package.total_credits} ({package.name})")
                    else:
                        logger.error(f"Failed to add credits: {error}")
                else:
                    logger.error(f"User or package not found: user={user_id}, package={package_id}")
            else:
                logger.warning(f"Missing user_id or package_id in webhook: {order_info}")
        
        return 'OK', 200
        
    except Exception as e:
        logger.error(f"Webhook processing error: {e}", exc_info=True)
        # Return 200 to prevent retries
        return 'OK', 200


@payment_bp.route('/order/<order_id>', methods=['GET'])
@auth_required
def query_order(order_id):
    """
    GET /api/payment/order/<order_id> - Query order status
    
    Returns:
        Order status and details
    """
    try:
        provider = get_payment_provider()
        order_info = provider.query_order(order_id)
        
        if order_info:
            return success_response(order_info)
        else:
            return not_found('Order')
            
    except Exception as e:
        logger.error(f"Order query error: {e}", exc_info=True)
        return error_response('QUERY_ERROR', str(e), 500)
