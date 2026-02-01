"""
Email Service using Resend
邮件服务 - 使用 Resend.com 发送邮件
https://resend.com/
"""
import os
import logging
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

# Resend SDK
try:
    import resend
    RESEND_AVAILABLE = True
except ImportError:
    RESEND_AVAILABLE = False
    logger.warning("Resend SDK not installed. Run: pip install resend")


class EmailService:
    """邮件服务"""
    
    def __init__(self):
        self.api_key = os.getenv('RESEND_API_KEY', '')
        self.from_email = os.getenv('EMAIL_FROM', 'noreply@bananaslides.online')
        self.from_name = os.getenv('EMAIL_FROM_NAME', 'Banana Slides')
        
        if self.api_key and RESEND_AVAILABLE:
            resend.api_key = self.api_key
        elif not RESEND_AVAILABLE:
            logger.warning("Resend SDK not available")
        else:
            logger.warning("RESEND_API_KEY not configured")
    
    def _get_from_address(self) -> str:
        """获取发件人地址"""
        return f"{self.from_name} <{self.from_email}>"
    
    def send_email(
        self,
        to: str,
        subject: str,
        html: str,
        text: Optional[str] = None,
        reply_to: Optional[str] = None,
        tags: Optional[List[Dict[str, str]]] = None,
    ) -> bool:
        """
        发送邮件
        
        Args:
            to: 收件人邮箱
            subject: 邮件主题
            html: HTML 内容
            text: 纯文本内容（可选）
            reply_to: 回复地址（可选）
            tags: 标签（可选）
            
        Returns:
            是否发送成功
        """
        if not RESEND_AVAILABLE:
            logger.error("Cannot send email: Resend SDK not available")
            return False
        
        if not self.api_key:
            logger.error("Cannot send email: RESEND_API_KEY not configured")
            return False
        
        try:
            params = {
                'from': self._get_from_address(),
                'to': [to],
                'subject': subject,
                'html': html,
            }
            
            if text:
                params['text'] = text
            if reply_to:
                params['reply_to'] = reply_to
            if tags:
                params['tags'] = tags
            
            result = resend.Emails.send(params)
            
            logger.info(f"Email sent to {to}: {result.get('id', 'unknown')}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to}: {e}")
            return False
    
    def send_verification_email(
        self,
        to: str,
        username: str,
        verification_url: str,
    ) -> bool:
        """
        发送邮箱验证邮件
        
        Args:
            to: 收件人邮箱
            username: 用户名
            verification_url: 验证链接
        """
        subject = "验证您的 Banana Slides 账户"
        
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ text-align: center; margin-bottom: 30px; }}
                .logo {{ font-size: 24px; font-weight: bold; color: #1A1A1A; }}
                .logo span {{ color: #FFC700; }}
                .content {{ background: #FFF9E6; border-radius: 8px; padding: 30px; }}
                .button {{ display: inline-block; background: #FFD700; color: #1A1A1A; padding: 12px 24px;
                          text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }}
                .footer {{ text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo"><span>🍌</span> Banana Slides</div>
                </div>
                <div class="content">
                    <h2>欢迎加入 Banana Slides！</h2>
                    <p>您好 {username or '用户'}，</p>
                    <p>感谢您注册 Banana Slides。请点击下面的按钮验证您的邮箱地址：</p>
                    <p style="text-align: center;">
                        <a href="{verification_url}" class="button">验证邮箱</a>
                    </p>
                    <p>如果按钮无法点击，请复制以下链接到浏览器：</p>
                    <p style="word-break: break-all; color: #6b7280; font-size: 12px;">{verification_url}</p>
                    <p>此链接24小时内有效。</p>
                </div>
                <div class="footer">
                    <p>如果您没有注册 Banana Slides，请忽略此邮件。</p>
                    <p>© 2026 Banana Slides. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return self.send_email(
            to=to,
            subject=subject,
            html=html,
            tags=[{'name': 'type', 'value': 'verification'}]
        )
    
    def send_password_reset_email(
        self,
        to: str,
        username: str,
        reset_url: str,
    ) -> bool:
        """
        发送密码重置邮件
        
        Args:
            to: 收件人邮箱
            username: 用户名
            reset_url: 重置链接
        """
        subject = "重置您的 Banana Slides 密码"
        
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ text-align: center; margin-bottom: 30px; }}
                .logo {{ font-size: 24px; font-weight: bold; color: #1A1A1A; }}
                .logo span {{ color: #FFC700; }}
                .content {{ background: #FFF9E6; border-radius: 8px; padding: 30px; }}
                .button {{ display: inline-block; background: #FFD700; color: #1A1A1A; padding: 12px 24px;
                          text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }}
                .footer {{ text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo"><span>🍌</span> Banana Slides</div>
                </div>
                <div class="content">
                    <h2>重置密码</h2>
                    <p>您好 {username or '用户'}，</p>
                    <p>我们收到了重置您 Banana Slides 账户密码的请求。请点击下面的按钮重置密码：</p>
                    <p style="text-align: center;">
                        <a href="{reset_url}" class="button">重置密码</a>
                    </p>
                    <p>如果按钮无法点击，请复制以下链接到浏览器：</p>
                    <p style="word-break: break-all; color: #6b7280; font-size: 12px;">{reset_url}</p>
                    <p>此链接1小时内有效。</p>
                </div>
                <div class="footer">
                    <p>如果您没有请求重置密码，请忽略此邮件。您的密码不会被更改。</p>
                    <p>© 2026 Banana Slides. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return self.send_email(
            to=to,
            subject=subject,
            html=html,
            tags=[{'name': 'type', 'value': 'password_reset'}]
        )
    
    def send_credits_purchase_confirmation(
        self,
        to: str,
        username: str,
        package_name: str,
        credits_amount: int,
        order_id: str,
    ) -> bool:
        """
        发送积分购买确认邮件
        
        Args:
            to: 收件人邮箱
            username: 用户名
            package_name: 套餐名称
            credits_amount: 积分数量
            order_id: 订单号
        """
        subject = f"Banana Slides 积分购买成功 - {package_name}"
        
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ text-align: center; margin-bottom: 30px; }}
                .logo {{ font-size: 24px; font-weight: bold; color: #1A1A1A; }}
                .logo span {{ color: #FFC700; }}
                .content {{ background: #FFF9E6; border-radius: 8px; padding: 30px; }}
                .highlight {{ background: #FFD700; color: #1A1A1A; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }}
                .footer {{ text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo"><span>🍌</span> Banana Slides</div>
                </div>
                <div class="content">
                    <h2>购买成功！</h2>
                    <p>您好 {username or '用户'}，</p>
                    <p>感谢您购买 Banana Slides 积分套餐！</p>
                    <div class="highlight">
                        <div style="font-size: 14px; opacity: 0.9;">{package_name}</div>
                        <div style="font-size: 36px; font-weight: bold; margin: 10px 0;">+{credits_amount}</div>
                        <div style="font-size: 14px; opacity: 0.9;">积分已到账</div>
                    </div>
                    <p><strong>订单号：</strong>{order_id}</p>
                    <p>您现在可以使用这些积分来生成精美的 PPT 了！</p>
                </div>
                <div class="footer">
                    <p>如有任何问题，请联系我们的客服。</p>
                    <p>© 2026 Banana Slides. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return self.send_email(
            to=to,
            subject=subject,
            html=html,
            tags=[{'name': 'type', 'value': 'purchase_confirmation'}]
        )


# 全局实例
email_service = EmailService()
