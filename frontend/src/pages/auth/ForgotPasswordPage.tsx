/**
 * Forgot Password Page
 * 忘记密码页面
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { Button } from '../../components/shared';
import { useT } from '../../hooks/useT';

// 组件内翻译
const forgotPasswordI18n = {
  zh: {
    forgotPassword: {
      title: '忘记密码',
      description: '输入您的邮箱，我们将发送重置密码的链接',
      email: '邮箱',
      submit: '发送重置链接',
      submitting: '发送中...',
      backToLogin: '← 返回登录',
      emailSent: '邮件已发送',
      emailSentDescription: '如果该邮箱已注册，您将收到重置密码的邮件。请检查您的收件箱。',
      backToLoginButton: '返回登录',
      sendFailed: '发送失败，请重试',
      emailPlaceholder: 'your@email.com',
    },
  },
  en: {
    forgotPassword: {
      title: 'Forgot Password',
      description: 'Enter your email and we will send you a password reset link',
      email: 'Email',
      submit: 'Send Reset Link',
      submitting: 'Sending...',
      backToLogin: '← Back to Login',
      emailSent: 'Email Sent',
      emailSentDescription: 'If the email is registered, you will receive a password reset email. Please check your inbox.',
      backToLoginButton: 'Back to Login',
      sendFailed: 'Send failed, please try again',
      emailPlaceholder: 'your@email.com',
    },
  },
};

export default function ForgotPasswordPage() {
  const t = useT(forgotPasswordI18n);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authApi.forgotPassword(email);
      setSuccess(true);
    } catch (err: any) {
      // 后端错误格式: { error: { code, message }, success: false }
      const errorData = err.response?.data;
      const message = errorData?.error?.message || errorData?.message || t('forgotPassword.sendFailed');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

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
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-foreground-primary mb-2">{t('forgotPassword.emailSent')}</h2>
              <p className="text-gray-600 dark:text-foreground-secondary mb-6">
                {t('forgotPassword.emailSentDescription')}
              </p>
              <Link to="/login">
                <Button variant="secondary" className="w-full">
                  {t('forgotPassword.backToLoginButton')}
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-foreground-primary mb-2 text-center">{t('forgotPassword.title')}</h2>
              <p className="text-gray-600 dark:text-foreground-secondary text-center mb-6">
                {t('forgotPassword.description')}
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1.5">
                    {t('forgotPassword.email')}
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-white dark:bg-background-secondary border border-gray-300 dark:border-border-primary rounded-lg text-gray-900 dark:text-foreground-primary placeholder-gray-400 dark:placeholder-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent transition"
                    placeholder={t('forgotPassword.emailPlaceholder')}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  loading={loading}
                  className="w-full"
                  size="lg"
                >
                  {loading ? t('forgotPassword.submitting') : t('forgotPassword.submit')}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link to="/login" className="text-banana-600 dark:text-banana-400 hover:text-banana-700 dark:hover:text-banana-300 text-sm transition">
                  {t('forgotPassword.backToLogin')}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
