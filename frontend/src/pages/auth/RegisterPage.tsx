/**
 * Register Page
 * 注册页面
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../../api/auth';
import { Button } from '../../components/shared';
import { useT } from '../../hooks/useT';

// 组件内翻译
const registerI18n = {
  zh: {
    register: {
      title: '创建账号',
      tagline: 'AI 驱动的 PPT 生成器',
      email: '邮箱',
      username: '用户名',
      optional: '(可选)',
      password: '密码',
      confirmPassword: '确认密码',
      required: '*',
      terms: '我已阅读并同意',
      termsLink: '服务条款',
      and: '和',
      privacyLink: '隐私政策',
      submit: '创建账号',
      submitting: '注册中...',
      hasAccount: '已有账号？',
      login: '立即登录',
      passwordMismatch: '两次输入的密码不一致',
      passwordTooShort: '密码长度不能少于8位',
      registerFailed: '注册失败，请重试',
      footer: '© 2026 Banana Slides. All rights reserved.',
      emailPlaceholder: 'your@email.com',
      usernamePlaceholder: '您的昵称',
      passwordPlaceholder: '至少8位字符',
      confirmPasswordPlaceholder: '再次输入密码',
    },
  },
  en: {
    register: {
      title: 'Create Account',
      tagline: 'AI-powered PPT Generator',
      email: 'Email',
      username: 'Username',
      optional: '(Optional)',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      required: '*',
      terms: 'I have read and agree to the',
      termsLink: 'Terms of Service',
      and: 'and',
      privacyLink: 'Privacy Policy',
      submit: 'Create Account',
      submitting: 'Registering...',
      hasAccount: 'Already have an account?',
      login: 'Sign in',
      passwordMismatch: 'Passwords do not match',
      passwordTooShort: 'Password must be at least 8 characters',
      registerFailed: 'Registration failed, please try again',
      footer: '© 2026 Banana Slides. All rights reserved.',
      emailPlaceholder: 'your@email.com',
      usernamePlaceholder: 'Your nickname',
      passwordPlaceholder: 'At least 8 characters',
      confirmPasswordPlaceholder: 'Re-enter password',
    },
  },
};

export default function RegisterPage() {
  const t = useT(registerI18n);
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (password !== confirmPassword) {
      setError(t('register.passwordMismatch'));
      return;
    }

    if (password.length < 8) {
      setError(t('register.passwordTooShort'));
      return;
    }

    setLoading(true);

    try {
      const { message, requireVerification } = await registerUser(email, password, username || undefined);
      
      if (requireVerification) {
        // 需要验证邮箱，跳转到提示页面
        navigate('/login', { 
          state: { 
            message,
            fromRegister: true 
          } 
        });
      } else {
        // 开发模式：直接进入主页
        navigate('/', { state: { message } });
      }
    } catch (err: any) {
      // 后端错误格式: { error: { code, message }, success: false }
      const errorData = err.response?.data;
      const message = errorData?.error?.message || errorData?.message || t('register.registerFailed');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-background-primary relative overflow-hidden py-12">
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
          <p className="mt-2 text-gray-600 dark:text-foreground-secondary">{t('register.tagline')}</p>
        </div>

        {/* Register Form */}
        <div className="bg-white dark:bg-background-elevated rounded-2xl p-8 shadow-xl border border-gray-200 dark:border-border-primary">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-foreground-primary mb-6 text-center">{t('register.title')}</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1.5">
                {t('register.email')} <span className="text-red-500">{t('register.required')}</span>
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white dark:bg-background-secondary border border-gray-300 dark:border-border-primary rounded-lg text-gray-900 dark:text-foreground-primary placeholder-gray-400 dark:placeholder-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent transition"
                placeholder={t('register.emailPlaceholder')}
              />
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1.5">
                {t('register.username')} <span className="text-gray-500 dark:text-foreground-tertiary">{t('register.optional')}</span>
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-background-secondary border border-gray-300 dark:border-border-primary rounded-lg text-gray-900 dark:text-foreground-primary placeholder-gray-400 dark:placeholder-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent transition"
                placeholder={t('register.usernamePlaceholder')}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1.5">
                {t('register.password')} <span className="text-red-500">{t('register.required')}</span>
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-3 bg-white dark:bg-background-secondary border border-gray-300 dark:border-border-primary rounded-lg text-gray-900 dark:text-foreground-primary placeholder-gray-400 dark:placeholder-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent transition"
                placeholder={t('register.passwordPlaceholder')}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1.5">
                {t('register.confirmPassword')} <span className="text-red-500">{t('register.required')}</span>
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white dark:bg-background-secondary border border-gray-300 dark:border-border-primary rounded-lg text-gray-900 dark:text-foreground-primary placeholder-gray-400 dark:placeholder-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent transition"
                placeholder={t('register.confirmPasswordPlaceholder')}
              />
            </div>

            <div className="flex items-start text-sm pt-2">
              <input
                type="checkbox"
                required
                className="mt-0.5 mr-2 rounded border-gray-300 dark:border-border-primary bg-white dark:bg-background-secondary text-banana-500 focus:ring-banana-500"
              />
              <span className="text-gray-600 dark:text-foreground-secondary">
                {t('register.terms')}{' '}
                <a href="/terms" className="text-banana-600 dark:text-banana-400 hover:text-banana-700 dark:hover:text-banana-300">
                  {t('register.termsLink')}
                </a>{' '}
                {t('register.and')}{' '}
                <a href="/privacy" className="text-banana-600 dark:text-banana-400 hover:text-banana-700 dark:hover:text-banana-300">
                  {t('register.privacyLink')}
                </a>
              </span>
            </div>

            <Button
              type="submit"
              disabled={loading}
              loading={loading}
              className="w-full mt-2"
              size="lg"
            >
              {loading ? t('register.submitting') : t('register.submit')}
            </Button>
          </form>

          <div className="mt-6 text-center text-gray-600 dark:text-foreground-secondary">
            {t('register.hasAccount')}{' '}
            <Link to="/login" className="text-banana-600 dark:text-banana-400 hover:text-banana-700 dark:hover:text-banana-300 font-medium transition">
              {t('register.login')}
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-gray-500 dark:text-foreground-tertiary text-sm">
          {t('register.footer')}
        </p>
      </div>
    </div>
  );
}
