import { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, Phone, User, X } from 'lucide-react';

import { authApi } from '../../api/auth';
import { useUserStore } from '../../store/useUserStore';

type Tab = 'phone' | 'password';
type Mode = 'login' | 'register';

export function LoginModal() {
  const { loginModalOpen, closeLoginModal, setAuth } = useUserStore();
  const [tab, setTab] = useState<Tab>('password');
  const [mode, setMode] = useState<Mode>('login');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loginModalOpen) {
      setError('');
      setLoading(false);
      setMode('login');
      setTab('password');
      setPhone('');
      setCode('');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setShowPwd(false);
      setShowConfirmPwd(false);
    }
  }, [loginModalOpen]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  if (!loginModalOpen) return null;

  const finishAuth = (payload: any) => {
    const { user, access_token, refresh_token } = payload.data.data;
    setAuth(user, access_token, refresh_token);
  };

  const toggleMode = () => {
    setMode((current) => (current === 'login' ? 'register' : 'login'));
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSendCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入正确的手机号');
      return;
    }
    try {
      setLoading(true);
      setError('');
      await authApi.sendSms(phone);
      setCountdown(60);
    } catch (e: any) {
      setError(e.response?.data?.error || '发送失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSubmit = async () => {
    if (!phone || !code) {
      setError('请填写手机号和验证码');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const fn = mode === 'register' ? authApi.register : authApi.loginPhone;
      const payload: any = { phone, code };
      if (mode === 'register' && username.trim()) payload.username = username.trim();
      if (mode === 'register' && password) payload.password = password;
      const res = await fn(payload);
      finishAuth(res);
    } catch (e: any) {
      setError(e.response?.data?.error || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async () => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      setError(mode === 'register' ? '请填写用户名和密码' : '请填写账号和密码');
      return;
    }

    if (mode === 'register') {
      if (trimmedUsername.length < 3) {
        setError('用户名至少 3 个字符');
        return;
      }
      if (password.length < 6) {
        setError('密码至少 6 位');
        return;
      }
      if (password !== confirmPassword) {
        setError('两次输入的密码不一致');
        return;
      }
    }

    try {
      setLoading(true);
      setError('');
      const res = mode === 'register'
        ? await authApi.registerPassword({ username: trimmedUsername, password })
        : await authApi.loginPassword({ username: trimmedUsername, password });
      finishAuth(res);
    } catch (e: any) {
      setError(e.response?.data?.error || (mode === 'register' ? '注册失败' : '账号或密码错误'));
    } finally {
      setLoading(false);
    }
  };

  const submitText = loading
    ? (mode === 'register' ? '注册中...' : '登录中...')
    : (mode === 'register' ? '注册并登录' : '登录');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeLoginModal} />
      <div className="relative bg-[var(--bg-elevated)] rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <button
          onClick={closeLoginModal}
          className="absolute top-4 right-4 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <X size={18} />
        </button>

        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
          {mode === 'login' ? '登录' : '注册'}
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mb-5">
          {mode === 'login' ? '登录后即可使用全部功能' : '注册即送 100 积分'}
        </p>

        <div className="flex gap-1 bg-[var(--bg-secondary)] rounded-lg p-1 mb-5">
          {(['phone', 'password'] as Tab[]).map((item) => (
            <button
              key={item}
              onClick={() => {
                setTab(item);
                setError('');
              }}
              className={`flex-1 py-1.5 text-sm rounded-md transition-all ${
                tab === item
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm font-medium'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {item === 'phone' ? '手机验证码' : '账号密码'}
            </button>
          ))}
        </div>

        {tab === 'phone' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 border border-[var(--border-primary)] rounded-xl px-3 py-2.5 focus-within:border-[var(--banana-yellow)] transition-colors">
              <Phone size={16} className="text-[var(--text-tertiary)] shrink-0" />
              <input
                type="tel"
                placeholder="手机号"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
              />
              <button
                onClick={handleSendCode}
                disabled={loading || countdown > 0}
                className="text-xs text-[var(--banana-yellow-dark)] disabled:opacity-50"
              >
                {countdown > 0 ? `${countdown}s` : '验证码'}
              </button>
            </div>
            <div className="flex items-center gap-2 border border-[var(--border-primary)] rounded-xl px-3 py-2.5 focus-within:border-[var(--banana-yellow)] transition-colors">
              <Lock size={16} className="text-[var(--text-tertiary)] shrink-0" />
              <input
                type="text"
                placeholder="验证码"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
              />
            </div>
            {mode === 'register' && (
              <div className="flex items-center gap-2 border border-[var(--border-primary)] rounded-xl px-3 py-2.5 focus-within:border-[var(--banana-yellow)] transition-colors">
                <User size={16} className="text-[var(--text-tertiary)] shrink-0" />
                <input
                  type="text"
                  placeholder="用户名，可选"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
                />
              </div>
            )}
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button
              onClick={handlePhoneSubmit}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-[var(--banana-yellow)] text-white font-medium text-sm hover:bg-[var(--banana-yellow-dark)] disabled:opacity-60 transition-colors"
            >
              {submitText}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 border border-[var(--border-primary)] rounded-xl px-3 py-2.5 focus-within:border-[var(--banana-yellow)] transition-colors">
              <User size={16} className="text-[var(--text-tertiary)] shrink-0" />
              <input
                type="text"
                placeholder={mode === 'register' ? '用户名' : '手机号 / 用户名'}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
              />
            </div>
            <div className="flex items-center gap-2 border border-[var(--border-primary)] rounded-xl px-3 py-2.5 focus-within:border-[var(--banana-yellow)] transition-colors">
              <Lock size={16} className="text-[var(--text-tertiary)] shrink-0" />
              <input
                type={showPwd ? 'text' : 'password'}
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
              />
              <button onClick={() => setShowPwd(!showPwd)} className="text-[var(--text-tertiary)]">
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {mode === 'register' && (
              <div className="flex items-center gap-2 border border-[var(--border-primary)] rounded-xl px-3 py-2.5 focus-within:border-[var(--banana-yellow)] transition-colors">
                <Lock size={16} className="text-[var(--text-tertiary)] shrink-0" />
                <input
                  type={showConfirmPwd ? 'text' : 'password'}
                  placeholder="确认密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
                />
                <button onClick={() => setShowConfirmPwd(!showConfirmPwd)} className="text-[var(--text-tertiary)]">
                  {showConfirmPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            )}
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button
              onClick={handlePasswordSubmit}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-[var(--banana-yellow)] text-white font-medium text-sm hover:bg-[var(--banana-yellow-dark)] disabled:opacity-60 transition-colors"
            >
              {submitText}
            </button>
          </div>
        )}

        <p className="text-center text-xs text-[var(--text-tertiary)] mt-4">
          {mode === 'login' ? '没有账号？' : '已有账号？'}
          <button
            onClick={toggleMode}
            className="text-[var(--banana-yellow-dark)] hover:underline ml-1"
          >
            {mode === 'login' ? '立即注册' : '去登录'}
          </button>
        </p>
      </div>
    </div>
  );
}
