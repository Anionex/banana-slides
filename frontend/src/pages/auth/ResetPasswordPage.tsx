/**
 * Reset Password Page
 * 重置密码页面
 */
import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { Button } from '../../components/shared';
import { useT } from '../../hooks/useT';

// 组件内翻译
const resetPasswordI18n = {
  zh: {
    resetPassword: {
      title: '重置密码',
      description: '请输入您的新密码',
      newPassword: '新密码',
      confirmPassword: '确认新密码',
      submit: '重置密码',
      submitting: '重置中...',
      success: '密码已重置',
      successDescription: '您的密码已成功重置，正在跳转到登录页面...',
      loginNow: '立即登录',
      invalidLink: '无效的链接',
      invalidLinkDescription: '重置密码链接无效或已过期',
      resend: '重新发送',
      passwordMismatch: '两次输入的密码不一致',
      passwordTooShort: '密码长度不能少于8位',
      resetFailed: '重置失败，请重试',
      passwordPlaceholder: '至少8位字符',
      confirmPasswordPlaceholder: '再次输入新密码',
    },
  },
  en: {
    resetPassword: {
      title: 'Reset Password',
      description: 'Please enter your new password',
      newPassword: 'New Password',
      confirmPassword: 'Confirm New Password',
      submit: 'Reset Password',
      submitting: 'Resetting...',
      success: 'Password Reset',
      successDescription: 'Your password has been successfully reset. Redirecting to login page...',
      loginNow: 'Login Now',
      invalidLink: 'Invalid Link',
      invalidLinkDescription: 'The password reset link is invalid or has expired',
      resend: 'Resend',
      passwordMismatch: 'Passwords do not match',
      passwordTooShort: 'Password must be at least 8 characters',
      resetFailed: 'Reset failed, please try again',
      passwordPlaceholder: 'At least 8 characters',
      confirmPasswordPlaceholder: 'Re-enter new password',
    },
  },
};

export default function ResetPasswordPage() {
  const t = useT(resetPasswordI18n);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('resetPassword.passwordMismatch'));
      return;
    }

    if (password.length < 8) {
      setError(t('resetPassword.passwordTooShort'));
      return;
    }

    setLoading(true);

    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
      // Redirect to login after 3 seconds
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      // 后端错误格式: { error: { code, message }, success: false }
      const errorData = err.response?.data;
      const message = errorData?.error?.message || errorData?.message || t('resetPassword.resetFailed');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-background-primary relative overflow-hidden">
        {/* 背景装饰 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-banana-100/40 to-transparent dark:from-banana-900/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-orange-100/40 to-transparent dark:from-orange-900/5 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4"></div>
        </div>

        <div className="text-center relative z-10 px-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-foreground-primary mb-2">{t('resetPassword.invalidLink')}</h2>
          <p className="text-gray-600 dark:text-foreground-secondary mb-6">{t('resetPassword.invalidLinkDescription')}</p>
          <Link to="/forgot-password">
            <Button variant="primary">{t('resetPassword.resend')}</Button>
          </Link>
        </div>
      </div>
    );
  }

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

        {/* Form */}
        <div className="bg-white dark:bg-background-elevated rounded-2xl p-8 shadow-xl border border-gray-200 dark:border-border-primary">
          {success ? (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-foreground-primary mb-2">{t('resetPassword.success')}</h2>
              <p className="text-gray-600 dark:text-foreground-secondary mb-6">
                {t('resetPassword.successDescription')}
              </p>
              <Link to="/login">
                <Button variant="primary" className="w-full">
                  {t('resetPassword.loginNow')}
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-foreground-primary mb-2 text-center">{t('resetPassword.title')}</h2>
              <p className="text-gray-600 dark:text-foreground-secondary text-center mb-6">{t('resetPassword.description')}</p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1.5">
                    {t('resetPassword.newPassword')}
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-4 py-3 bg-white dark:bg-background-secondary border border-gray-300 dark:border-border-primary rounded-lg text-gray-900 dark:text-foreground-primary placeholder-gray-400 dark:placeholder-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent transition"
                    placeholder={t('resetPassword.passwordPlaceholder')}
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1.5">
                    {t('resetPassword.confirmPassword')}
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-white dark:bg-background-secondary border border-gray-300 dark:border-border-primary rounded-lg text-gray-900 dark:text-foreground-primary placeholder-gray-400 dark:placeholder-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent transition"
                    placeholder={t('resetPassword.confirmPasswordPlaceholder')}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  loading={loading}
                  className="w-full"
                  size="lg"
                >
                  {loading ? t('resetPassword.submitting') : t('resetPassword.submit')}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
