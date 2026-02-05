"""
InvitationCode Model - 邀请码
用户可以生成邀请码分享给他人，双方获得积分奖励
"""
import uuid
import secrets
from datetime import datetime, timezone
from models import db


class InvitationCode(db.Model):
    """邀请码模型"""
    __tablename__ = 'invitation_codes'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # 邀请码（8位随机字符）
    code = db.Column(db.String(16), unique=True, nullable=False, index=True)

    # 邀请人（创建者）
    inviter_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False, index=True)
    inviter = db.relationship('User', foreign_keys=[inviter_id], backref='invitation_codes')

    # 被邀请人（使用者）- 使用后填充
    invitee_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True, index=True)
    invitee = db.relationship('User', foreign_keys=[invitee_id])

    # 状态: active（可用）、used（已使用）、expired（已过期）
    status = db.Column(db.String(16), default='active', index=True)

    # 使用时间
    used_at = db.Column(db.DateTime, nullable=True)

    # 创建时间
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # 过期时间（可选，None 表示永不过期）
    expires_at = db.Column(db.DateTime, nullable=True)

    @staticmethod
    def generate_code():
        """生成8位随机邀请码"""
        # 使用大写字母和数字，排除容易混淆的字符（0OIL1）
        alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
        return ''.join(secrets.choice(alphabet) for _ in range(8))

    @staticmethod
    def create_for_user(user_id: str):
        """为用户创建一个新的邀请码"""
        code = InvitationCode(
            inviter_id=user_id,
            code=InvitationCode.generate_code(),
            status='active'
        )
        db.session.add(code)
        return code

    @staticmethod
    def get_user_codes(user_id: str):
        """获取用户的所有邀请码"""
        return InvitationCode.query.filter_by(inviter_id=user_id).order_by(InvitationCode.created_at.desc()).all()

    @staticmethod
    def get_user_active_codes_count(user_id: str):
        """获取用户的活跃邀请码数量"""
        return InvitationCode.query.filter_by(inviter_id=user_id, status='active').count()

    @staticmethod
    def get_by_code(code: str):
        """通过邀请码查找"""
        return InvitationCode.query.filter_by(code=code.upper()).first()

    def is_valid(self):
        """检查邀请码是否有效"""
        if self.status != 'active':
            return False
        if self.expires_at and datetime.now(timezone.utc) > self.expires_at:
            return False
        return True

    def use(self, invitee_id: str):
        """使用邀请码"""
        self.invitee_id = invitee_id
        self.status = 'used'
        self.used_at = datetime.now(timezone.utc)

    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'code': self.code,
            'inviter_id': self.inviter_id,
            'invitee_id': self.invitee_id,
            'status': self.status,
            'used_at': self.used_at.isoformat() if self.used_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
        }
