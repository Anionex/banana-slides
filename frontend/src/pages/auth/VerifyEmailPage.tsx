/**
 * Verify Email Page
 * Supabase 邮箱确认提示页
 */
import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { Button } from '../../components/shared';
import { useT } from '../../hooks/useT';

const verifyEmailI18n = {
  zh: {
    verifyEmail: {
      title: '检查您的邮箱',
      description: '我们刚刚向 {{email}} 发送了一封确认邮件，请点击邮件中的链接完成注册。',
      helper: '确认成功后，页面会自动跳回应用。若未收到邮件，可稍后重新发送。',
      resend: '重新发送确认邮件',
      resendIn: '{{seconds}} 秒后可重发',
      resendSuccess: '确认邮件已重新发送',
      resendFailed: '重发失败，请稍后再试',
      backToLogin: '返回登录',
      backToRegister: '返回注册',
      emailMissing: '缺少邮箱信息，请返回注册页重新提交。',
    },
  },
  en: {
    verifyEmail: {
      title: 'Check your inbox',
      description: 'We sent a confirmation email to {{email}}. Click the link in the email to finish creating your account.',
      helper: 'After confirmation, we will sign you in on the callback route. If you do not see the email, you can resend it below.',
      resend: 'Resend confirmation email',
      resendIn: 'Resend in {{seconds}}s',
      resendSuccess: 'Confirmation email sent again',
      resendFailed: 'Failed to resend email. Please try again.',
      backToLogin: 'Back to login',
      backToRegister: 'Back to sign up',
      emailMissing: 'Missing email information. Please go back and sign up again.',
    },
  },
};

const COOLDOWN_SECONDS = 30;

export default function VerifyEmailPage() {
  const t = useT(verifyEmailI18n);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const email = (location.state as any)?.email || searchParams.get('email') || '';

  const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (!email || cooldown > 0 || loading) {
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      await authApi.resendVerification(email);
      setMessage(t('verifyEmail.resendSuccess'));
      setCooldown(COOLDOWN_SECONDS);
    } catch (err: any) {
      setError(err?.message || t('verifyEmail.resendFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-background-primary relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-banana-100/40 to-transparent dark:from-banana-900/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-orange-100/40 to-transparent dark:from-orange-900/5 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4"></div>
      </div>

      <div className="w-full max-w-md relative z-10 px-6">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-white">
            <span className="text-4xl">🍌</span>
            <span>Banana Slides</span>
          </Link>
        </div>

        <div className="bg-white dark:bg-background-elevated rounded-2xl p-8 shadow-xl border border-gray-200 dark:border-border-primary text-center">
          <div className="w-16 h-16 mx-auto mb-5 bg-banana-100 dark:bg-banana-900/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-banana-600 dark:text-banana-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8m-18 8h18a2 2 0 002-2V8a2 2 0 00-2-2H3a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
          </div>

          <h1 className="text-2xl font-semibold text-gray-900 dark:text-foreground-primary mb-3">
            {t('verifyEmail.title')}
          </h1>

          {email ? (
            <>
              <p className="text-gray-600 dark:text-foreground-secondary mb-3">
                {t('verifyEmail.description', { email })}
              </p>
              <p className="text-sm text-gray-500 dark:text-foreground-tertiary mb-6">
                {t('verifyEmail.helper')}
              </p>
            </>
          ) : (
            <p className="text-gray-600 dark:text-foreground-secondary mb-6">
              {t('verifyEmail.emailMissing')}
            </p>
          )}

          {message && (
            <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300">
              {message}
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <Button
              type="button"
              className="w-full"
              onClick={handleResend}
              disabled={!email || cooldown > 0 || loading}
              loading={loading}
            >
              {cooldown > 0
                ? t('verifyEmail.resendIn', { seconds: cooldown })
                : t('verifyEmail.resend')}
            </Button>

            <Link to="/login" className="block">
              <Button type="button" variant="ghost" className="w-full">
                {t('verifyEmail.backToLogin')}
              </Button>
            </Link>

            <Link to="/register" className="block text-sm text-gray-500 dark:text-foreground-tertiary hover:text-gray-700 dark:hover:text-foreground-secondary">
              {t('verifyEmail.backToRegister')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
