import { useEffect, useState } from 'react';
import { Search, Shield, Ban, Coins } from 'lucide-react';
import { adminApi } from '../../api/admin';

interface UserRow {
  id: number;
  phone: string | null;
  username: string | null;
  role: string;
  points: number;
  is_active: boolean;
  created_at: string;
}

export function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [adjustModal, setAdjustModal] = useState<{ user: UserRow; amount: string; desc: string } | null>(null);

  const load = async (p = page, s = search) => {
    setLoading(true);
    try {
      const res = await adminApi.listUsers({ page: p, per_page: 20, search: s || undefined });
      setUsers(res.data.data.items);
      setTotal(res.data.data.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1, ''); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
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
    const amount = parseInt(adjustModal.amount);
    if (isNaN(amount) || amount === 0) return;
    await adminApi.adjustPoints(adjustModal.user.id, amount, adjustModal.desc || undefined);
    setAdjustModal(null);
    load(page, search);
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">用户管理</h1>
        <span className="text-sm text-[var(--text-secondary)]">共 {total} 位用户</span>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-5">
        <div className="flex-1 flex items-center gap-2 bg-[var(--bg-elevated)] border border-[var(--border-primary)] rounded-xl px-3 py-2">
          <Search size={15} className="text-[var(--text-tertiary)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索手机号或用户名"
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
          />
        </div>
        <button type="submit" className="px-4 py-2 rounded-xl bg-[var(--banana-yellow)] text-white text-sm font-medium hover:bg-[var(--banana-yellow-dark)] transition-colors">
          搜索
        </button>
      </form>

      {/* Table */}
      <div className="bg-[var(--bg-elevated)] rounded-2xl border border-[var(--border-secondary)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-secondary)] bg-[var(--bg-secondary)]">
              <th className="text-left px-4 py-3 text-[var(--text-secondary)] font-medium">用户</th>
              <th className="text-left px-4 py-3 text-[var(--text-secondary)] font-medium">角色</th>
              <th className="text-left px-4 py-3 text-[var(--text-secondary)] font-medium">积分</th>
              <th className="text-left px-4 py-3 text-[var(--text-secondary)] font-medium">状态</th>
              <th className="text-left px-4 py-3 text-[var(--text-secondary)] font-medium">注册时间</th>
              <th className="text-right px-4 py-3 text-[var(--text-secondary)] font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-[var(--text-tertiary)]">加载中...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-[var(--text-tertiary)]">暂无数据</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="border-b border-[var(--border-secondary)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-[var(--text-primary)]">{u.username || '—'}</div>
                  <div className="text-xs text-[var(--text-tertiary)]">{u.phone || '—'}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}>
                    {u.role === 'admin' ? '管理员' : '普通用户'}
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--text-primary)] font-medium">{u.points}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {u.is_active ? '正常' : '已封禁'}
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--text-tertiary)] text-xs">
                  {new Date(u.created_at).toLocaleDateString('zh-CN')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setAdjustModal({ user: u, amount: '', desc: '' })}
                      title="调整积分"
                      className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-[var(--banana-yellow-dark)] transition-colors"
                    >
                      <Coins size={14} />
                    </button>
                    <button
                      onClick={() => toggleRole(u)}
                      title={u.role === 'admin' ? '降为普通用户' : '设为管理员'}
                      className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-amber-600 transition-colors"
                    >
                      <Shield size={14} />
                    </button>
                    <button
                      onClick={() => toggleActive(u)}
                      title={u.is_active ? '封禁' : '解封'}
                      className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-red-500 transition-colors"
                    >
                      <Ban size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => { setPage(p); load(p, search); }}
              className={`w-8 h-8 rounded-lg text-sm transition-colors ${p === page ? 'bg-[var(--banana-yellow)] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Adjust Points Modal */}
      {adjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setAdjustModal(null)} />
          <div className="relative bg-[var(--bg-elevated)] rounded-2xl shadow-2xl p-6 w-80">
            <h3 className="font-semibold text-[var(--text-primary)] mb-1">调整积分</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              {adjustModal.user.username || adjustModal.user.phone} · 当前 {adjustModal.user.points} 分
            </p>
            <input
              type="number"
              placeholder="积分数量（正数增加，负数扣除）"
              value={adjustModal.amount}
              onChange={(e) => setAdjustModal({ ...adjustModal, amount: e.target.value })}
              className="w-full border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-sm bg-transparent text-[var(--text-primary)] outline-none focus:border-[var(--banana-yellow)] mb-3"
            />
            <input
              type="text"
              placeholder="备注（可选）"
              value={adjustModal.desc}
              onChange={(e) => setAdjustModal({ ...adjustModal, desc: e.target.value })}
              className="w-full border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-sm bg-transparent text-[var(--text-primary)] outline-none focus:border-[var(--banana-yellow)] mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setAdjustModal(null)} className="flex-1 py-2.5 rounded-xl border border-[var(--border-primary)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors">取消</button>
              <button onClick={submitAdjust} className="flex-1 py-2.5 rounded-xl bg-[var(--banana-yellow)] text-white text-sm font-medium hover:bg-[var(--banana-yellow-dark)] transition-colors">确认</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
