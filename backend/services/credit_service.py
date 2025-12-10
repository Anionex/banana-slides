"""
Credit Service - handles credit operations for users
"""
import logging
from typing import List, Optional
from models import db
from models.user import User
from models.credit_transaction import CreditTransaction

logger = logging.getLogger(__name__)


class CreditService:
    """Service for managing user credits"""
    
    COST_PER_IMAGE = 10
    INITIAL_CREDITS = 50
    
    @staticmethod
    def check_credits(user: Optional[User], required: int = None) -> bool:
        """
        Check if user has enough credits
        
        Args:
            user: User object (None for guest users)
            required: Number of credits required (defaults to COST_PER_IMAGE)
            
        Returns:
            True if user has enough credits or is admin, False otherwise
        """
        if required is None:
            required = CreditService.COST_PER_IMAGE
            
        # Guest users cannot use credits
        if user is None:
            return False
        
        # Admin users bypass credit check
        if user.role == 'admin':
            return True
        
        return user.credits >= required
    
    @staticmethod
    def deduct_credits(user: Optional[User], amount: int = None, 
                       tx_type: str = 'IMAGE_GENERATION', 
                       description: str = None,
                       reference_id: str = None) -> bool:
        """
        Deduct credits from user and log transaction
        
        Args:
            user: User object
            amount: Amount to deduct (defaults to COST_PER_IMAGE)
            tx_type: Transaction type for logging
            description: Human-readable description
            reference_id: Optional reference (task_id, page_id, etc.)
            
        Returns:
            True if deduction successful, False otherwise
        """
        if amount is None:
            amount = CreditService.COST_PER_IMAGE
            
        # Guest users cannot use credits
        if user is None:
            return False
        
        # Admin users don't consume credits
        if user.role == 'admin':
            logger.info(f"Admin user {user.id} bypassed credit deduction")
            return True
        
        # Check sufficient balance
        if user.credits < amount:
            logger.warning(f"User {user.id} has insufficient credits: {user.credits} < {amount}")
            return False
        
        # Deduct credits
        user.credits -= amount
        balance_after = user.credits
        
        # Create transaction record
        transaction = CreditTransaction(
            user_id=user.id,
            amount=-amount,  # Negative for deduction
            balance_after=balance_after,
            transaction_type=tx_type,
            description=description or f"Image generation cost",
            reference_id=reference_id
        )
        db.session.add(transaction)
        
        logger.info(f"Deducted {amount} credits from user {user.id}, balance: {balance_after}")
        return True
    
    @staticmethod
    def add_credits(user: User, amount: int, 
                    tx_type: str = 'PURCHASE',
                    description: str = None,
                    reference_id: str = None) -> int:
        """
        Add credits to user account
        
        Args:
            user: User object
            amount: Amount to add
            tx_type: Transaction type (PURCHASE, SIGNUP_BONUS, REFUND, etc.)
            description: Human-readable description
            reference_id: Optional reference (order_id, etc.)
            
        Returns:
            New balance after addition
        """
        user.credits += amount
        balance_after = user.credits
        
        # Create transaction record
        transaction = CreditTransaction(
            user_id=user.id,
            amount=amount,  # Positive for addition
            balance_after=balance_after,
            transaction_type=tx_type,
            description=description or f"Credits added",
            reference_id=reference_id
        )
        db.session.add(transaction)
        
        logger.info(f"Added {amount} credits to user {user.id}, balance: {balance_after}")
        return balance_after
    
    @staticmethod
    def get_balance(user: Optional[User]) -> int:
        """
        Get user's current credit balance
        
        Args:
            user: User object
            
        Returns:
            Current credit balance (0 for guests)
        """
        if user is None:
            return 0
        return user.credits
    
    @staticmethod
    def get_transaction_history(user: User, limit: int = 50, offset: int = 0) -> List[CreditTransaction]:
        """
        Get user's credit transaction history
        
        Args:
            user: User object
            limit: Maximum number of transactions to return
            offset: Offset for pagination
            
        Returns:
            List of CreditTransaction objects
        """
        return CreditTransaction.query.filter_by(user_id=user.id)\
            .order_by(CreditTransaction.created_at.desc())\
            .offset(offset)\
            .limit(limit)\
            .all()
    
    @staticmethod
    def initialize_new_user_credits(user: User) -> None:
        """
        Initialize credits for a new user with signup bonus
        
        Args:
            user: Newly created User object
        """
        # User model already has default credits, just log the transaction
        transaction = CreditTransaction(
            user_id=user.id,
            amount=CreditService.INITIAL_CREDITS,
            balance_after=CreditService.INITIAL_CREDITS,
            transaction_type='SIGNUP_BONUS',
            description='Welcome bonus credits'
        )
        db.session.add(transaction)
        logger.info(f"Initialized {CreditService.INITIAL_CREDITS} credits for new user {user.id}")
