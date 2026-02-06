"""
Security utilities unit tests
"""
import pytest
from datetime import datetime, timezone, timedelta


class TestHashPassword:
    """密码哈希测试"""

    def test_hash_returns_salt_hash_format(self):
        from utils.security import hash_password
        result = hash_password('password123')
        assert '$' in result
        parts = result.split('$')
        assert len(parts) == 2
        assert len(parts[0]) == 64  # 32 bytes hex = 64 chars
        assert len(parts[1]) == 64  # sha256 hex

    def test_different_passwords_different_hashes(self):
        from utils.security import hash_password
        h1 = hash_password('password1')
        h2 = hash_password('password2')
        assert h1 != h2

    def test_same_password_different_salts(self):
        from utils.security import hash_password
        h1 = hash_password('samepass')
        h2 = hash_password('samepass')
        # Different salts should produce different hashes
        assert h1 != h2


class TestVerifyPassword:
    """密码验证测试"""

    def test_correct_password(self):
        from utils.security import hash_password, verify_password
        hashed = hash_password('mypassword')
        assert verify_password('mypassword', hashed) is True

    def test_wrong_password(self):
        from utils.security import hash_password, verify_password
        hashed = hash_password('mypassword')
        assert verify_password('wrongpassword', hashed) is False

    def test_empty_password(self):
        from utils.security import hash_password, verify_password
        hashed = hash_password('')
        assert verify_password('', hashed) is True
        assert verify_password('notempty', hashed) is False

    def test_invalid_hash_format(self):
        from utils.security import verify_password
        assert verify_password('test', 'invalidhash') is False
        assert verify_password('test', '') is False

    def test_none_hash(self):
        from utils.security import verify_password
        assert verify_password('test', None) is False


class TestGenerateToken:
    """Token生成测试"""

    def test_default_length(self):
        from utils.security import generate_token
        token = generate_token()
        assert len(token) == 64  # 32 bytes hex

    def test_custom_length(self):
        from utils.security import generate_token
        token = generate_token(16)
        assert len(token) == 32  # 16 bytes hex

    def test_uniqueness(self):
        from utils.security import generate_token
        tokens = {generate_token() for _ in range(100)}
        assert len(tokens) == 100


class TestGenerateVerificationCode:
    """验证码生成测试"""

    def test_default_code(self):
        from utils.security import generate_verification_code
        code, expires = generate_verification_code()
        assert len(code) == 6
        assert code.isdigit()
        assert expires > datetime.now(timezone.utc)

    def test_custom_length(self):
        from utils.security import generate_verification_code
        code, _ = generate_verification_code(length=4)
        assert len(code) == 4
        assert code.isdigit()

    def test_expiration(self):
        from utils.security import generate_verification_code
        _, expires = generate_verification_code(expires_minutes=30)
        now = datetime.now(timezone.utc)
        # Should expire between 29 and 31 minutes from now
        diff = (expires - now).total_seconds()
        assert 29 * 60 < diff < 31 * 60


class TestIsTokenExpired:
    """Token过期检查测试"""

    def test_not_expired(self):
        from utils.security import is_token_expired
        future = datetime.now(timezone.utc) + timedelta(hours=1)
        assert is_token_expired(future) is False

    def test_expired(self):
        from utils.security import is_token_expired
        past = datetime.now(timezone.utc) - timedelta(hours=1)
        assert is_token_expired(past) is True

    def test_none_expires(self):
        from utils.security import is_token_expired
        assert is_token_expired(None) is True

    def test_timezone_naive_datetime(self):
        from utils.security import is_token_expired
        future = datetime.utcnow() + timedelta(hours=1)
        assert is_token_expired(future) is False

    def test_just_expired(self):
        from utils.security import is_token_expired
        past = datetime.now(timezone.utc) - timedelta(seconds=1)
        assert is_token_expired(past) is True
