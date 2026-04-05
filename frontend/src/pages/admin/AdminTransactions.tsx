import { useEffect, useState } from 'react';
import { adminApi } from '../../api/admin';

interface TxRow {
  id: number;
  user_id: number;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
  user?: { phone: string | null; username: string | null };
}

const TYPE_LABELS: Record<string, string> = {
  register_bonus: '注册赠送',
  generation: 'PPT生成',
  purchase: '充值购买',
  admin_adjust: '管理员调整',
};

export function AdminTransactions() {
  const [items, setItems] = useState<TxRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = async (p = page) => {
    setLoading(true);
    try {
      const res = await adminApi.listTransactions({ page: p, per_page: 20 });
      setItems(res.data.data.items);
      setTotal(res.data.data.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, []);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">积分流水</h1>
        <span className="text-sm text-[var(--text-secondary)]">共 {total} 条</span>
      </div>

      <div className="bg-[var(--bg-elevated)] rounded-2xl border border-[var(--border-secondary)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-secondary)] bg-[var(--bg-secondary)]">
              <th className="text-left px-4 py-3 text-[var(--text-secondary)] font-medium">用户</th>
              <th className="text-left px-4 py-3 text-[var(--text-secondary)] font-medium">类型</th>
              <th className="text-left px-4 py-3 text-[var(--text-secondary)] font-medium">积分变动</th>
              <th className="text-left px-4 py-3 text-[var(--text-secondary)] font-medium">备注</th>
              <th className="text-left px-4 py-3 text-[var(--text-secondary)] font-medium">时间</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-10 text-[var(--text-tertiary)]">加载中...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-[var(--text-tertiary)]">暂无数据</td></tr>
            ) : items.map((tx) => (
              <tr key={tx.id} className="border-b border-[var(--border-secondary)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors">
                <td className="px-4 py-3">
                  <div className="text-[var(--text-primary)]">{tx.user?.username || '—'}</div>
                  <div className="text-xs text-[var(--text-tertiary)]">{tx.user?.phone || `ID: ${tx.user_id}`}</div>
                </td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">
                  {TYPE_LABELS[tx.type] || tx.type}
                </td>
                <td className="px-4 py-3">
                  <span className={`font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount}
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--text-tertiary)] text-xs max-w-[200px] truncate">
                  {tx.description || '—'}
                </td>
                <td className="px-4 py-3 text-xs text-[var(--text-tertiary)]">
                  {new Date(tx.created_at).toLocaleString('zh-CN')}
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
              onClick={() => { setPage(p); load(p); }}
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
