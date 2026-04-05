"""SMS verification service - supports tencent, aliyun, mock providers"""
import os
import random
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


def _generate_code() -> str:
    return str(random.randint(100000, 999999))


def send_sms(phone: str, code: str) -> bool:
    """Send SMS verification code. Returns True on success."""
    provider = os.getenv('SMS_PROVIDER', 'mock').lower()
    if provider == 'mock':
        logger.info(f"[SMS MOCK] phone={phone} code={code}")
        return True
    elif provider == 'tencent':
        return _send_tencent(phone, code)
    elif provider == 'aliyun':
        return _send_aliyun(phone, code)
    else:
        logger.error(f"Unknown SMS provider: {provider}")
        return False


def _send_tencent(phone: str, code: str) -> bool:
    try:
        from tencentcloud.common import credential
        from tencentcloud.sms.v20210111 import sms_client, models

        secret_id = os.getenv('SMS_SECRET_ID', '')
        secret_key = os.getenv('SMS_SECRET_KEY', '')
        app_id = os.getenv('SMS_APP_ID', '')
        sign_name = os.getenv('SMS_SIGN_NAME', '')
        template_id = os.getenv('SMS_TEMPLATE_ID', '')

        cred = credential.Credential(secret_id, secret_key)
        client = sms_client.SmsClient(cred, 'ap-guangzhou')
        req = models.SendSmsRequest()
        req.SmsSdkAppId = app_id
        req.SignName = sign_name
        req.TemplateId = template_id
        req.TemplateParamSet = [code, '5']
        req.PhoneNumberSet = [f'+86{phone}']
        resp = client.SendSms(req)
        status = resp.SendStatusSet[0] if resp.SendStatusSet else None
        if status and status.Code == 'Ok':
            return True
        logger.error(f"Tencent SMS failed: {status.Message if status else 'no status'}")
        return False
    except Exception as e:
        logger.error(f"Tencent SMS error: {e}")
        return False


def _send_aliyun(phone: str, code: str) -> bool:
    try:
        from alibabacloud_dysmsapi20170525.client import Client
        from alibabacloud_tea_openapi import models as open_api_models
        from alibabacloud_dysmsapi20170525 import models as sms_models
        import json

        config = open_api_models.Config(
            access_key_id=os.getenv('SMS_SECRET_ID', ''),
            access_key_secret=os.getenv('SMS_SECRET_KEY', ''),
        )
        config.endpoint = 'dysmsapi.aliyuncs.com'
        client = Client(config)
        req = sms_models.SendSmsRequest(
            phone_numbers=phone,
            sign_name=os.getenv('SMS_SIGN_NAME', ''),
            template_code=os.getenv('SMS_TEMPLATE_ID', ''),
            template_param=json.dumps({'code': code}),
        )
        resp = client.send_sms(req)
        if resp.body.code == 'OK':
            return True
        logger.error(f"Aliyun SMS failed: {resp.body.message}")
        return False
    except Exception as e:
        logger.error(f"Aliyun SMS error: {e}")
        return False


def create_sms_code(phone: str) -> str:
    """Create and persist a new SMS code, return the code string."""
    from models import db, SmsCode
    code = _generate_code()
    # Invalidate previous unused codes for this phone
    SmsCode.query.filter_by(phone=phone, used=False).update({'used': True})
    db.session.add(SmsCode(
        phone=phone,
        code=code,
        expires_at=datetime.utcnow() + timedelta(minutes=5),
        created_at=datetime.utcnow(),
    ))
    db.session.commit()
    return code


def verify_sms_code(phone: str, code: str) -> bool:
    """Verify code and mark as used. Returns True if valid."""
    from models import db, SmsCode
    record = SmsCode.query.filter_by(phone=phone, code=code, used=False).order_by(SmsCode.id.desc()).first()
    if not record:
        return False
    if datetime.utcnow() > record.expires_at:
        return False
    record.used = True
    db.session.commit()
    return True


def check_rate_limit(phone: str) -> tuple[bool, str]:
    """Returns (allowed, error_message). Limits: 1/min, 5/day."""
    from models import SmsCode
    now = datetime.utcnow()
    one_min_ago = now - timedelta(minutes=1)
    one_day_ago = now - timedelta(days=1)

    recent_1min = SmsCode.query.filter(
        SmsCode.phone == phone,
        SmsCode.created_at >= one_min_ago,
    ).count()
    if recent_1min >= 1:
        return False, '发送太频繁，请1分钟后再试'

    recent_day = SmsCode.query.filter(
        SmsCode.phone == phone,
        SmsCode.created_at >= one_day_ago,
    ).count()
    if recent_day >= 5:
        return False, '今日发送次数已达上限'

    return True, ''
