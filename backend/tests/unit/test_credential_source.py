"""
Credential source arbitration tests.

Verifies that build_effective_settings_override tracks per-field sources
correctly and that credits are bypassed when the user provides their own key.
"""
import os
import pytest
from unittest.mock import patch

os.environ['SKIP_EMAIL_VERIFICATION'] = 'true'


class TestFieldSourceTracking:
    """build_effective_settings_override field_sources tracking"""

    def test_user_no_key_returns_platform(self, app, client):
        """用户未设密钥 (NULL) → platform"""
        with app.app_context():
            from models import db, User, Settings
            from models.user_settings import UserSettings
            from services.runtime_settings import ServiceType, is_user_owned_credential

            settings = Settings.get_settings()
            settings.api_key = 'sk-platform-key'
            db.session.commit()

            user = User(email='nokey@test.com', password_hash='x', credits_balance=100)
            db.session.add(user)
            db.session.commit()
            UserSettings.get_or_create_for_user(user.id)

            assert is_user_owned_credential(user.id, ServiceType.TEXT_MODEL) is False

    def test_user_own_key_returns_user_owned(self, app, client):
        """用户设了与平台不同的密钥 → user"""
        with app.app_context():
            from models import db, User, Settings, SystemConfig
            from models.user_settings import UserSettings
            from services.runtime_settings import ServiceType, is_user_owned_credential

            settings = Settings.get_settings()
            settings.api_key = 'sk-platform-key'
            config = SystemConfig.get_instance()
            config.set_user_editable_fields(['api_key', 'output_language'])
            db.session.commit()

            user = User(email='ownkey@test.com', password_hash='x', credits_balance=100)
            db.session.add(user)
            db.session.commit()

            us = UserSettings.get_or_create_for_user(user.id)
            us.api_key = 'sk-my-personal-key'
            db.session.commit()

            assert is_user_owned_credential(user.id, ServiceType.TEXT_MODEL) is True

    def test_different_service_types(self, app, client):
        """不同 ServiceType 分别判断各自的凭据字段"""
        with app.app_context():
            from models import db, User, Settings, SystemConfig
            from models.user_settings import UserSettings
            from services.runtime_settings import ServiceType, is_user_owned_credential

            settings = Settings.get_settings()
            settings.api_key = 'sk-platform'
            settings.mineru_token = 'mineru-platform'
            config = SystemConfig.get_instance()
            config.set_user_editable_fields(['api_key', 'mineru_token', 'output_language'])
            db.session.commit()

            user = User(email='mixed@test.com', password_hash='x', credits_balance=100)
            db.session.add(user)
            db.session.commit()

            us = UserSettings.get_or_create_for_user(user.id)
            us.api_key = 'sk-my-own'
            us.mineru_token = None
            db.session.commit()

            assert is_user_owned_credential(user.id, ServiceType.TEXT_MODEL) is True
            assert is_user_owned_credential(user.id, ServiceType.IMAGE_MODEL) is True
            assert is_user_owned_credential(user.id, ServiceType.MINERU) is False

    def test_revoked_editable_field_falls_back_to_platform(self, app, client):
        """管理员撤回字段编辑权限 → 即使用户有值也回退平台默认"""
        with app.app_context():
            from models import db, User, Settings, SystemConfig
            from models.user_settings import UserSettings
            from services.runtime_settings import (
                ServiceType, is_user_owned_credential,
                build_effective_settings_override, EffectiveSettingsResult,
            )

            settings = Settings.get_settings()
            settings.api_key = 'sk-platform'
            db.session.commit()

            # Admin allows api_key editing
            config = SystemConfig.get_instance()
            config.set_user_editable_fields(['api_key', 'output_language'])
            db.session.commit()

            user = User(email='revoked@test.com', password_hash='x', credits_balance=100)
            db.session.add(user)
            db.session.commit()

            us = UserSettings.get_or_create_for_user(user.id)
            us.api_key = 'sk-user-saved'
            db.session.commit()

            # With permission → user-owned
            assert is_user_owned_credential(user.id, ServiceType.TEXT_MODEL) is True

            # Admin revokes api_key editing
            config.set_user_editable_fields(['output_language'])
            db.session.commit()

            # Without permission → falls back to platform
            assert is_user_owned_credential(user.id, ServiceType.TEXT_MODEL) is False

            # Effective value should be the platform key, not user's
            result = build_effective_settings_override(user.id, _return_sources=True)
            assert result.field_sources['api_key'] == 'platform'


