"""
Credits middleware unit tests
"""
import pytest
from flask import g
from conftest import assert_success_response


class TestCheckCreditsMiddleware:
    """@check_credits 装饰器测试"""

    def test_insufficient_credits_consume_fails(self, client):
        """积分不足时，consume_credits应返回失败"""
        with client.application.app_context():
            from services.auth_service import AuthService
            from services.credits_service import CreditsService, CreditOperation
            from models import db

            user, _ = AuthService.register('zerocredits@example.com', 'password123')
            user.credits_balance = 0
            db.session.commit()

            success, error = CreditsService.consume_credits(user, CreditOperation.GENERATE_DESCRIPTION)
            assert success is False
            assert '积分不足' in error

    def test_sufficient_credits_allowed(self, authenticated_client):
        """积分充足应允许操作"""
        proj_resp = authenticated_client.post('/api/projects', json={
            'creation_type': 'idea',
            'idea_prompt': 'Test presentation'
        })
        assert proj_resp.status_code == 201


class TestGetPendingCreditCost:
    """get_pending_credit_cost 测试"""

    def test_returns_zero_without_context(self, app):
        from middlewares.credits import get_pending_credit_cost
        with app.test_request_context():
            assert get_pending_credit_cost() == 0

    def test_returns_cost_from_g(self, app):
        from middlewares.credits import get_pending_credit_cost
        with app.test_request_context():
            g.credit_cost = 10
            assert get_pending_credit_cost() == 10
