import { useState } from 'react';
import { useAdminStore } from '../../store/useAdminStore';
import { adminApi } from '../../api/admin';

export function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAdminStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await adminApi.login(username, password);
      const { user, access_token, refresh_token } = res.data.data;
      setAuth(user, access_token, refresh_token);
    } catch (err: any) {
      setError(err?.response?.data?.error || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-8 h-8 rounded-xl bg-[var(--banana-yellow)] flex items-center justify-center">
            <span className="text-white text-sm font-bold">F</span>
          </div>
          <span className="font-semibold text-[var(--text-primary)] text-lg">护小智PPT管理后台</span>
        </div>

        <form onSubmit={handleSubmit} className="bg-[var(--bg-elevated)] rounded-2xl border border-[var(--border-secondary)] p-6 space-y-4">
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1.5">账号</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="管理员账号"
              required
              className="w-full border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-sm bg-transparent text-[var(--text-primary)] outline-none focus:border-[var(--banana-yellow)]"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1.5">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="管理员密码"
              required
              className="w-full border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-sm bg-transparent text-[var(--text-primary)] outline-none focus:border-[var(--banana-yellow)]"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-[var(--banana-yellow)] text-white text-sm font-medium hover:bg-[var(--banana-yellow-dark)] transition-colors disabled:opacity-50"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
}