class TestCreditsBypassWithOwnKey:
    """用户自带密钥时积分扣费绕过测试"""

    def test_consume_credits_skipped_for_own_key(self, app, client):
        """用户自带密钥 → consume_credits 不扣积分"""
        with app.app_context():
            from models import db, User, Settings, SystemConfig
            from models.user_settings import UserSettings
            from services.credits_service import CreditsService, CreditOperation

            settings = Settings.get_settings()
            settings.api_key = 'sk-platform'
            config = SystemConfig.get_instance()
            config.set_user_editable_fields(['api_key', 'output_language'])
            db.session.commit()

            user = User(email='bypass@test.com', password_hash='x', credits_balance=100)
            db.session.add(user)
            db.session.commit()

            us = UserSettings.get_or_create_for_user(user.id)
            us.api_key = 'sk-user-own'
            db.session.commit()

            success, err = CreditsService.consume_credits(user, CreditOperation.GENERATE_OUTLINE)
            assert success is True
            assert err is None

            db.session.refresh(user)
            assert user.credits_balance == 100  # unchanged

    def test_consume_credits_deducted_for_platform_key(self, app, client):
        """使用平台密钥 → 正常扣积分"""
        with app.app_context():
            from models import db, User, Settings
            from models.user_settings import UserSettings
            from services.credits_service import CreditsService, CreditOperation

            settings = Settings.get_settings()
            settings.api_key = 'sk-platform'
            db.session.commit()

            user = User(email='deduct@test.com', password_hash='x', credits_balance=100)
            db.session.add(user)
            db.session.commit()
            UserSettings.get_or_create_for_user(user.id)

            success, err = CreditsService.consume_credits(user, CreditOperation.GENERATE_OUTLINE)
            assert success is True

            db.session.refresh(user)
            assert user.credits_balance == 95  # 100 - 5

    def test_check_credits_skipped_for_own_key(self, app, client):
        """用户自带密钥 → check_credits 跳过检查，即使余额为 0"""
        with app.app_context():
            from models import db, User, Settings, SystemConfig
            from models.user_settings import UserSettings
            from services.credits_service import CreditsService, CreditOperation

            settings = Settings.get_settings()
            settings.api_key = 'sk-platform'
            config = SystemConfig.get_instance()
            config.set_user_editable_fields(['api_key', 'output_language'])
            db.session.commit()

            user = User(email='zerobal@test.com', password_hash='x', credits_balance=0)
            db.session.add(user)
            db.session.commit()

            us = UserSettings.get_or_create_for_user(user.id)
            us.api_key = 'sk-user-own'
            db.session.commit()

            has_enough, required = CreditsService.check_credits(user, CreditOperation.GENERATE_IMAGE)
            assert has_enough is True
            assert required == 0

    def test_refund_skipped_for_own_key(self, app, client):
        """用户自带密钥 → refund_credits 不退积分（因为本就没扣）"""
        with app.app_context():
            from models import db, User, Settings, SystemConfig
            from models.user_settings import UserSettings
            from services.credits_service import CreditsService, CreditOperation

            settings = Settings.get_settings()
            settings.api_key = 'sk-platform'
            config = SystemConfig.get_instance()
            config.set_user_editable_fields(['api_key', 'output_language'])
            db.session.commit()

            user = User(email='refund@test.com', password_hash='x', credits_balance=50)
            db.session.add(user)
            db.session.commit()

            us = UserSettings.get_or_create_for_user(user.id)
            us.api_key = 'sk-user-own'
            db.session.commit()

            success, err = CreditsService.refund_credits(user.id, CreditOperation.GENERATE_OUTLINE)
            assert success is True

            db.session.refresh(user)
            assert user.credits_balance == 50  # unchanged
