"""SMS verification service - supports mock, Aliyun Dysmsapi, and Tencent providers."""
import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import uuid
from datetime import datetime, timedelta
from urllib.parse import quote

logger = logging.getLogger(__name__)


def _cfg(*names: str, default: str = '') -> str:
    """Read config from the reference-style dotted keys first, with legacy env fallback."""
    for name in names:
        value = (os.getenv(name) or '').strip()
        if value:
            return value
        value = (os.getenv(name.upper()) or '').strip()
        if value:
            return value
    return default


def _int_cfg(*names: str, default: int) -> int:
    try:
        return max(1, int(_cfg(*names, default=str(default))))
    except ValueError:
        return default


def _sms_provider() -> str:
    return _cfg('sms.provider', 'SMS_PROVIDER', default='mock').lower()


def _generate_code() -> str:
    mock_code = _cfg('sms.mock_code', 'SMS_MOCK_CODE')
    if _sms_provider() == 'mock' and mock_code:
        return mock_code
    return f"{secrets.randbelow(1_000_000):06d}"


def send_sms(phone: str, code: str) -> bool:
    """Send SMS verification code. Returns True on success."""
    provider = _sms_provider()
    if provider == 'mock':
        logger.info("[SMS MOCK] phone=%s code=%s", _mask_phone(phone), code)
        return True
    if provider == 'tencent':
        return _send_tencent(phone, code)
    if provider in ('aliyun', 'dysmsapi'):
        return _send_aliyun(phone, code)
    if provider == 'dypnsapi':
        logger.error("Dypnsapi is for phone-number authentication, not SMS code delivery")
        return False

    logger.error("Unknown SMS provider: %s", provider)
    return False


def _mask_phone(phone: str) -> str:
    if len(phone) < 7:
        return phone
    return phone[:3] + '****' + phone[-4:]


def _send_tencent(phone: str, code: str) -> bool:
    try:
        from tencentcloud.common import credential
        from tencentcloud.sms.v20210111 import sms_client, models

        secret_id = _cfg('SMS_SECRET_ID', 'SMS_ACCESS_KEY_ID')
        secret_key = _cfg('SMS_SECRET_KEY', 'SMS_ACCESS_KEY_SECRET')
        app_id = _cfg('SMS_APP_ID', 'SMS_TENCENT_APP_ID')
        sign_name = _cfg('SMS_SIGN_NAME')
        template_id = _cfg('SMS_TEMPLATE_ID', 'SMS_TEMPLATE_CODE')

        if not all((secret_id, secret_key, app_id, sign_name, template_id)):
            logger.error("Tencent SMS is not configured")
            return False

        cred = credential.Credential(secret_id, secret_key)
        client = sms_client.SmsClient(cred, _cfg('sms.region_id', 'SMS_REGION_ID', default='ap-guangzhou'))
        req = models.SendSmsRequest()
        req.SmsSdkAppId = app_id
        req.SignName = sign_name
        req.TemplateId = template_id
        req.TemplateParamSet = [code, str(_int_cfg('sms.code_ttl_minutes', 'SMS_CODE_TTL_MINUTES', default=5))]
        req.PhoneNumberSet = [phone if phone.startswith('+') else f'+86{phone}']
        resp = client.SendSms(req)
        status = resp.SendStatusSet[0] if resp.SendStatusSet else None
        if status and status.Code == 'Ok':
            return True
        logger.error("Tencent SMS failed: %s", status.Message if status else 'no status')
        return False
    except Exception as exc:
        logger.error("Tencent SMS error: %s", exc)
        return False


def _send_aliyun(phone: str, code: str) -> bool:
    try:
        import httpx

        access_key_id = _cfg('sms.access_key_id', 'SMS_ACCESS_KEY_ID', 'SMS_SECRET_ID')
        access_key_secret = _cfg('sms.access_key_secret', 'SMS_ACCESS_KEY_SECRET', 'SMS_SECRET_KEY')
        sign_name = _cfg('sms.sign_name', 'SMS_SIGN_NAME')
        template_code = _cfg('sms.template_code', 'SMS_TEMPLATE_CODE', 'SMS_TEMPLATE_ID')
        if not all((access_key_id, access_key_secret, sign_name, template_code)):
            logger.error("Aliyun SMS is not configured")
            return False

        params = _aliyun_signed_params(
            access_key_id=access_key_id,
            access_key_secret=access_key_secret,
            phone=phone,
            sign_name=sign_name,
            template_code=template_code,
            template_param=json.dumps({'code': code}, ensure_ascii=False, separators=(',', ':')),
        )
        endpoint = _cfg('sms.endpoint', 'SMS_ENDPOINT', default='https://dysmsapi.aliyuncs.com/')
        resp = httpx.post(endpoint, data=params, timeout=10)
        data = resp.json()
        if data.get('Code') == 'OK':
            return True
        logger.error("Aliyun SMS failed: %s - %s", data.get('Code'), data.get('Message'))
        return False
    except Exception as exc:
        logger.error("Aliyun SMS error: %s", exc)
        return False


def _aliyun_percent_encode(value: str) -> str:
    return quote(value, safe='~')


def _aliyun_signed_params(
    *,
    access_key_id: str,
    access_key_secret: str,
    phone: str,
    sign_name: str,
    template_code: str,
    template_param: str,
) -> dict:
    params = {
        'AccessKeyId': access_key_id,
        'Action': 'SendSms',
        'Format': 'JSON',
        'PhoneNumbers': phone,
        'RegionId': _cfg('sms.region_id', 'SMS_REGION_ID', default='cn-hangzhou'),
        'SignName': sign_name,
        'SignatureMethod': 'HMAC-SHA1',
        'SignatureNonce': str(uuid.uuid4()),
        'SignatureVersion': '1.0',
        'TemplateCode': template_code,
        'TemplateParam': template_param,
        'Timestamp': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        'Version': '2017-05-25',
    }
    canonical = '&'.join(
        f"{_aliyun_percent_encode(k)}={_aliyun_percent_encode(str(params[k]))}"
        for k in sorted(params)
    )
    string_to_sign = 'POST&%2F&' + _aliyun_percent_encode(canonical)
    digest = hmac.new(
        (access_key_secret + '&').encode('utf-8'),
        string_to_sign.encode('utf-8'),
        hashlib.sha1,
    ).digest()
    params['Signature'] = base64.b64encode(digest).decode('ascii')
    return params


def create_sms_code(phone: str) -> str:
    """Create and persist a new SMS code, return the code string."""
    from models import db, SmsCode
    code = _generate_code()
    SmsCode.query.filter_by(phone=phone, used=False).update({'used': True})
    db.session.add(SmsCode(
        phone=phone,
        code=code,
        expires_at=datetime.utcnow() + timedelta(
            minutes=_int_cfg('sms.code_ttl_minutes', 'SMS_CODE_TTL_MINUTES', default=5)
        ),
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
    """Returns (allowed, error_message). Limits: 1/min, configurable per day."""
    from models import SmsCode
    now = datetime.utcnow()
    one_min_ago = now - timedelta(minutes=1)
    one_day_ago = now - timedelta(days=1)
    daily_limit = _int_cfg('sms.rate_limit_per_day', 'SMS_RATE_LIMIT_PER_DAY', default=5)

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
    if recent_day >= daily_limit:
        return False, '今日发送次数已达上限'

    return True, ''
