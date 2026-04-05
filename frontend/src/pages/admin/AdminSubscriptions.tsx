import { useEffect, useState } from 'react';
import { adminApi } from '../../api/admin';

interface SubRow {
  id: number;
  user_id: number;
  plan: string;
  status: string;
  start_date: string;
  end_date: string;
  user?: { phone: string | null; username: string | null };
}

const PLAN_LABELS: Record<string, string> = { monthly: '月度', yearly: '年度' };
const STATUS_LABELS: Record<string, string> = { active: '有效', expired: '已过期', cancelled: '已取消' };
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  expired: 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)]',
  cancelled: 'bg-red-100 text-red-600',
};

export function AdminSubscriptions() {
  const [items, setItems] = useState<SubRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async (p = page, s = statusFilter) => {
    setLoading(true);
    try {
      const res = await adminApi.listSubscriptions({ page: p, per_page: 20, status: s || undefined });
      setItems(res.data.data.items);
      setTotal(res.data.data.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1, ''); }, []);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">订阅管理</h1>
        <span className="text-sm text-[var(--text-secondary)]">共 {total} 条</span>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-5">
        {['', 'active', 'expired', 'cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); load(1, s); }}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${statusFilter === s ? 'bg-[var(--banana-yellow)] text-white' : 'bg-[var(--bg-elevated)] border border-[var(--border-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
          >
            {s === '' ? '全部' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="bg-[var(--bg-elevated)] rounded-2xl border border-[var(--border-secondary)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-secondary)] bg-[var(--bg-secondary)]">
              <th className="text-left px-4 py-3 text-[var(--text-secondary)] font-medium">用户</th>
              <th className="text-left px-4 py-3 text-[var(--text-secondary)] font-medium">方案</th>
              <th className="text-left px-4 py-3 text-[var(--text-secondary)] font-medium">状态</th>
              <th className="text-left px-4 py-3 text-[var(--text-secondary)] font-medium">开始</th>
              <th className="text-left px-4 py-3 text-[var(--text-secondary)] font-medium">到期</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-10 text-[var(--text-tertiary)]">加载中...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-[var(--text-tertiary)]">暂无数据</td></tr>
            ) : items.map((sub) => (
              <tr key={sub.id} className="border-b border-[var(--border-secondary)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors">
                <td className="px-4 py-3">
                  <div className="text-[var(--text-primary)]">{sub.user?.username || '—'}</div>
                  <div className="text-xs text-[var(--text-tertiary)]">{sub.user?.phone || `ID: ${sub.user_id}`}</div>
                </td>
                <td className="px-4 py-3 text-[var(--text-primary)]">{PLAN_LABELS[sub.plan] || sub.plan}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[sub.status] || ''}`}>
                    {STATUS_LABELS[sub.status] || sub.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--text-tertiary)]">
                  {new Date(sub.start_date).toLocaleDateString('zh-CN')}
                </td>
                <td className="px-4 py-3 text-xs text-[var(--text-tertiary)]">
                  {new Date(sub.end_date).toLocaleDateString('zh-CN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => { setPage(p); load(p, statusFilter); }}
              className={`w-8 h-8 rounded-lg text-sm transition-colors ${p === page ? 'bg-[var(--banana-yellow)] text-white' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
