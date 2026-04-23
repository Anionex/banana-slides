import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCcw, Save, Star, Trash2, WalletCards } from 'lucide-react';

import { adminApi } from '../../api/admin';
import type { AdminRechargePackage, AdminSubscriptionPlan } from '../../api/admin';

interface PricingRow {
  id: string;
  name: string;
  points: string;
  price: string;
  popular: boolean;
}

interface SubscriptionRow {
  id: 'monthly' | 'yearly';
  name: string;
  days: string;
  price: string;
  popular: boolean;
}

const toPriceString = (amountCents: number) => {
  const value = amountCents / 100;
  return value.toFixed(amountCents % 100 === 0 ? 0 : 2);
};

const fromPackage = (item: AdminRechargePackage): PricingRow => ({
  id: item.id,
  name: item.name,
  points: String(item.points),
  price: toPriceString(item.amount_cents),
  popular: item.popular,
});

const fromSubscriptionPlan = (item: AdminSubscriptionPlan): SubscriptionRow => ({
  id: item.id,
  name: item.name,
  days: String(item.days),
  price: toPriceString(item.amount_cents),
  popular: item.popular,
});

const makePackageId = (points: string, index: number) => {
  const safePoints = points.replace(/[^0-9]/g, '') || `${index + 1}`;
  return `points_${safePoints}`;
};

const yuanToCents = (value: string) => Math.round((Number(value) || 0) * 100);

const sourceLabel = (source: string) => {
  if (source === 'database') return '后台定价';
  return '系统默认';
};

