import { useState, useEffect } from 'react';
import { X, Phone, Lock, User, Eye, EyeOff } from 'lucide-react';
import { useUserStore } from '../../store/useUserStore';
import { authApi } from '../../api/auth';

type Tab = 'phone' | 'password';
type Mode = 'login' | 'register';

export function LoginModal() {
  const { loginModalOpen, closeLoginModal, setAuth } = useUserStore();
  const [tab, setTab] = useState<Tab>('phone');
  const [mode, setMode] = useState<Mode>('login');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loginModalOpen) {
      setError('');
      setLoading(false);
    }
  }, [loginModalOpen]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  if (!loginModalOpen) return null;

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
    if (!phone || !code) { setError('请填写手机号和验证码'); return; }
    try {
      setLoading(true);
      setError('');
      const fn = mode === 'register' ? authApi.register : authApi.loginPhone;
      const payload: any = { phone, code };
      if (mode === 'register' && username) payload.username = username;
      if (mode === 'register' && password) payload.password = password;
      const res = await fn(payload);
      const { user, access_token, refresh_token } = res.data.data;
      setAuth(user, access_token, refresh_token);
    } catch (e: any) {
      setError(e.response?.data?.error || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!username || !password) { setError('请填写账号和密码'); return; }
    try {
      setLoading(true);
      setError('');
      const res = await authApi.loginPassword({ username, password });
      const { user, access_token, refresh_token } = res.data.data;
      setAuth(user, access_token, refresh_token);
    } catch (e: any) {
      setError(e.response?.data?.error || '账号或密码错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeLoginModal} />
      <div className="relative bg-[var(--bg-elevated)] rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        {/* Close */}
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

        {/* Tabs */}
        <div className="flex gap-1 bg-[var(--bg-secondary)] rounded-lg p-1 mb-5">
          {(['phone', 'password'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              className={`flex-1 py-1.5 text-sm rounded-md transition-all ${
                tab === t
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm font-medium'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t === 'phone' ? '手机验证码' : '账号密码'}
            </button>
          ))}
        </div>

        {tab === 'phone' ? (
          <div className="space-y-3">
            {/* Phone */}
            <div className="flex items-center gap-2 border border-[var(--border-primary)] rounded-xl px-3 py-2.5 focus-within:border-[var(--banana-yellow)] transition-colors">
              <Phone size={16} className="text-[var(--text-tertiary)] shrink-0" />
              <input
                type="tel"
                placeholder="手机号"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
              />
            </div>
            {/* Code */}
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 border border-[var(--border-primary)] rounded-xl px-3 py-2.5 focus-within:border-[var(--banana-yellow)] transition-colors">
                <Lock size={16} className="text-[var(--text-tertiary)] shrink-0" />
                <input
                  type="text"
                  placeholder="验证码"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={6}
                  className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
                />
              </div>
              <button
                onClick={handleSendCode}
                disabled={countdown > 0 || loading}
                className="shrink-0 px-3 py-2.5 text-sm rounded-xl border border-[var(--border-primary)] text-[var(--banana-yellow-dark)] hover:bg-[var(--bg-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                {countdown > 0 ? `${countdown}s` : '获取验证码'}
              </button>
            </div>
            {/* Register extras */}
            {mode === 'register' && (
              <>
                <div className="flex items-center gap-2 border border-[var(--border-primary)] rounded-xl px-3 py-2.5 focus-within:border-[var(--banana-yellow)] transition-colors">
                  <User size={16} className="text-[var(--text-tertiary)] shrink-0" />
                  <input
                    type="text"
                    placeholder="用户名（可选）"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
                  />
                </div>
                <div className="flex items-center gap-2 border border-[var(--border-primary)] rounded-xl px-3 py-2.5 focus-within:border-[var(--banana-yellow)] transition-colors">
                  <Lock size={16} className="text-[var(--text-tertiary)] shrink-0" />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    placeholder="设置密码（可选）"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
                  />
                  <button onClick={() => setShowPwd(!showPwd)} className="text-[var(--text-tertiary)]">
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </>
            )}
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button
              onClick={handlePhoneSubmit}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-[var(--banana-yellow)] text-white font-medium text-sm hover:bg-[var(--banana-yellow-dark)] disabled:opacity-60 transition-colors"
            >
              {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 border border-[var(--border-primary)] rounded-xl px-3 py-2.5 focus-within:border-[var(--banana-yellow)] transition-colors">
              <User size={16} className="text-[var(--text-tertiary)] shrink-0" />
              <input
                type="text"
                placeholder="手机号 / 用户名"
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
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button
              onClick={handlePasswordSubmit}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-[var(--banana-yellow)] text-white font-medium text-sm hover:bg-[var(--banana-yellow-dark)] disabled:opacity-60 transition-colors"
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </div>
        )}

        {/* Toggle login/register */}
        {tab === 'phone' && (
          <p className="text-center text-xs text-[var(--text-tertiary)] mt-4">
            {mode === 'login' ? '没有账号？' : '已有账号？'}
            <button
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
              className="text-[var(--banana-yellow-dark)] hover:underline ml-1"
            >
              {mode === 'login' ? '立即注册' : '去登录'}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
