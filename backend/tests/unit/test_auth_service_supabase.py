"""Supabase-specific auth service tests."""


class TestAuthServiceSupabaseSync:
    def test_sync_supabase_user_creates_user_and_applies_invitation_bonus(self, client):
        with client.application.app_context():
            from models import db, InvitationCode
            from models.credit_transaction import CreditTransaction
            from services.auth_service import AuthService
            from services.credits_service import CreditOperation

            inviter, error = AuthService.register('inviter@example.com', 'password123', 'inviter')
            assert error is None
            inviter_balance_before = inviter.credits_balance

            invitation = InvitationCode.create_for_user(inviter.id)
            invitation.code = 'INVITE88'
            db.session.commit()

            claims = {
                'sub': 'supabase-user-001',
                'email': 'new-supabase-user@example.com',
                'email_verified': True,
                'user_metadata': {
                    'username': 'supauser',
                    'invitation_code': 'INVITE88',
                },
            }

            user = AuthService.sync_or_create_supabase_user(claims)
            assert user is not None
            assert user.email == 'new-supabase-user@example.com'
            assert user.oidc_provider == 'supabase'
            assert user.oidc_sub == 'supabase-user-001'
            assert user.email_verified is True
            assert user.credits_balance > 50

            db.session.refresh(inviter)
            assert inviter.credits_balance > inviter_balance_before

            invitation = InvitationCode.get_by_code('INVITE88')
            assert invitation is not None
            assert invitation.status == 'used'
            assert invitation.invitee_id == user.id

            operations = {
                tx.operation
                for tx in CreditTransaction.query.filter_by(user_id=user.id).all()
            }
            assert CreditOperation.REGISTRATION.value in operations
            assert CreditOperation.INVITATION.value in operations

    def test_verify_access_token_accepts_supabase_claims_via_decoder(self, client, monkeypatch):
        with client.application.app_context():
            from services.auth_service import AuthService

            claims = {
                'sub': 'supabase-user-verify',
                'email': 'verify-supabase@example.com',
                'email_verified': True,
                'user_metadata': {
                    'username': 'verified-supa',
                },
            }

            monkeypatch.setattr(AuthService, '_verify_local_access_token', classmethod(lambda cls, token: None))
            monkeypatch.setattr(AuthService, '_decode_supabase_access_token', classmethod(lambda cls, token: claims))

            user = AuthService.verify_access_token('supabase.jwt.token')
            assert user is not None
            assert user.email == 'verify-supabase@example.com'
            assert user.oidc_provider == 'supabase'
