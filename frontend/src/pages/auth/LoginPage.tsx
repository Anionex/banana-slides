/**
 * Login Page
 * 登录页面
 */
import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { ArrowRight, CheckCircle2, LockKeyhole, Mail } from 'lucide-react';
import { loginUser, signInWithGoogle } from '../../api/auth';
import { Button } from '../../components/shared';
import { useT } from '../../hooks/useT';

// 组件内翻译
const loginI18n = {
  zh: {
    login: {
      title: '登录',
      tagline: '继续你的 AI 演示文稿工作流',
      heroTitleLine1: '回到',
      heroTitleAccent: 'Banana Slides',
      heroTitleLine3: '继续完成演示文稿',
      heroDescription: '登录后继续使用 Banana Slides。',
      formEyebrow: '欢迎回来',
      email: '邮箱',
      password: '密码',
      rememberMe: '记住我',
      forgotPassword: '忘记密码？',
      submit: '登录',
      submitting: '登录中...',
      noAccount: '还没有账号？',
      register: '立即注册',
      loginFailed: '登录失败，请重试',
      backToHome: '返回首页',
      registerCta: '创建账号',
      helper: '输入你的账号信息，继续编辑、导出或管理项目。',
      emailPlaceholder: 'name@company.com',
      passwordPlaceholder: '输入密码',
      footer: '© 2026 Banana Slides. All rights reserved.',
      orContinueWith: '或使用以下方式继续',
      googleLogin: '使用 Google 登录',
    },
  },
  en: {
    login: {
      title: 'Login',
      tagline: 'Return to your AI presentation workflow',
      heroTitleLine1: 'Return to',
      heroTitleAccent: 'Banana Slides',
      heroTitleLine3: 'and keep shipping decks',
      heroDescription: 'Sign in to continue using Banana Slides.',
      formEyebrow: 'Welcome back',
      email: 'Email',
      password: 'Password',
      rememberMe: 'Remember me',
      forgotPassword: 'Forgot password?',
      submit: 'Login',
      submitting: 'Logging in...',
      noAccount: "Don't have an account?",
      register: 'Sign up',
      loginFailed: 'Login failed, please try again',
      backToHome: 'Back to home',
      registerCta: 'Create account',
      helper: 'Enter your account details to continue editing, exporting, or managing projects.',
      emailPlaceholder: 'name@company.com',
      passwordPlaceholder: 'Enter password',
      footer: '© 2026 Banana Slides. All rights reserved.',
      orContinueWith: 'Or continue with',
      googleLogin: 'Continue with Google',
    },
  },
};

