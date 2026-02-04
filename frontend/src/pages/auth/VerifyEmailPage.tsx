/**
 * Verify Email Page
 * 邮箱验证页面 - 6位验证码输入
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../store/useAuthStore';
import { Button } from '../../components/shared';
import { useT } from '../../hooks/useT';

// 组件内翻译
const verifyEmailI18n = {
  zh: {
    verifyEmail: {
      title: '验证您的邮箱',
      description: '我们已向 {email} 发送了6位验证码',
      enterCode: '请输入验证码',
      verifying: '验证中...',
      success: '验证成功！',
      successDescription: '您的邮箱已成功验证，正在跳转...',
      failed: '验证失败',
      resend: '重新发送验证码',
      resendIn: '{seconds}秒后可重新发送',
      resendSuccess: '验证码已重新发送',
      backToLogin: '返回登录',
      backToRegister: '返回注册',
      codeInvalid: '验证码错误',
      codeExpired: '验证码已过期',
      noEmail: '缺少邮箱信息，请重新注册',
    },
  },
  en: {
    verifyEmail: {
      title: 'Verify Your Email',
      description: 'We sent a 6-digit code to {email}',
      enterCode: 'Enter verification code',
      verifying: 'Verifying...',
      success: 'Verification Successful!',
      successDescription: 'Your email has been verified. Redirecting...',
      failed: 'Verification Failed',
      resend: 'Resend Code',
      resendIn: 'Resend in {seconds}s',
      resendSuccess: 'Verification code resent',
      backToLogin: 'Back to Login',
      backToRegister: 'Back to Register',
      codeInvalid: 'Invalid code',
      codeExpired: 'Code expired',
      noEmail: 'Email missing. Please register again.',
    },
  },
};

const CODE_LENGTH = 6;
const COOLDOWN_SECONDS = 30;

export default function VerifyEmailPage() {
  const t = useT(verifyEmailI18n);
  const location = useLocation();
  const navigate = useNavigate();
  const email = (location.state as any)?.email || '';

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 倒计时逻辑
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // 提交验证码
  const submitCode = useCallback(async (fullCode: string) => {
    if (!email || fullCode.length !== CODE_LENGTH) return;

    setStatus('loading');
    setError('');

    try {
      const data = await authApi.verifyEmail(email, fullCode);

      setStatus('success');

      // 自动登录
      useAuthStore.getState().login(data.user, {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        token_type: data.token_type,
        expires_in: data.expires_in,
        refresh_expires_in: data.refresh_expires_in,
      });

      // 跳转首页
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 1000);
    } catch (err: any) {
      setStatus('error');
      const errorData = err.response?.data;
      setError(errorData?.error?.message || errorData?.message || t('verifyEmail.codeInvalid'));
      // 清空输入，聚焦第一个
      setCode(Array(CODE_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [email, navigate, t]);

  // 处理输入
  const handleChange = (index: number, value: string) => {
    // 处理粘贴完整验证码的情况
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, CODE_LENGTH).split('');
      const newCode = [...code];
      digits.forEach((d, i) => {
        if (index + i < CODE_LENGTH) {
          newCode[index + i] = d;
        }
      });
      setCode(newCode);

      // 聚焦到最后一个填入的位置或末尾
      const nextIndex = Math.min(index + digits.length, CODE_LENGTH - 1);
      inputRefs.current[nextIndex]?.focus();

      // 如果填满了就提交
      const fullCode = newCode.join('');
      if (fullCode.length === CODE_LENGTH && !newCode.includes('')) {
        submitCode(fullCode);
      }
      return;
    }

    // 单个字符输入
    const digit = value.replace(/\D/g, '');
    if (!digit && value !== '') return;

    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // 检查是否填满
    const fullCode = newCode.join('');
    if (fullCode.length === CODE_LENGTH && !newCode.includes('')) {
      submitCode(fullCode);
    }
  };

  // 处理退格键
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // 处理粘贴
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!pastedData) return;

    const newCode = [...code];
    pastedData.split('').forEach((d, i) => {
      if (i < CODE_LENGTH) newCode[i] = d;
    });
    setCode(newCode);

    const nextIndex = Math.min(pastedData.length, CODE_LENGTH - 1);
    inputRefs.current[nextIndex]?.focus();

    const fullCode = newCode.join('');
    if (fullCode.length === CODE_LENGTH && !newCode.includes('')) {
      submitCode(fullCode);
    }
  };

  // 重新发送验证码
  const handleResend = async () => {
    if (cooldown > 0 || !email) return;

    try {
      await authApi.resendVerification(email);
      setResendMessage(t('verifyEmail.resendSuccess'));
      setCooldown(COOLDOWN_SECONDS);
      setError('');
      setCode(Array(CODE_LENGTH).fill(''));
      setTimeout(() => {
        setResendMessage('');
        inputRefs.current[0]?.focus();
      }, 2000);
    } catch (err: any) {
      const errorData = err.response?.data;
      setError(errorData?.error?.message || '发送失败');
    }
  };

  // 没有 email 时显示错误
  if (!email) {
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
            <p className="text-gray-600 dark:text-foreground-secondary mb-6">{t('verifyEmail.noEmail')}</p>
            <Link to="/register">
              <Button variant="primary" className="w-full">{t('verifyEmail.backToRegister')}</Button>
            </Link>
          </div>
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

        {/* Verification Card */}
        <div className="bg-white dark:bg-background-elevated rounded-2xl p-8 shadow-xl border border-gray-200 dark:border-border-primary">
          {status === 'success' ? (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-foreground-primary mb-2">{t('verifyEmail.success')}</h2>
              <p className="text-gray-600 dark:text-foreground-secondary">{t('verifyEmail.successDescription')}</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-foreground-primary mb-2">
                  {t('verifyEmail.title')}
                </h2>
                <p className="text-gray-600 dark:text-foreground-secondary text-sm">
                  {t('verifyEmail.description').replace('{email}', email)}
                </p>
              </div>

              {resendMessage && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 rounded-lg text-green-700 dark:text-green-400 text-sm text-center">
                  {resendMessage}
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg text-red-700 dark:text-red-400 text-sm text-center">
                  {error}
                </div>
              )}

              {/* 6位验证码输入框 */}
              <div className="flex justify-center gap-3 mb-6" onPaste={handlePaste}>
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    disabled={status === 'loading'}
                    autoFocus={index === 0}
                    className="w-12 h-14 text-center text-2xl font-bold bg-white dark:bg-background-secondary border-2 border-gray-300 dark:border-border-primary rounded-lg text-gray-900 dark:text-foreground-primary focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent transition disabled:opacity-50"
                  />
                ))}
              </div>

              {status === 'loading' && (
                <div className="flex items-center justify-center gap-2 mb-4 text-gray-600 dark:text-foreground-secondary">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>{t('verifyEmail.verifying')}</span>
                </div>
              )}

              {/* 重新发送 */}
              <div className="text-center">
                <button
                  onClick={handleResend}
                  disabled={cooldown > 0}
                  className="text-sm text-banana-600 dark:text-banana-400 hover:text-banana-700 dark:hover:text-banana-300 disabled:text-gray-400 dark:disabled:text-foreground-tertiary disabled:cursor-not-allowed transition"
                >
                  {cooldown > 0
                    ? t('verifyEmail.resendIn').replace('{seconds}', String(cooldown))
                    : t('verifyEmail.resend')
                  }
                </button>
              </div>

              {/* 返回链接 */}
              <div className="mt-6 text-center">
                <Link to="/login" className="text-sm text-gray-500 dark:text-foreground-tertiary hover:text-gray-700 dark:hover:text-foreground-secondary transition">
                  {t('verifyEmail.backToLogin')}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
