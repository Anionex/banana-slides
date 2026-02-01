/**
 * Login Page
 * 登录页面
 */
import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { loginUser } from '../../api/auth';
import { Button } from '../../components/shared';
import { useT } from '../../hooks/useT';

// 组件内翻译
const loginI18n = {
  zh: {
    login: {
      title: '登录',
      tagline: 'AI 驱动的 PPT 生成器',
      email: '邮箱',
      password: '密码',
      rememberMe: '记住我',
      forgotPassword: '忘记密码？',
      submit: '登录',
      submitting: '登录中...',
      noAccount: '还没有账号？',
      register: '立即注册',
      loginFailed: '登录失败，请重试',
      footer: '© 2026 Banana Slides. All rights reserved.',
    },
  },
  en: {
    login: {
      title: 'Login',
      tagline: 'AI-powered PPT Generator',
      email: 'Email',
      password: 'Password',
      rememberMe: 'Remember me',
      forgotPassword: 'Forgot password?',
      submit: 'Login',
      submitting: 'Logging in...',
      noAccount: "Don't have an account?",
      register: 'Sign up',
      loginFailed: 'Login failed, please try again',
      footer: '© 2026 Banana Slides. All rights reserved.',
    },
  },
};

export default function LoginPage() {
  const t = useT(loginI18n);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await loginUser(email, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      // 后端错误格式: { error: { code, message }, success: false }
      const errorData = err.response?.data;
      const message = errorData?.error?.message || errorData?.message || t('login.loginFailed');
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
          <p className="mt-2 text-gray-600 dark:text-foreground-secondary">{t('login.tagline')}</p>
        </div>

        {/* Login Form */}
        <div className="bg-white dark:bg-background-elevated rounded-2xl p-8 shadow-xl border border-gray-200 dark:border-border-primary">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-foreground-primary mb-6 text-center">{t('login.title')}</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1.5">
                {t('login.email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white dark:bg-background-secondary border border-gray-300 dark:border-border-primary rounded-lg text-gray-900 dark:text-foreground-primary placeholder-gray-400 dark:placeholder-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent transition"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1.5">
                {t('login.password')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white dark:bg-background-secondary border border-gray-300 dark:border-border-primary rounded-lg text-gray-900 dark:text-foreground-primary placeholder-gray-400 dark:placeholder-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent transition"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center text-gray-600 dark:text-foreground-secondary">
                <input type="checkbox" className="mr-2 rounded border-gray-300 dark:border-border-primary bg-white dark:bg-background-secondary text-banana-500 focus:ring-banana-500" />
                {t('login.rememberMe')}
              </label>
              <Link to="/forgot-password" className="text-banana-600 dark:text-banana-400 hover:text-banana-700 dark:hover:text-banana-300 transition">
                {t('login.forgotPassword')}
              </Link>
            </div>

            <Button
              type="submit"
              disabled={loading}
              loading={loading}
              className="w-full"
              size="lg"
            >
              {loading ? t('login.submitting') : t('login.submit')}
            </Button>
          </form>

          <div className="mt-6 text-center text-gray-600 dark:text-foreground-secondary">
            {t('login.noAccount')}{' '}
            <Link to="/register" className="text-banana-600 dark:text-banana-400 hover:text-banana-700 dark:hover:text-banana-300 font-medium transition">
              {t('login.register')}
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-gray-500 dark:text-foreground-tertiary text-sm">
          {t('login.footer')}
        </p>
      </div>
    </div>
  );
}
