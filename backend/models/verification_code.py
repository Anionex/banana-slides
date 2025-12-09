"""
Verification Code model for email verification
"""
import uuid
import random
import string
from datetime import datetime, timedelta
from models import db


class VerificationCode(db.Model):
    """Verification code for email verification"""
    __tablename__ = 'verification_codes'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = db.Column(db.String(255), nullable=False, index=True)
    code = db.Column(db.String(6), nullable=False)
    code_type = db.Column(db.String(20), nullable=False)  # 'register', 'reset_password'
    expires_at = db.Column(db.DateTime, nullable=False)
    used = db.Column(db.Boolean, default=False)
    attempts = db.Column(db.Integer, default=0)  # Number of verification attempts
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Code types
    TYPE_REGISTER = 'register'
    TYPE_RESET_PASSWORD = 'reset_password'

    # Configuration
    CODE_LENGTH = 6
    EXPIRY_MINUTES = 5
    MAX_ATTEMPTS = 5
    RATE_LIMIT_SECONDS = 60  # Minimum seconds between sending codes

    @classmethod
    def generate_code(cls) -> str:
        """Generate a random 6-digit verification code"""
        return ''.join(random.choices(string.digits, k=cls.CODE_LENGTH))

    @classmethod
    def create_code(cls, email: str, code_type: str) -> 'VerificationCode':
        """Create a new verification code for the given email"""
        # Invalidate any existing unused codes for this email and type
        cls.query.filter_by(
            email=email.lower(),
            code_type=code_type,
            used=False
        ).update({'used': True})
        db.session.commit()

        # Create new code
        code = cls(
            email=email.lower(),
            code=cls.generate_code(),
            code_type=code_type,
            expires_at=datetime.utcnow() + timedelta(minutes=cls.EXPIRY_MINUTES),
        )
        db.session.add(code)
        db.session.commit()
        return code

    @classmethod
    def can_send_code(cls, email: str, code_type: str) -> tuple[bool, int]:
        """
        Check if a new code can be sent (rate limiting)
        Returns: (can_send, seconds_until_can_send)
        """
        last_code = cls.query.filter_by(
            email=email.lower(),
            code_type=code_type,
        ).order_by(cls.created_at.desc()).first()

        if not last_code:
            return True, 0

        elapsed = (datetime.utcnow() - last_code.created_at).total_seconds()
        if elapsed < cls.RATE_LIMIT_SECONDS:
            return False, int(cls.RATE_LIMIT_SECONDS - elapsed)
        
        return True, 0

    @classmethod
    def verify_code(cls, email: str, code: str, code_type: str) -> tuple[bool, str]:
        """
        Verify a code
        Returns: (is_valid, error_message)
        """
        verification = cls.query.filter_by(
            email=email.lower(),
            code_type=code_type,
            used=False,
        ).order_by(cls.created_at.desc()).first()

        if not verification:
            return False, '验证码不存在或已过期'

        # Check expiry
        if datetime.utcnow() > verification.expires_at:
            return False, '验证码已过期，请重新获取'

        # Check max attempts
        if verification.attempts >= cls.MAX_ATTEMPTS:
            return False, '验证码尝试次数过多，请重新获取'

        # Increment attempts
        verification.attempts += 1
        db.session.commit()

        # Verify code
        if verification.code != code:
            remaining = cls.MAX_ATTEMPTS - verification.attempts
            return False, f'验证码错误，还剩 {remaining} 次尝试机会'

        # Mark as used
        verification.used = True
        db.session.commit()

        return True, ''

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'email': self.email,
            'code_type': self.code_type,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'used': self.used,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
