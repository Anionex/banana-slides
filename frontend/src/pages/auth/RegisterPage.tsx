/**
 * Register Page
 * 注册页面
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, LockKeyhole, Mail, Ticket, User } from 'lucide-react';
import { registerUser, authApi } from '../../api/auth';
import { Button } from '../../components/shared';
import { useT } from '../../hooks/useT';
import * as api from '../../api/endpoints';

const registerI18n = {
  zh: {
    register: {
      title: '创建账号',
      tagline: '开始你的 AI 演示文稿工作流',
      heroTitleLine1: '创建你的',
      heroTitleAccent: 'Banana Slides',
      heroTitleLine3: '账号',
      heroDescription: '创建账号后即可进入 Banana Slides。',
      formEyebrow: '新用户注册',
      email: '邮箱',
      username: '用户名',
      optional: '可选',
      password: '密码',
      confirmPassword: '确认密码',
      invitationCode: '邀请码',
      invitationCodePlaceholder: '输入邀请码（可选）',
      invitationValid: '有效邀请码，注册后双方各得 {{bonus}} 积分',
      invitationInvalid: '邀请码无效',
      required: '*',
      terms: '我已阅读并同意',
      termsLink: '服务条款',
      and: '和',
      privacyLink: '隐私政策',
      submit: '发送验证码',
      submitting: '发送中...',
      hasAccount: '已有账号？',
      login: '立即登录',
      registerFailed: '注册失败，请重试',
      passwordMismatch: '两次输入的密码不一致',
      passwordTooShort: '密码长度不能少于8位',
      termsRequired: '请先同意服务条款和隐私政策',
      backToHome: '返回首页',
      helper: '填写必要信息后即可创建账号，下一步会继续邮箱验证。',
      emailPlaceholder: 'name@company.com',
      usernamePlaceholder: '你的昵称',
      passwordPlaceholder: '至少8位字符',
      confirmPasswordPlaceholder: '再次输入密码',
      alreadyVerifiedLogin: '该邮箱已注册并验证，请直接登录',
      footer: '© 2026 Banana Slides. All rights reserved.',
    },
  },
  en: {
    register: {
      title: 'Create Account',
      tagline: 'Start your AI presentation workflow',
      heroTitleLine1: 'Create your',
      heroTitleAccent: 'Banana Slides',
      heroTitleLine3: 'account',
      heroDescription: 'Create your account to enter Banana Slides.',
      formEyebrow: 'New account',
      email: 'Email',
      username: 'Username',
      optional: 'Optional',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      invitationCode: 'Invitation Code',
      invitationCodePlaceholder: 'Enter invitation code (optional)',
      invitationValid: 'Valid code. Both accounts receive {{bonus}} credits after signup',
      invitationInvalid: 'Invalid invitation code',
      required: '*',
      terms: 'I have read and agree to the',
      termsLink: 'Terms of Service',
      and: 'and',
      privacyLink: 'Privacy Policy',
      submit: 'Send Verification Code',
      submitting: 'Sending...',
      hasAccount: 'Already have an account?',
      login: 'Sign in',
      registerFailed: 'Registration failed, please try again',
      passwordMismatch: 'Passwords do not match',
      passwordTooShort: 'Password must be at least 8 characters',
      termsRequired: 'Please accept the terms and privacy policy first',
      backToHome: 'Back to home',
      helper: 'Create your account to continue. Email verification is handled in the next step.',
      emailPlaceholder: 'name@company.com',
      usernamePlaceholder: 'Your nickname',
      passwordPlaceholder: 'At least 8 characters',
      confirmPasswordPlaceholder: 'Re-enter password',
      alreadyVerifiedLogin: 'This email is already verified. Please sign in directly.',
      footer: '© 2026 Banana Slides. All rights reserved.',
    },
  },
};

export default function RegisterPage() {
  const t = useT(registerI18n);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [invitationCode, setInvitationCode] = useState(searchParams.get('invite') || '');
  const [agreed, setAgreed] = useState(false);
  const [invitationStatus, setInvitationStatus] = useState<{ valid: boolean; bonus?: number; message?: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const validateCode = async () => {
      if (!invitationCode || invitationCode.length < 6) {
        setInvitationStatus(null);
        return;
      }

      try {
        const res = await api.validateInvitationCode(invitationCode);
        if (res.data) {
          setInvitationStatus(res.data);
        }
      } catch {
        setInvitationStatus({ valid: false, message: t('register.invitationInvalid') });
      }
    };

    const timer = setTimeout(validateCode, 500);
    return () => clearTimeout(timer);
  }, [invitationCode, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('register.passwordMismatch'));
      return;
    }

    if (password.length < 8) {
      setError(t('register.passwordTooShort'));
      return;
    }

    if (!agreed) {
      setError(t('register.termsRequired'));
      return;
    }

    setLoading(true);

    try {
      const { email: userEmail, requireVerification } = await registerUser(
        email,
        password,
        username || undefined,
        invitationCode || undefined,
      );

      if (requireVerification) {
        navigate('/verify-email', { state: { email: userEmail || email } });
      } else {
        navigate('/app', { replace: true });
      }
    } catch (err: any) {
      const errorData = err.response?.data;
      const errorCode = errorData?.error?.code;
      const errorMessage = errorData?.error?.message || errorData?.message || t('register.registerFailed');

      if (errorCode === 'REGISTRATION_FAILED' && errorMessage.includes('已被注册')) {
        try {
          await authApi.resendVerification(email);
          navigate('/verify-email', { state: { email } });
        } catch (resendErr: any) {
          const resendError = resendErr.response?.data?.error?.message;
          if (resendError?.includes('已验证')) {
            setError(t('register.alreadyVerifiedLogin'));
          } else {
            setError(resendError || errorMessage);
          }
        }
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
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
              <div className="hidden text-xs text-slate-500 sm:block">{t('register.tagline')}</div>
            </div>
          </Link>

          <Link
            to="/"
            className="rounded-lg px-2.5 py-2 text-xs text-slate-500 transition-colors hover:bg-black/[0.04] hover:text-slate-900 sm:px-3 sm:text-sm"
          >
            {t('register.backToHome')}
          </Link>
        </header>

        <main className="flex flex-1 items-start py-4 sm:py-6 lg:items-center lg:py-6">
          <div className="grid w-full items-start gap-6 lg:grid-cols-[0.9fr_0.85fr] lg:items-center lg:gap-8 xl:gap-20">
            <section className="relative order-2 border-t border-black/[0.06] pt-6 lg:order-1 lg:border-0 lg:pt-0">
              <div className="max-w-lg">
                <h1
                  className="lp2-hero-title text-[2rem] leading-[1.02] tracking-[-0.05em] text-slate-950 [word-break:keep-all] sm:text-[2.45rem] lg:text-[3rem] xl:text-[3.7rem]"
                  style={{ textWrap: 'balance' }}
                >
                  <span>{t('register.heroTitleLine1')} </span>
                  <span className="lp2-gradient-text">{t('register.heroTitleAccent')}</span>
                  <span className="block">{t('register.heroTitleLine3')}</span>
                </h1>

                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 sm:mt-4 sm:text-[15px] sm:leading-7 sm:text-base">
                  {t('register.heroDescription')}
                </p>
              </div>
            </section>

            <section className="order-1 lg:order-2">
              <div className="relative overflow-hidden rounded-[1.25rem] border border-black/[0.08] bg-white/92 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.10)] backdrop-blur-md sm:rounded-[1.5rem] sm:p-5 lg:p-6">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,215,0,0.12),transparent_32%)]" />
                <div className="relative">
                  <div className="mb-3">
                    <div className="font-mono text-xs tracking-[0.24em] text-slate-400">{t('register.formEyebrow')}</div>
                    <h2 className="mt-1.5 text-[1.45rem] font-semibold tracking-[-0.04em] text-slate-950 sm:text-[1.65rem]">{t('register.title')}</h2>
                    <p className="mt-1 max-w-md text-sm leading-5 text-slate-500">{t('register.helper')}</p>
                  </div>

                  {error && (
                    <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                          {t('register.email')} <span className="text-red-500">{t('register.required')}</span>
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
                            placeholder={t('register.emailPlaceholder')}
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-slate-700">
                          {t('register.username')} <span className="text-slate-400">{t('register.optional')}</span>
                        </label>
                        <div className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm transition-all focus-within:border-[#f0a030] focus-within:ring-4 focus-within:ring-[#FFD700]/20 hover:border-slate-300">
                          <User className="h-4 w-4 text-slate-400 transition-colors group-focus-within:text-[#c98900]" />
                          <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full border-0 bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                            placeholder={t('register.usernamePlaceholder')}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                          {t('register.password')} <span className="text-red-500">{t('register.required')}</span>
                        </label>
                        <div className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm transition-all focus-within:border-[#f0a030] focus-within:ring-4 focus-within:ring-[#FFD700]/20 hover:border-slate-300">
                          <LockKeyhole className="h-4 w-4 text-slate-400 transition-colors group-focus-within:text-[#c98900]" />
                          <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={8}
                            className="w-full border-0 bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                            placeholder={t('register.passwordPlaceholder')}
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-slate-700">
                          {t('register.confirmPassword')} <span className="text-red-500">{t('register.required')}</span>
                        </label>
                        <div className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm transition-all focus-within:border-[#f0a030] focus-within:ring-4 focus-within:ring-[#FFD700]/20 hover:border-slate-300">
                          <LockKeyhole className="h-4 w-4 text-slate-400 transition-colors group-focus-within:text-[#c98900]" />
                          <input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            className="w-full border-0 bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                            placeholder={t('register.confirmPasswordPlaceholder')}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="invitationCode" className="mb-1.5 block text-sm font-medium text-slate-700">
                        {t('register.invitationCode')} <span className="text-slate-400">{t('register.optional')}</span>
                      </label>
                      <div className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm transition-all focus-within:border-[#f0a030] focus-within:ring-4 focus-within:ring-[#FFD700]/20 hover:border-slate-300">
                        <Ticket className="h-4 w-4 text-slate-400 transition-colors group-focus-within:text-[#c98900]" />
                        <input
                          id="invitationCode"
                          type="text"
                          value={invitationCode}
                          onChange={(e) => setInvitationCode(e.target.value)}
                          className="w-full border-0 bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                          placeholder={t('register.invitationCodePlaceholder')}
                        />
                      </div>
                      {invitationStatus && (
                        <p className={`mt-2 text-sm ${invitationStatus.valid ? 'text-emerald-600' : 'text-red-600'}`}>
                          {invitationStatus.valid
                            ? t('register.invitationValid', { bonus: invitationStatus.bonus ?? 0 })
                            : invitationStatus.message || t('register.invitationInvalid')}
                        </p>
                      )}
                    </div>

                    <label className="flex cursor-pointer items-start gap-3 pt-0.5 text-sm leading-5 text-slate-600">
                      <span className="relative mt-0.5">
                        <input
                          type="checkbox"
                          checked={agreed}
                          onChange={(e) => setAgreed(e.target.checked)}
                          className="peer sr-only"
                        />
                        <span className="flex h-5 w-5 items-center justify-center rounded-md border border-slate-300 bg-white text-transparent shadow-sm transition peer-checked:border-[#f0a030] peer-checked:bg-[#fff6cc] peer-checked:text-[#c98900]">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </span>
                      </span>
                      <span>
                        {t('register.terms')}{' '}
                        <a href="/terms" className="font-medium text-[#b67800] transition-colors hover:text-slate-900">
                          {t('register.termsLink')}
                        </a>{' '}
                        {t('register.and')}{' '}
                        <a href="/privacy" className="font-medium text-[#b67800] transition-colors hover:text-slate-900">
                          {t('register.privacyLink')}
                        </a>
                      </span>
                    </label>

                    <Button
                      type="submit"
                      disabled={loading}
                      loading={loading}
                      size="lg"
                      className="w-full rounded-2xl border-0 bg-[linear-gradient(135deg,#FFD700_0%,#f0a030_90%)] text-slate-950 shadow-[0_16px_36px_rgba(240,160,48,0.22)] hover:shadow-[0_20px_40px_rgba(240,160,48,0.20)]"
                      icon={!loading ? <ArrowRight className="h-4 w-4" /> : undefined}
                    >
                      {loading ? t('register.submitting') : t('register.submit')}
                    </Button>
                  </form>

                  <div className="mt-4 text-sm text-slate-600">
                    {t('register.hasAccount')}{' '}
                    <Link to="/login" className="font-semibold text-slate-950 underline decoration-[#FFD700] underline-offset-4">
                      {t('register.login')}
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>

        <footer className="pb-3 pt-4 text-center text-xs text-slate-400 sm:text-sm">
          {t('register.footer')}
        </footer>
      </div>
    </div>
  );
}
