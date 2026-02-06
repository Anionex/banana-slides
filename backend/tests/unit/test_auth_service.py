"""
Auth service unit tests - service layer
"""
import pytest
from datetime import datetime, timezone, timedelta


class TestAuthServiceRegister:
    """注册服务测试"""

    def test_register_success(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            user, error = AuthService.register('newuser@example.com', 'password123', 'newuser')
            assert user is not None
            assert error is None
            assert user.email == 'newuser@example.com'
            assert user.credits_balance > 0

    def test_register_invalid_email(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            user, error = AuthService.register('invalid-email', 'password123')
            assert user is None
            assert error is not None

    def test_register_empty_email(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            user, error = AuthService.register('', 'password123')
            assert user is None

    def test_register_short_password(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            user, error = AuthService.register('short@example.com', '123')
            assert user is None
            assert '8' in error

    def test_register_disposable_email(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            user, error = AuthService.register('test@mailinator.com', 'password123')
            assert user is None
            assert '临时邮箱' in error

    def test_register_duplicate_email(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            AuthService.register('dup@example.com', 'password123')
            user, error = AuthService.register('dup@example.com', 'password456')
            assert user is None
            assert '已被注册' in error

    def test_register_case_insensitive_email(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            AuthService.register('Case@Example.COM', 'password123')
            user, error = AuthService.register('case@example.com', 'password456')
            assert user is None
            assert '已被注册' in error

    def test_register_email_trimmed(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            user, error = AuthService.register('  trimmed@example.com  ', 'password123')
            assert user is not None
            assert user.email == 'trimmed@example.com'


class TestAuthServiceLogin:
    """登录服务测试"""

    def test_login_success(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            AuthService.register('login@example.com', 'password123')
            user, error = AuthService.login('login@example.com', 'password123')
            assert user is not None
            assert error is None

    def test_login_wrong_password(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            AuthService.register('loginwrong@example.com', 'password123')
            user, error = AuthService.login('loginwrong@example.com', 'wrongpass')
            assert user is None
            assert '邮箱或密码错误' in error

    def test_login_nonexistent_user(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            user, error = AuthService.login('noone@example.com', 'password123')
            assert user is None

    def test_login_inactive_user(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            from models import db
            user, _ = AuthService.register('inactive@example.com', 'password123')
            user.is_active = False
            db.session.commit()
            result, error = AuthService.login('inactive@example.com', 'password123')
            assert result is None
            assert '禁用' in error

    def test_login_updates_last_login(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            AuthService.register('lastlogin@example.com', 'password123')
            user, _ = AuthService.login('lastlogin@example.com', 'password123')
            assert user.last_login_at is not None


class TestAuthServiceTokens:
    """JWT Token 测试"""

    def test_generate_access_token(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            user, _ = AuthService.register('token@example.com', 'password123')
            token = AuthService.generate_access_token(user)
            assert token is not None
            assert isinstance(token, str)

    def test_verify_access_token(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            user, _ = AuthService.register('verify@example.com', 'password123')
            token = AuthService.generate_access_token(user)
            verified = AuthService.verify_access_token(token)
            assert verified is not None
            assert verified.id == user.id

    def test_verify_invalid_access_token(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            result = AuthService.verify_access_token('invalid.token.here')
            assert result is None

    def test_verify_refresh_token_as_access_fails(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            user, _ = AuthService.register('wrongtype@example.com', 'password123')
            refresh = AuthService.generate_refresh_token(user)
            result = AuthService.verify_access_token(refresh)
            assert result is None

    def test_generate_tokens(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            user, _ = AuthService.register('tokens@example.com', 'password123')
            tokens = AuthService.generate_tokens(user)
            assert 'access_token' in tokens
            assert 'refresh_token' in tokens
            assert tokens['token_type'] == 'Bearer'
            assert tokens['expires_in'] > 0

    def test_refresh_access_token(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            user, _ = AuthService.register('refresh@example.com', 'password123')
            tokens = AuthService.generate_tokens(user)
            new_tokens, error = AuthService.refresh_access_token(tokens['refresh_token'])
            assert new_tokens is not None
            assert error is None
            assert 'access_token' in new_tokens

    def test_refresh_invalid_token(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            new_tokens, error = AuthService.refresh_access_token('invalid')
            assert new_tokens is None
            assert error is not None

    def test_refresh_inactive_user(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            from models import db
            user, _ = AuthService.register('refrsh_inact@example.com', 'password123')
            tokens = AuthService.generate_tokens(user)
            user.is_active = False
            db.session.commit()
            new_tokens, error = AuthService.refresh_access_token(tokens['refresh_token'])
            assert new_tokens is None
            assert '禁用' in error


class TestAuthServiceChangePassword:
    """密码修改服务测试"""

    def test_change_password_success(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            user, _ = AuthService.register('chpwd@example.com', 'oldpass123')
            success, error = AuthService.change_password(user, 'oldpass123', 'newpass456')
            assert success is True
            logged_in, _ = AuthService.login('chpwd@example.com', 'newpass456')
            assert logged_in is not None

    def test_change_password_wrong_current(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            user, _ = AuthService.register('chpwd2@example.com', 'oldpass123')
            success, error = AuthService.change_password(user, 'wrongcurrent', 'newpass456')
            assert success is False
            assert '当前密码错误' in error

    def test_change_password_too_short(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            user, _ = AuthService.register('chpwd3@example.com', 'oldpass123')
            success, error = AuthService.change_password(user, 'oldpass123', '123')
            assert success is False
            assert '8' in error


class TestAuthServiceEmailVerification:
    """邮箱验证服务测试"""

    def test_verify_email_success(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            from utils.security import generate_verification_code, hash_password
            from models import db, User

            code, expires = generate_verification_code()
            user = User(
                email='emailverify_ok@example.com',
                password_hash=hash_password('password123'),
                verification_token=code,
                verification_token_expires=expires,
                email_verified=False,
                subscription_plan='free',
                credits_balance=50,
            )
            db.session.add(user)
            db.session.commit()

            verified_user, error = AuthService.verify_email('emailverify_ok@example.com', code)
            assert verified_user is not None
            assert error is None
            assert verified_user.email_verified is True

    def test_verify_email_wrong_code(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            from models import db, User
            from utils.security import hash_password, generate_verification_code

            code, expires = generate_verification_code()
            user = User(
                email='emailverify_wrong@example.com',
                password_hash=hash_password('password123'),
                verification_token=code,
                verification_token_expires=expires,
                email_verified=False,
                subscription_plan='free',
                credits_balance=50,
            )
            db.session.add(user)
            db.session.commit()

            _, error = AuthService.verify_email('emailverify_wrong@example.com', '000000')
            assert error is not None
            assert '验证码错误' in error

    def test_verify_nonexistent_email(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            _, error = AuthService.verify_email('nobody_verify@example.com', '123456')
            assert error is not None


class TestAuthServicePasswordReset:
    """密码重置服务测试"""

    def test_request_password_reset(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            AuthService.register('reset@example.com', 'password123')
            user, error = AuthService.request_password_reset('reset@example.com')
            assert user is not None
            assert user.password_reset_token is not None

    def test_request_reset_nonexistent(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            user, error = AuthService.request_password_reset('noone@example.com')
            assert user is None
            assert error is None

    def test_reset_password_success(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            AuthService.register('doreset@example.com', 'password123')
            user, _ = AuthService.request_password_reset('doreset@example.com')
            token = user.password_reset_token

            result, error = AuthService.reset_password(token, 'newpassword456')
            assert result is not None
            assert error is None

            logged_in, _ = AuthService.login('doreset@example.com', 'newpassword456')
            assert logged_in is not None

    def test_reset_password_invalid_token(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            result, error = AuthService.reset_password('invalid-token', 'newpass123')
            assert result is None
            assert '无效' in error

    def test_reset_password_too_short(self, client):
        with client.application.app_context():
            from services.auth_service import AuthService
            result, error = AuthService.reset_password('any-token', '123')
            assert result is None
            assert '8' in error