export function AdminPricing() {
  const [rows, setRows] = useState<PricingRow[]>([]);
  const [subscriptionRows, setSubscriptionRows] = useState<SubscriptionRow[]>([]);
  const [source, setSource] = useState('');
  const [subscriptionSource, setSubscriptionSource] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      // 积分和订阅定价都由后台数据库管理，页面加载时一次性拉齐两组配置。
      const [rechargeRes, subscriptionRes] = await Promise.all([
        adminApi.getRechargePackages(),
        adminApi.getSubscriptionPlans(),
      ]);
      setRows((rechargeRes.data.data.items || []).map(fromPackage));
      setSource(rechargeRes.data.data.source || '');
      setSubscriptionRows((subscriptionRes.data.data.items || []).map(fromSubscriptionPlan));
      setSubscriptionSource(subscriptionRes.data.data.source || '');
    } catch (err: any) {
      setError(err?.response?.data?.error || '读取定价失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(() => {
    const totalPoints = rows.reduce((sum, row) => sum + (parseInt(row.points, 10) || 0), 0);
    const minPrice = rows.reduce<number | null>((min, row) => {
      const price = Number(row.price);
      if (!Number.isFinite(price) || price <= 0) return min;
      return min === null ? price : Math.min(min, price);
    }, null);
    return { totalPoints, minPrice };
  }, [rows]);

  const updateRow = (index: number, patch: Partial<PricingRow>) => {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };

  const updateSubscriptionRow = (index: number, patch: Partial<SubscriptionRow>) => {
    setSubscriptionRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
  };

  const setPopular = (index: number) => {
    setRows((current) => current.map((row, rowIndex) => ({ ...row, popular: rowIndex === index })));
  };

  const setSubscriptionPopular = (index: number) => {
    setSubscriptionRows((current) => current.map((row, rowIndex) => ({ ...row, popular: rowIndex === index })));
  };

  const addRow = () => {
    setRows((current) => {
      const nextIndex = current.length + 1;
      return [
        ...current,
        {
          id: `points_${nextIndex * 100}`,
          name: `${nextIndex * 100} 积分`,
          points: String(nextIndex * 100),
          price: '',
          popular: current.length === 0,
        },
      ];
    });
  };

  const removeRow = (index: number) => {
    setRows((current) => {
      const next = current.filter((_, rowIndex) => rowIndex !== index);
      if (next.length > 0 && !next.some((row) => row.popular)) {
        next[0] = { ...next[0], popular: true };
      }
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      // 保存时同时提交两类定价，避免用户看到一半成功一半还是旧值。
      const rechargePayload = rows.map((row, index) => ({
        id: row.id.trim() || makePackageId(row.points, index),
        name: row.name.trim() || `${parseInt(row.points, 10) || 0} 积分`,
        points: parseInt(row.points, 10),
        amount_cents: yuanToCents(row.price),
        popular: row.popular,
      }));
      const subscriptionPayload = subscriptionRows.map((row) => ({
        id: row.id,
        name: row.name.trim() || (row.id === 'yearly' ? '年度订阅' : '月度订阅'),
        days: parseInt(row.days, 10),
        amount_cents: yuanToCents(row.price),
        popular: row.popular,
      }));
      const [rechargeRes, subscriptionRes] = await Promise.all([
        adminApi.updateRechargePackages(rechargePayload),
        adminApi.updateSubscriptionPlans(subscriptionPayload),
      ]);
      setRows((rechargeRes.data.data.items || []).map(fromPackage));
      setSource(rechargeRes.data.data.source || 'database');
      setSubscriptionRows((subscriptionRes.data.data.items || []).map(fromSubscriptionPlan));
      setSubscriptionSource(subscriptionRes.data.data.source || 'database');
      setMessage('定价已保存');
    } catch (err: any) {
      setError(err?.response?.data?.error || '保存定价失败');
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      // 重置不是清空配置，而是把默认定价重新写入数据库。
      const [rechargeRes, subscriptionRes] = await Promise.all([
        adminApi.resetRechargePackages(),
        adminApi.resetSubscriptionPlans(),
      ]);
      setRows((rechargeRes.data.data.items || []).map(fromPackage));
      setSource(rechargeRes.data.data.source || '');
      setSubscriptionRows((subscriptionRes.data.data.items || []).map(fromSubscriptionPlan));
      setSubscriptionSource(subscriptionRes.data.data.source || '');
      setMessage('已恢复默认定价');
    } catch (err: any) {
      setError(err?.response?.data?.error || '恢复默认定价失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">定价</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">配置微信充值套餐和订阅价格</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={reset}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCcw size={16} />
            恢复默认
          </button>
          <button
            onClick={save}
            disabled={saving || loading || rows.length === 0 || subscriptionRows.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--banana-yellow)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--banana-yellow-dark)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={16} />
            保存
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-elevated)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <WalletCards size={16} />
            积分套餐
          </div>
          <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{rows.length}</div>
        </div>
        <div className="rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-elevated)] p-4">
          <div className="text-sm text-[var(--text-secondary)]">总积分档位</div>
          <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{summary.totalPoints}</div>
        </div>
        <div className="rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-elevated)] p-4">
          <div className="text-sm text-[var(--text-secondary)]">配置来源</div>
          <div className="mt-2 text-sm font-medium text-[var(--text-primary)]">
            积分：{sourceLabel(source)}，订阅：{sourceLabel(subscriptionSource)}
            {summary.minPrice !== null && <span className="ml-2 text-[var(--text-tertiary)]">最低 ￥{summary.minPrice}</span>}
          </div>
        </div>
      </div>

      {(error || message) && (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
            error ? 'border-red-100 bg-red-50 text-red-600' : 'border-green-100 bg-green-50 text-green-700'
          }`}
        >
          {error || message}
        </div>
      )}

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">积分充值</h2>
        <div className="overflow-hidden rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-elevated)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-secondary)] bg-[var(--bg-secondary)]">
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">套餐 ID</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">名称</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">积分</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">价格</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">推荐</th>
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
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-[var(--text-tertiary)]">
                    暂无套餐
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={`${row.id}-${index}`} className="border-b border-[var(--border-secondary)] last:border-0">
                    <td className="px-4 py-3">
                      <input
                        value={row.id}
                        onChange={(event) => updateRow(index, { id: event.target.value })}
                        className="w-36 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--banana-yellow)]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={row.name}
                        onChange={(event) => updateRow(index, { name: event.target.value })}
                        className="w-36 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--banana-yellow)]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={row.points}
                        onChange={(event) => updateRow(index, { points: event.target.value })}
                        className="w-28 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--banana-yellow)]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <MoneyInput value={row.price} onChange={(price) => updateRow(index, { price })} />
                    </td>
                    <td className="px-4 py-3">
                      <PopularButton active={row.popular} onClick={() => setPopular(index)} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => removeRow(index)}
                        disabled={rows.length <= 1}
                        className="inline-flex items-center justify-center rounded-lg p-2 text-[var(--text-tertiary)] transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                        title="删除套餐"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <button
          onClick={addRow}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          <Plus size={16} />
          添加套餐
        </button>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">订阅套餐</h2>
        <div className="overflow-hidden rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-elevated)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-secondary)] bg-[var(--bg-secondary)]">
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">方案</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">名称</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">天数</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">价格</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">推荐</th>
              </tr>
            </thead>
            <tbody>
              {subscriptionRows.map((row, index) => (
                <tr key={row.id} className="border-b border-[var(--border-secondary)] last:border-0">
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{row.id}</td>
                  <td className="px-4 py-3">
                    <input
                      value={row.name}
                      onChange={(event) => updateSubscriptionRow(index, { name: event.target.value })}
                      className="w-36 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--banana-yellow)]"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={row.days}
                      onChange={(event) => updateSubscriptionRow(index, { days: event.target.value })}
                      className="w-28 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--banana-yellow)]"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <MoneyInput value={row.price} onChange={(price) => updateSubscriptionRow(index, { price })} />
                  </td>
                  <td className="px-4 py-3">
                    <PopularButton active={row.popular} onClick={() => setSubscriptionPopular(index)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MoneyInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex w-32 items-center rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 focus-within:border-[var(--banana-yellow)]">
      <span className="mr-1 text-[var(--text-tertiary)]">￥</span>
      <input
        type="number"
        min="0.01"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none"
      />
    </div>
  );
}

function PopularButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
        active
          ? 'bg-[var(--banana-yellow-pale)] text-[var(--banana-yellow-dark)]'
          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
      }`}
    >
      <Star size={13} />
      {active ? '推荐' : '设为推荐'}
    </button>
  );
}
