"""
Credits Service - manages user credits for SaaS billing
积分制服务 - 管理用户积分消耗和充值
"""
import logging
from datetime import datetime, timezone
from typing import Optional, Tuple, Dict, Any
from enum import Enum

from models import db, User

logger = logging.getLogger(__name__)


class CreditOperation(Enum):
    """积分操作类型"""
    # 消耗类
    GENERATE_OUTLINE = "generate_outline"           # 生成大纲
    GENERATE_DESCRIPTION = "generate_description"   # 生成描述（每页）
    GENERATE_IMAGE = "generate_image"               # 生成图片（每页）
    EDIT_IMAGE = "edit_image"                       # 编辑图片
    GENERATE_MATERIAL = "generate_material"         # 生成素材
    REFINE_OUTLINE = "refine_outline"               # 修改大纲
    REFINE_DESCRIPTION = "refine_description"       # 修改描述
    PARSE_FILE = "parse_file"                       # 解析参考文件
    EXPORT_EDITABLE = "export_editable"             # 导出可编辑PPTX
    
    # 充值类
    PURCHASE = "purchase"                           # 购买积分
    BONUS = "bonus"                                 # 赠送积分
    REFUND = "refund"                               # 退款


# 积分消耗配置
# 可以根据业务需求调整
CREDIT_COSTS: Dict[CreditOperation, int] = {
    CreditOperation.GENERATE_OUTLINE: 5,
    CreditOperation.GENERATE_DESCRIPTION: 2,        # 每页
    CreditOperation.GENERATE_IMAGE: 10,             # 每页
    CreditOperation.EDIT_IMAGE: 8,
    CreditOperation.GENERATE_MATERIAL: 10,
    CreditOperation.REFINE_OUTLINE: 3,
    CreditOperation.REFINE_DESCRIPTION: 3,
    CreditOperation.PARSE_FILE: 5,
    CreditOperation.EXPORT_EDITABLE: 20,            # 每次导出
}


class CreditsService:
    """积分服务"""
    
    @staticmethod
    def get_cost(operation: CreditOperation, quantity: int = 1) -> int:
        """
        获取操作的积分消耗
        
        Args:
            operation: 操作类型
            quantity: 数量（如页数）
            
        Returns:
            总积分消耗
        """
        base_cost = CREDIT_COSTS.get(operation, 0)
        return base_cost * quantity
    
    @staticmethod
    def check_credits(user: User, operation: CreditOperation, quantity: int = 1) -> Tuple[bool, int]:
        """
        检查用户是否有足够积分
        
        Args:
            user: 用户对象
            operation: 操作类型
            quantity: 数量
            
        Returns:
            Tuple of (has_enough, required_credits)
        """
        required = CreditsService.get_cost(operation, quantity)
        has_enough = user.credits_balance >= required
        return has_enough, required
    
    @staticmethod
    def consume_credits(
        user: User, 
        operation: CreditOperation, 
        quantity: int = 1,
        description: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        消耗用户积分
        
        Args:
            user: 用户对象
            operation: 操作类型
            quantity: 数量
            description: 操作描述（可选）
            
        Returns:
            Tuple of (success, error_message)
        """
        cost = CreditsService.get_cost(operation, quantity)
        
        if user.credits_balance < cost:
            logger.warning(f"User {user.id} has insufficient credits: {user.credits_balance} < {cost}")
            return False, f"积分不足，需要 {cost} 积分，当前余额 {user.credits_balance}"
        
        try:
            user.credits_balance -= cost
            user.credits_used_total += cost
            db.session.commit()
            
            logger.info(f"User {user.id} consumed {cost} credits for {operation.value}, balance: {user.credits_balance}")
            return True, None
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to consume credits for user {user.id}: {e}")
            return False, "积分扣除失败，请稍后重试"
    
    @staticmethod
    def add_credits(
        user: User,
        amount: int,
        operation: CreditOperation,
        description: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        增加用户积分
        
        Args:
            user: 用户对象
            amount: 积分数量
            operation: 操作类型（PURCHASE/BONUS/REFUND）
            description: 操作描述（可选）
            
        Returns:
            Tuple of (success, error_message)
        """
        if amount <= 0:
            return False, "积分数量必须大于0"
        
        try:
            user.credits_balance += amount
            db.session.commit()
            
            logger.info(f"User {user.id} received {amount} credits ({operation.value}), balance: {user.credits_balance}")
            return True, None
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to add credits for user {user.id}: {e}")
            return False, "积分充值失败，请稍后重试"
    
    @staticmethod
    def get_user_credits_info(user: User) -> Dict[str, Any]:
        """
        获取用户积分信息
        
        Args:
            user: 用户对象
            
        Returns:
            积分信息字典
        """
        return {
            'balance': user.credits_balance,
            'used_total': user.credits_used_total,
            'subscription_plan': user.subscription_plan,
        }
    
    @staticmethod
    def estimate_project_cost(
        pages_count: int,
        include_outline: bool = True,
        include_descriptions: bool = True,
        include_images: bool = True
    ) -> Dict[str, int]:
        """
        估算项目所需积分
        
        Args:
            pages_count: 页面数量
            include_outline: 是否包含大纲生成
            include_descriptions: 是否包含描述生成
            include_images: 是否包含图片生成
            
        Returns:
            各项消耗和总计
        """
        breakdown = {}
        total = 0
        
        if include_outline:
            cost = CreditsService.get_cost(CreditOperation.GENERATE_OUTLINE)
            breakdown['outline'] = cost
            total += cost
        
        if include_descriptions:
            cost = CreditsService.get_cost(CreditOperation.GENERATE_DESCRIPTION, pages_count)
            breakdown['descriptions'] = cost
            total += cost
        
        if include_images:
            cost = CreditsService.get_cost(CreditOperation.GENERATE_IMAGE, pages_count)
            breakdown['images'] = cost
            total += cost
        
        breakdown['total'] = total
        return breakdown
