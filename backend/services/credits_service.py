"""
Credits Service - manages user credits for SaaS billing
积分制服务 - 管理用户积分消耗和充值
"""
import logging
from datetime import datetime, timezone
from typing import Optional, Tuple, Dict, Any
from enum import Enum

from models import db, User
from models.credit_transaction import CreditTransaction

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
    INVITATION = "invitation"                       # 邀请奖励
    REGISTRATION = "registration"                   # 注册奖励


# 默认积分消耗配置（如果 SystemConfig 不可用时的回退值）
DEFAULT_CREDIT_COSTS: Dict[CreditOperation, int] = {
    CreditOperation.GENERATE_OUTLINE: 5,
    CreditOperation.GENERATE_DESCRIPTION: 1,        # 每页
    CreditOperation.GENERATE_IMAGE: 8,              # 每页
    CreditOperation.EDIT_IMAGE: 8,
    CreditOperation.GENERATE_MATERIAL: 10,
    CreditOperation.REFINE_OUTLINE: 2,
    CreditOperation.REFINE_DESCRIPTION: 1,
    CreditOperation.PARSE_FILE: 5,
    CreditOperation.EXPORT_EDITABLE: 15,            # 每页
}


def get_credit_costs() -> Dict[CreditOperation, int]:
    """从 SystemConfig 获取积分消耗配置"""
    try:
        from models import SystemConfig
        config = SystemConfig.get_instance()
        return {
            CreditOperation.GENERATE_OUTLINE: config.cost_generate_outline,
            CreditOperation.GENERATE_DESCRIPTION: config.cost_generate_description,
            CreditOperation.GENERATE_IMAGE: config.cost_generate_image,
            CreditOperation.EDIT_IMAGE: config.cost_edit_image,
            CreditOperation.GENERATE_MATERIAL: config.cost_generate_material,
            CreditOperation.REFINE_OUTLINE: config.cost_refine_outline,
            CreditOperation.REFINE_DESCRIPTION: config.cost_refine_description,
            CreditOperation.PARSE_FILE: config.cost_parse_file,
            CreditOperation.EXPORT_EDITABLE: config.cost_export_editable,
        }
    except Exception as e:
        logger.warning(f"Failed to load credit costs from SystemConfig, using defaults: {e}")
        return DEFAULT_CREDIT_COSTS


# 保持向后兼容的常量（但实际使用时应调用 get_credit_costs()）
CREDIT_COSTS = DEFAULT_CREDIT_COSTS


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
        costs = get_credit_costs()
        base_cost = costs.get(operation, 0)
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
        消耗用户积分（原子操作，防止并发超扣）

        使用 SQL 级别的 UPDATE ... WHERE credits_balance >= cost 保证原子性，
        避免并发请求通过 ORM 内存值绕过余额检查。

        Args:
            user: 用户对象
            operation: 操作类型
            quantity: 数量
            description: 操作描述（可选）

        Returns:
            Tuple of (success, error_message)
        """
        cost = CreditsService.get_cost(operation, quantity)

        try:
            # 原子扣减：只有余额充足时才更新，防止并发超扣
            result = db.session.execute(
                db.update(User)
                .where(User.id == user.id, User.credits_balance >= cost)
                .values(
                    credits_balance=User.credits_balance - cost,
                    credits_used_total=User.credits_used_total + cost,
                )
            )

            if result.rowcount == 0:
                # 余额不足（或并发请求已消耗），刷新 ORM 对象获取最新余额
                db.session.refresh(user)
                logger.warning(f"User {user.id} has insufficient credits: {user.credits_balance} < {cost}")
                return False, f"积分不足，需要 {cost} 积分，当前余额 {user.credits_balance}"

            # 刷新 ORM 对象，使其与数据库保持一致
            db.session.refresh(user)

            transaction = CreditTransaction(
                user_id=user.id,
                operation=operation.value,
                amount=-cost,
                balance_after=user.credits_balance,
                description=description,
            )
            db.session.add(transaction)
            db.session.commit()

            logger.info(f"User {user.id} consumed {cost} credits for {operation.value}, balance: {user.credits_balance}")
            return True, None

        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to consume credits for user {user.id}: {e}")
            return False, "积分扣除失败，请稍后重试"

    @staticmethod
    def refund_credits(
        user_id: str,
        operation: CreditOperation,
        quantity: int = 1,
        description: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        退还用户积分（任务失败时调用）

        使用 SQL 级别原子操作退还，创建 REFUND 交易记录。

        Args:
            user_id: 用户ID（异步任务中可能没有 ORM 对象）
            operation: 原始操作类型（用于计算退还金额）
            quantity: 数量
            description: 退还原因描述

        Returns:
            Tuple of (success, error_message)
        """
        refund_amount = CreditsService.get_cost(operation, quantity)
        if refund_amount <= 0:
            return True, None

        try:
            # 原子退还
            db.session.execute(
                db.update(User)
                .where(User.id == user_id)
                .values(
                    credits_balance=User.credits_balance + refund_amount,
                )
            )

            # 查询最新余额用于交易记录
            user = User.query.get(user_id)
            if not user:
                db.session.rollback()
                return False, "用户不存在"

            db.session.refresh(user)

            auto_desc = f"任务失败退还 - {operation.value}"
            if quantity > 1:
                auto_desc += f" x{quantity}"
            if description:
                auto_desc = f"{auto_desc}: {description}"

            transaction = CreditTransaction(
                user_id=user_id,
                operation=CreditOperation.REFUND.value,
                amount=refund_amount,
                balance_after=user.credits_balance,
                description=auto_desc,
            )
            db.session.add(transaction)
            db.session.commit()

            logger.info(f"Refunded {refund_amount} credits to user {user_id} for failed {operation.value}, balance: {user.credits_balance}")
            return True, None

        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to refund credits for user {user_id}: {e}")
            return False, "积分退还失败"

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
            # 原子增加：使用 SQL 级别 UPDATE 防止并发覆盖
            db.session.execute(
                db.update(User)
                .where(User.id == user.id)
                .values(credits_balance=User.credits_balance + amount)
            )
            db.session.refresh(user)

            transaction = CreditTransaction(
                user_id=user.id,
                operation=operation.value,
                amount=amount,
                balance_after=user.credits_balance,
                description=description,
            )
            db.session.add(transaction)
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

    @staticmethod
    def get_transactions(
        user: User,
        limit: int = 20,
        offset: int = 0
    ) -> Tuple[list, int]:
        """
        获取用户积分交易记录（分页，按时间倒序）

        Args:
            user: 用户对象
            limit: 每页条数
            offset: 偏移量

        Returns:
            Tuple of (transactions list[dict], total count)
        """
        query = CreditTransaction.query.filter_by(user_id=user.id)
        total = query.count()
        transactions = (
            query
            .order_by(CreditTransaction.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return [t.to_dict() for t in transactions], total
