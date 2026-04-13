import { useEffect, useState } from 'react';

import { Ban, Coins, Plus, Search, Shield } from 'lucide-react';

import { adminApi } from '../../api/admin';

interface UserRow {
  id: string;
  phone: string | null;
  username: string | null;
  role: string;
  points: number;
  is_active: boolean;
  created_at: string;
}

interface CreateAdminForm {
  username: string;
  password: string;
  confirmPassword: string;
}

export function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [adjustModal, setAdjustModal] = useState<{
    user: UserRow;
    amount: string;
    desc: string;
  } | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateAdminForm>({
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  const load = async (targetPage = page, targetSearch = search) => {
    setLoading(true);
    try {
      const res = await adminApi.listUsers({
        page: targetPage,
        per_page: 20,
        search: targetSearch || undefined,
      });
      setUsers(res.data.data.items);
      setTotal(res.data.data.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1, '');
  }, []);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    load(1, search);
  };

  const toggleActive = async (user: UserRow) => {
    await adminApi.updateUser(user.id, { is_active: !user.is_active });
    load(page, search);
  };

  const toggleRole = async (user: UserRow) => {
    await adminApi.updateUser(user.id, { role: user.role === 'admin' ? 'user' : 'admin' });
    load(page, search);
  };

  const submitAdjust = async () => {
    if (!adjustModal) return;
    const amount = parseInt(adjustModal.amount, 10);
    if (Number.isNaN(amount) || amount === 0) return;
    await adminApi.adjustPoints(adjustModal.user.id, amount, adjustModal.desc || undefined);
    setAdjustModal(null);
    load(page, search);
  };

  const submitCreateAdmin = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError('');

    if (createForm.password !== createForm.confirmPassword) {
      setCreateError('两次输入的密码不一致');
      return;
    }

    setCreateLoading(true);
    try {
      await adminApi.createAdmin({
        username: createForm.username.trim(),
        password: createForm.password,
      });
      setCreateModalOpen(false);
      setCreateForm({ username: '', password: '', confirmPassword: '' });
      load(1, search);
    } catch (err: any) {
      setCreateError(err?.response?.data?.error || '创建管理员失败');
    } finally {
      setCreateLoading(false);
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">用户管理</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">共 {total} 位用户</p>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--banana-yellow)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--banana-yellow-dark)]"
        >
          <Plus size={16} />
          新建管理员
        </button>
      </div>

      <form onSubmit={handleSearch} className="mb-5 flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-elevated)] px-3 py-2">
          <Search size={15} className="text-[var(--text-tertiary)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索手机号或用户名"
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl bg-[var(--banana-yellow)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--banana-yellow-dark)]"
        >
          搜索
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-elevated)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-secondary)] bg-[var(--bg-secondary)]">
              <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">用户</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">角色</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">积分</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">状态</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">注册时间</th>
              <th className="px-4 py-3 text-right font-medium text-[var(--text-secondary)]">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-[var(--text-tertiary)]">
                  加载中...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-[var(--text-tertiary)]">
                  暂无数据
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-[var(--border-secondary)] transition-colors last:border-0 hover:bg-[var(--bg-hover)]"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--text-primary)]">{user.username || '未设置用户名'}</div>
                    <div className="text-xs text-[var(--text-tertiary)]">{user.phone || user.id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        user.role === 'admin'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {user.role === 'admin' ? '管理员' : '普通用户'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{user.points}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {user.is_active ? '正常' : '已封禁'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-tertiary)]">
                    {new Date(user.created_at).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setAdjustModal({ user, amount: '', desc: '' })}
                        title="调整积分"
                        className="rounded-lg p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--banana-yellow-dark)]"
                      >
                        <Coins size={14} />
                      </button>
                      <button
                        onClick={() => toggleRole(user)}
                        title={user.role === 'admin' ? '降为普通用户' : '设为管理员'}
                        className="rounded-lg p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-amber-600"
                      >
                        <Shield size={14} />
                      </button>
                      <button
                        onClick={() => toggleActive(user)}
                        title={user.is_active ? '封禁' : '解封'}
                        className="rounded-lg p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-red-500"
                      >
                        <Ban size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((targetPage) => (
            <button
              key={targetPage}
              onClick={() => {
                setPage(targetPage);
                load(targetPage, search);
              }}
              className={`h-8 w-8 rounded-lg text-sm transition-colors ${
                targetPage === page
                  ? 'bg-[var(--banana-yellow)] text-white'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              {targetPage}
            </button>
          ))}
        </div>
      )}

      {adjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setAdjustModal(null)} />
          <div className="relative w-80 rounded-2xl bg-[var(--bg-elevated)] p-6 shadow-2xl">
            <h3 className="mb-1 font-semibold text-[var(--text-primary)]">调整积分</h3>
            <p className="mb-4 text-sm text-[var(--text-secondary)]">
              {adjustModal.user.username || adjustModal.user.phone} · 当前 {adjustModal.user.points} 分
            </p>
            <input
              type="number"
              placeholder="积分数量（正数增加，负数扣减）"
              value={adjustModal.amount}
              onChange={(e) => setAdjustModal({ ...adjustModal, amount: e.target.value })}
              className="mb-3 w-full rounded-xl border border-[var(--border-primary)] bg-transparent px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--banana-yellow)]"
            />
            <input
              type="text"
              placeholder="备注（可选）"
              value={adjustModal.desc}
              onChange={(e) => setAdjustModal({ ...adjustModal, desc: e.target.value })}
              className="mb-4 w-full rounded-xl border border-[var(--border-primary)] bg-transparent px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--banana-yellow)]"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setAdjustModal(null)}
                className="flex-1 rounded-xl border border-[var(--border-primary)] py-2.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
              >
                取消
              </button>
              <button
                onClick={submitAdjust}
                className="flex-1 rounded-xl bg-[var(--banana-yellow)] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--banana-yellow-dark)]"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCreateModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-[var(--bg-elevated)] p-6 shadow-2xl">
            <h3 className="mb-1 font-semibold text-[var(--text-primary)]">新建管理员账号</h3>
            <p className="mb-4 text-sm text-[var(--text-secondary)]">
              新管理员会自动获得独立的系统设置空间。
            </p>

            <form onSubmit={submitCreateAdmin} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-[var(--text-secondary)]">用户名</label>
                <input
                  type="text"
                  value={createForm.username}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, username: e.target.value }))}
                  required
                  className="w-full rounded-xl border border-[var(--border-primary)] bg-transparent px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--banana-yellow)]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-[var(--text-secondary)]">密码</label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
                  required
                  className="w-full rounded-xl border border-[var(--border-primary)] bg-transparent px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--banana-yellow)]"
                />
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  至少 6 位，包含大小写字母和特殊字符。
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-[var(--text-secondary)]">确认密码</label>
                <input
                  type="password"
                  value={createForm.confirmPassword}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                  }
                  required
                  className="w-full rounded-xl border border-[var(--border-primary)] bg-transparent px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--banana-yellow)]"
                />
              </div>

              {createError && <p className="text-sm text-red-500">{createError}</p>}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="flex-1 rounded-xl border border-[var(--border-primary)] py-2.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex-1 rounded-xl bg-[var(--banana-yellow)] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--banana-yellow-dark)] disabled:opacity-50"
                >
                  {createLoading ? '创建中...' : '创建管理员'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
