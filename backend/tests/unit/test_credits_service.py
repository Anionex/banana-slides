"""
积分服务单元测试 - SaaS版本
"""
import os
import pytest


# 测试期间跳过邮箱验证
os.environ['SKIP_EMAIL_VERIFICATION'] = 'true'


class TestCreditsService:
    """积分服务测试"""

    def test_get_cost_single(self, app):
        """测试单次操作积分消耗"""
        with app.app_context():
            from services.credits_service import CreditsService, CreditOperation

            cost = CreditsService.get_cost(CreditOperation.GENERATE_OUTLINE)
            assert cost == 5  # 默认大纲生成消耗5积分

    def test_get_cost_multiple(self, app):
        """测试批量操作积分消耗"""
        with app.app_context():
            from services.credits_service import CreditsService, CreditOperation

            # 5页图片生成
            cost = CreditsService.get_cost(CreditOperation.GENERATE_IMAGE, 5)
            assert cost == 50  # 10 * 5 = 50

    def test_check_credits_sufficient(self, app, client):
        """测试积分充足检查"""
        with app.app_context():
            from models import db, User
            from services.credits_service import CreditsService, CreditOperation

            # 创建有积分的用户
            user = User(
                email='richuser@example.com',
                password_hash='test',
                credits_balance=100
            )
            db.session.add(user)
            db.session.commit()

            has_enough, required = CreditsService.check_credits(
                user, CreditOperation.GENERATE_OUTLINE
            )
            assert has_enough is True
            assert required == 5

    def test_check_credits_insufficient(self, app, client):
        """测试积分不足检查"""
        with app.app_context():
            from models import db, User
            from services.credits_service import CreditsService, CreditOperation

            # 创建积分不足的用户
            user = User(
                email='pooruser@example.com',
                password_hash='test',
                credits_balance=3
            )
            db.session.add(user)
            db.session.commit()

            has_enough, required = CreditsService.check_credits(
                user, CreditOperation.GENERATE_OUTLINE
            )
            assert has_enough is False
            assert required == 5

    def test_consume_credits_success(self, app, client):
        """测试积分消耗成功"""
        with app.app_context():
            from models import db, User
            from services.credits_service import CreditsService, CreditOperation

            # 创建用户
            user = User(
                email='consumer@example.com',
                password_hash='test',
                credits_balance=100,
                credits_used_total=0
            )
            db.session.add(user)
            db.session.commit()

            initial_balance = user.credits_balance

            # 消耗积分
            success, error = CreditsService.consume_credits(
                user,
                CreditOperation.GENERATE_OUTLINE,
                description='测试消耗'
            )

            assert success is True
            assert error is None
            assert user.credits_balance == initial_balance - 5
            assert user.credits_used_total == 5

    def test_consume_credits_insufficient(self, app, client):
        """测试积分不足时消耗失败"""
        with app.app_context():
            from models import db, User
            from services.credits_service import CreditsService, CreditOperation

            # 创建积分不足的用户
            user = User(
                email='insufficent@example.com',
                password_hash='test',
                credits_balance=3
            )
            db.session.add(user)
            db.session.commit()

            # 尝试消耗5积分
            success, error = CreditsService.consume_credits(
                user,
                CreditOperation.GENERATE_OUTLINE
            )

            assert success is False
            assert error is not None
            assert '积分不足' in error
            assert user.credits_balance == 3  # 余额不变

    def test_add_credits_success(self, app, client):
        """测试增加积分"""
        with app.app_context():
            from models import db, User
            from services.credits_service import CreditsService, CreditOperation

            user = User(
                email='addcredits@example.com',
                password_hash='test',
                credits_balance=50
            )
            db.session.add(user)
            db.session.commit()

            # 增加100积分
            success, error = CreditsService.add_credits(
                user,
                100,
                CreditOperation.PURCHASE,
                description='购买积分包'
            )

            assert success is True
            assert error is None
            assert user.credits_balance == 150

    def test_add_credits_invalid_amount(self, app, client):
        """测试增加无效数量的积分"""
        with app.app_context():
            from models import db, User
            from services.credits_service import CreditsService, CreditOperation

            user = User(
                email='invalidadd@example.com',
                password_hash='test',
                credits_balance=50
            )
            db.session.add(user)
            db.session.commit()

            # 尝试增加0或负数积分
            success, error = CreditsService.add_credits(
                user,
                0,
                CreditOperation.BONUS
            )

            assert success is False
            assert error is not None

    def test_refund_credits_success(self, app, client):
        """测试积分退还"""
        with app.app_context():
            from models import db, User
            from services.credits_service import CreditsService, CreditOperation

            user = User(
                email='refund@example.com',
                password_hash='test',
                credits_balance=50
            )
            db.session.add(user)
            db.session.commit()
            user_id = user.id

            # 退还5积分
            success, error = CreditsService.refund_credits(
                user_id,
                CreditOperation.GENERATE_OUTLINE,
                description='任务失败退还'
            )

            # 重新查询用户
            user = User.query.get(user_id)

            assert success is True
            assert error is None
            assert user.credits_balance == 55

    def test_estimate_project_cost(self, app):
        """测试项目积分估算"""
        with app.app_context():
            from services.credits_service import CreditsService

            # 估算5页完整项目
            estimate = CreditsService.estimate_project_cost(
                pages_count=5,
                include_outline=True,
                include_descriptions=True,
                include_images=True
            )

            assert 'outline' in estimate
            assert 'descriptions' in estimate
            assert 'images' in estimate
            assert 'total' in estimate
            # 5 + 2*5 + 10*5 = 5 + 10 + 50 = 65
            assert estimate['total'] == 65

    def test_estimate_project_cost_outline_only(self, app):
        """测试仅大纲的积分估算"""
        with app.app_context():
            from services.credits_service import CreditsService

            estimate = CreditsService.estimate_project_cost(
                pages_count=10,
                include_outline=True,
                include_descriptions=False,
                include_images=False
            )

            assert estimate['total'] == 5

    def test_get_user_credits_info(self, app, client):
        """测试获取用户积分信息"""
        with app.app_context():
            from models import db, User
            from services.credits_service import CreditsService

            user = User(
                email='creditsinfo@example.com',
                password_hash='test',
                credits_balance=100,
                credits_used_total=50,
                subscription_plan='pro'
            )
            db.session.add(user)
            db.session.commit()

            info = CreditsService.get_user_credits_info(user)

            assert info['balance'] == 100
            assert info['used_total'] == 50
            assert info['subscription_plan'] == 'pro'

    def test_get_transactions(self, app, client):
        """测试获取交易记录"""
        with app.app_context():
            from models import db, User
            from services.credits_service import CreditsService, CreditOperation

            user = User(
                email='transactions@example.com',
                password_hash='test',
                credits_balance=100,
                credits_used_total=0
            )
            db.session.add(user)
            db.session.commit()

            # 产生一些交易
            CreditsService.consume_credits(user, CreditOperation.GENERATE_OUTLINE)
            CreditsService.consume_credits(user, CreditOperation.GENERATE_IMAGE)
            CreditsService.add_credits(user, 50, CreditOperation.BONUS)

            transactions, total = CreditsService.get_transactions(user, limit=10)

            assert total == 3
            assert len(transactions) == 3
            # 按时间倒序，最近的在前
            assert transactions[0]['operation'] == 'bonus'


class TestCreditsConcurrency:
    """积分并发安全测试"""

    def test_atomic_consume_prevents_overdraft(self, app, client):
        """测试原子扣减防止超扣"""
        with app.app_context():
            from models import db, User
            from services.credits_service import CreditsService, CreditOperation

            # 创建只有10积分的用户
            user = User(
                email='atomic@example.com',
                password_hash='test',
                credits_balance=10
            )
            db.session.add(user)
            db.session.commit()

            # 消耗5积分
            success1, _ = CreditsService.consume_credits(
                user, CreditOperation.GENERATE_OUTLINE
            )
            assert success1 is True
            assert user.credits_balance == 5

            # 尝试再消耗10积分（生成图片）- 应失败
            success2, error2 = CreditsService.consume_credits(
                user, CreditOperation.GENERATE_IMAGE  # 10积分
            )
            assert success2 is False
            assert user.credits_balance == 5  # 余额不变
