import { useState } from 'react';

import { adminApi } from '../../api/admin';
import { useAdminStore } from '../../store/useAdminStore';

export function AdminAccount() {
  const admin = useAdminStore((state) => state.admin);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    setLoading(true);
    try {
      const response = await adminApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setSuccess(response.data?.message || '密码修改成功');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err?.response?.data?.error || '密码修改失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">账号安全</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          当前登录管理员：{admin?.username || admin?.phone || '未识别'}
        </p>
      </div>

      <div className="max-w-xl rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-elevated)] p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-[var(--text-secondary)]">当前密码</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-[var(--border-primary)] bg-transparent px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--banana-yellow)]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-[var(--text-secondary)]">新密码</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-[var(--border-primary)] bg-transparent px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--banana-yellow)]"
            />
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              至少 6 位，并包含大写字母、小写字母和特殊字符。
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-[var(--text-secondary)]">确认新密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-[var(--border-primary)] bg-transparent px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--banana-yellow)]"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-[var(--banana-yellow)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--banana-yellow-dark)] disabled:opacity-50"
          >
            {loading ? '提交中...' : '修改密码'}
          </button>
        </form>
      </div>
    </div>
  );
}