export default function LoginPage() {
  const t = useT(loginI18n);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/app';
  const registerMessage = (location.state as any)?.message;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState(registerMessage || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      await loginUser(email, password, rememberMe);
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

  const handleGoogleLogin = async () => {
    setError('');
    setSuccessMessage('');
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err?.message || 'Google 登录失败，请重试');
    }
  };

  return (
    <div className="lp2-page relative min-h-screen overflow-x-hidden bg-white supports-[height:100dvh]:min-h-[100dvh]">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:42px_42px] opacity-20" />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="lp2-orb lp2-orb-1 absolute -right-24 top-[-8rem] h-[22rem] w-[30rem]"
          style={{ background: 'rgba(255,215,0,0.10)' }}
        />
        <div
          className="lp2-orb lp2-orb-2 absolute left-[-8rem] top-[28%] h-[18rem] w-[24rem]"
          style={{ background: 'rgba(255,228,77,0.10)' }}
        />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white via-white/80 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#faf7ef] via-white/70 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-3 sm:px-6 sm:py-4 lg:px-10 lg:py-5 supports-[height:100dvh]:min-h-[100dvh]">
        <header className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <img
              src="/logo.png"
              alt="Banana Slides"
              className="h-9 w-9 object-contain"
            />
            <div>
              <div className="text-xs font-semibold tracking-tight text-slate-950 sm:text-sm">Banana Slides</div>
              <div className="hidden text-xs text-slate-500 sm:block">{t('login.tagline')}</div>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="rounded-lg px-2.5 py-2 text-xs text-slate-500 transition-colors hover:bg-black/[0.04] hover:text-slate-900 sm:px-3 sm:text-sm"
            >
              {t('login.backToHome')}
            </Link>
          </div>
        </header>

        <main className="flex flex-1 items-start py-4 sm:py-6 lg:items-center lg:py-6">
          <div className="grid w-full items-start gap-6 lg:grid-cols-[0.9fr_0.85fr] lg:items-center lg:gap-8 xl:gap-20">
            <section className="relative order-2 border-t border-black/[0.06] pt-6 lg:order-1 lg:border-0 lg:pt-0">
              <div className="max-w-lg">
                <h1
                  className="lp2-hero-title text-[2rem] leading-[1.02] tracking-[-0.05em] text-slate-950 [word-break:keep-all] sm:text-[2.45rem] lg:text-[3rem] xl:text-[3.7rem]"
                  style={{ textWrap: 'balance' }}
                >
                  <span>{t('login.heroTitleLine1')} </span>
                  <span className="lp2-gradient-text">{t('login.heroTitleAccent')}</span>
                  <span className="block">{t('login.heroTitleLine3')}</span>
                </h1>

                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 sm:mt-4 sm:text-[15px] sm:leading-7 sm:text-base">
                  {t('login.heroDescription')}
                </p>
              </div>
            </section>

            <section className="order-1 lg:order-2">
              <div className="relative overflow-hidden rounded-[1.25rem] border border-black/[0.08] bg-white/92 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.10)] backdrop-blur-md sm:rounded-[1.5rem] sm:p-5 lg:p-6">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,215,0,0.12),transparent_32%)]" />
                <div className="relative">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="font-mono text-xs tracking-[0.24em] text-slate-400">{t('login.formEyebrow')}</div>
                      <h2 className="mt-2 text-[1.55rem] font-semibold tracking-[-0.04em] text-slate-950 sm:text-[1.8rem]">{t('login.title')}</h2>
                      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{t('login.helper')}</p>
                    </div>
                  </div>

                  {successMessage && (
                    <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-sm">
                      {successMessage}
                    </div>
                  )}

                  {error && (
                    <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
                    <div>
                      <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                        {t('login.email')}
                      </label>
                      <div className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm transition-all focus-within:border-[#f0a030] focus-within:ring-4 focus-within:ring-[#FFD700]/20 hover:border-slate-300">
                        <Mail className="h-4 w-4 text-slate-400 transition-colors group-focus-within:text-[#c98900]" />
                        <input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="w-full border-0 bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                          placeholder={t('login.emailPlaceholder')}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                        {t('login.password')}
                      </label>
                      <div className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm transition-all focus-within:border-[#f0a030] focus-within:ring-4 focus-within:ring-[#FFD700]/20 hover:border-slate-300">
                        <LockKeyhole className="h-4 w-4 text-slate-400 transition-colors group-focus-within:text-[#c98900]" />
                        <input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="w-full border-0 bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                          placeholder={t('login.passwordPlaceholder')}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <label className="inline-flex cursor-pointer items-center gap-3 text-slate-600">
                        <span className="relative">
                          <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="peer sr-only"
                          />
                          <span className="flex h-5 w-5 items-center justify-center rounded-md border border-slate-300 bg-white text-transparent shadow-sm transition peer-checked:border-[#f0a030] peer-checked:bg-[#fff6cc] peer-checked:text-[#c98900]">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </span>
                        </span>
                        {t('login.rememberMe')}
                      </label>

                      <Link to="/forgot-password" className="font-medium text-[#b67800] transition-colors hover:text-slate-900">
                        {t('login.forgotPassword')}
                      </Link>
                    </div>

                    <Button
                      type="submit"
                      disabled={loading}
                      loading={loading}
                      size="lg"
                      className="w-full rounded-2xl border-0 bg-[linear-gradient(135deg,#FFD700_0%,#f0a030_90%)] text-slate-950 shadow-[0_16px_36px_rgba(240,160,48,0.22)] hover:shadow-[0_20px_40px_rgba(240,160,48,0.20)]"
                      icon={!loading ? <ArrowRight className="h-4 w-4" /> : undefined}
                    >
                      {loading ? t('login.submitting') : t('login.submit')}
                    </Button>
                  </form>

                  {/* Divider */}
                  <div className="relative my-5">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="bg-white px-2 text-slate-400">
                        {t('login.orContinueWith')}
                      </span>
                    </div>
                  </div>

                  {/* Google Login */}
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-200 rounded-2xl text-slate-700 bg-white/90 hover:bg-slate-50 transition shadow-sm"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    {t('login.googleLogin')}
                  </button>

                  <div className="mt-4 text-sm text-slate-600 sm:mt-5">
                    {t('login.noAccount')}{' '}
                    <Link to="/register" className="font-semibold text-slate-950 underline decoration-[#FFD700] underline-offset-4">
                      {t('login.register')}
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>

        <footer className="pb-3 pt-4 text-center text-xs text-slate-400 sm:text-sm">
          {t('login.footer')}
        </footer>
      </div>
    </div>
  );
}
