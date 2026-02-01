/**
 * Verify Email Page
 * 邮箱验证页面
 */
import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { Button } from '../../components/shared';
import { useT } from '../../hooks/useT';

// 组件内翻译
const verifyEmailI18n = {
  zh: {
    verifyEmail: {
      verifying: '验证中...',
      verifyingDescription: '请稍候，正在验证您的邮箱',
      success: '验证成功！',
      successDescription: '您的邮箱已成功验证，现在可以使用所有功能了',
      startUsing: '开始使用',
      failed: '验证失败',
      backToLogin: '返回登录',
      expiredLink: '链接已过期？登录后可以重新发送验证邮件',
      invalidLink: '验证链接无效',
      verifyFailed: '验证失败',
    },
  },
  en: {
    verifyEmail: {
      verifying: 'Verifying...',
      verifyingDescription: 'Please wait while we verify your email',
      success: 'Verification Successful!',
      successDescription: 'Your email has been successfully verified. You can now use all features.',
      startUsing: 'Get Started',
      failed: 'Verification Failed',
      backToLogin: 'Back to Login',
      expiredLink: 'Link expired? You can resend the verification email after logging in',
      invalidLink: 'Invalid verification link',
      verifyFailed: 'Verification failed',
    },
  },
};

export default function VerifyEmailPage() {
  const t = useT(verifyEmailI18n);
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError(t('verifyEmail.invalidLink'));
      return;
    }

    const verifyEmail = async () => {
      try {
        await authApi.verifyEmail(token);
        setStatus('success');
      } catch (err: any) {
        setStatus('error');
        // 后端错误格式: { error: { code, message }, success: false }
        const errorData = err.response?.data;
        setError(errorData?.error?.message || errorData?.message || t('verifyEmail.verifyFailed'));
      }
    };

    verifyEmail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-background-primary relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-banana-100/40 to-transparent dark:from-banana-900/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-orange-100/40 to-transparent dark:from-orange-900/5 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4"></div>
      </div>

      <div className="w-full max-w-md relative z-10 px-6">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-white">
            <span className="text-4xl">🍌</span>
            <span>Banana Slides</span>
          </Link>
        </div>

        {/* Status Card */}
        <div className="bg-white dark:bg-background-elevated rounded-2xl p-8 shadow-xl border border-gray-200 dark:border-border-primary">
          {status === 'loading' && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <svg className="animate-spin h-12 w-12 text-banana-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-foreground-primary mb-2">{t('verifyEmail.verifying')}</h2>
              <p className="text-gray-600 dark:text-foreground-secondary">{t('verifyEmail.verifyingDescription')}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-foreground-primary mb-2">{t('verifyEmail.success')}</h2>
              <p className="text-gray-600 dark:text-foreground-secondary mb-6">
                {t('verifyEmail.successDescription')}
              </p>
              <Link to="/">
                <Button variant="primary" className="w-full" size="lg">
                  {t('verifyEmail.startUsing')}
                </Button>
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-foreground-primary mb-2">{t('verifyEmail.failed')}</h2>
              <p className="text-gray-600 dark:text-foreground-secondary mb-6">{error}</p>
              <div className="space-y-3">
                <Link to="/login">
                  <Button variant="primary" className="w-full">
                    {t('verifyEmail.backToLogin')}
                  </Button>
                </Link>
                <p className="text-gray-500 dark:text-foreground-tertiary text-sm">
                  {t('verifyEmail.expiredLink')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
