/**
 * Admin Users page
 * User management with search, filters, pagination, and actions
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../hooks/useT';
import UserTable from '../../components/admin/UserTable';
import AdjustCreditsModal from '../../components/admin/AdjustCreditsModal';
import {
  getAdminUsers,
  adjustUserCredits,
  toggleUserActive,
  changeUserSubscription,
} from '../../api/adminApi';
import type { User } from '../../store/useAuthStore';

const PAGE_SIZE = 20;

const i18n = {
  zh: {
    title: '用户管理',
    backDashboard: '返回仪表盘',
    searchPlaceholder: '搜索邮箱或用户名...',
    allPlans: '全部套餐',
    allStatus: '全部状态',
    active: '启用',
    inactive: '禁用',
    verified: '已验证',
    prev: '上一页',
    next: '下一页',
    total: '共 {{count}} 位用户',
    loading: '加载中...',
    error: '加载失败',
    confirmDisable: '确定要禁用此用户吗？',
    confirmEnable: '确定要启用此用户吗？',
    changePlanTitle: '修改套餐',
    changePlanPrompt: '选择新套餐（free / pro / enterprise）：',
  },
  en: {
    title: 'User Management',
    backDashboard: 'Back to Dashboard',
    searchPlaceholder: 'Search email or username...',
    allPlans: 'All Plans',
    allStatus: 'All Status',
    active: 'Active',
    inactive: 'Inactive',
    verified: 'Verified',
    prev: 'Previous',
    next: 'Next',
    total: '{{count}} users total',
    loading: 'Loading...',
    error: 'Failed to load',
    confirmDisable: 'Disable this user?',
    confirmEnable: 'Enable this user?',
    changePlanTitle: 'Change Plan',
    changePlanPrompt: 'Choose new plan (free / pro / enterprise):',
  },
};

export default function AdminUsers() {
  const t = useT(i18n);

  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Modal state
  const [creditsTarget, setCreditsTarget] = useState<User | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await getAdminUsers({
        limit: PAGE_SIZE,
        offset,
        search: search || undefined,
        filter_plan: filterPlan || undefined,
        filter_status: filterStatus || undefined,
      });
      const data = res.data.data;
      setUsers(data.users);
      setTotal(data.total);
      setHasMore(data.has_more);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [offset, search, filterPlan, filterStatus]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Reset offset when filters change
  useEffect(() => {
    setOffset(0);
  }, [search, filterPlan, filterStatus]);

  const handleAdjustCredits = async (amount: number, reason: string) => {
    if (!creditsTarget) return;
    try {
      await adjustUserCredits(creditsTarget.id, amount, reason);
      setCreditsTarget(null);
      fetchUsers();
    } catch {
      // error handled by interceptor
    }
  };

  const handleToggleActive = async (user: User) => {
    const msg = user.is_active ? t('confirmDisable') : t('confirmEnable');
    if (!window.confirm(msg)) return;
    try {
      await toggleUserActive(user.id, !user.is_active);
      fetchUsers();
    } catch {
      // error handled by interceptor
    }
  };

  const handleChangePlan = async (user: User) => {
    const plan = window.prompt(t('changePlanPrompt'), user.subscription_plan);
    if (!plan || !['free', 'pro', 'enterprise'].includes(plan)) return;
    try {
      await changeUserSubscription(user.id, plan);
      fetchUsers();
    } catch {
      // error handled by interceptor
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background-primary">
      {/* Nav */}
      <header className="bg-white dark:bg-background-secondary border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-foreground-primary">{t('title')}</h1>
        <Link
          to="/admin"
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-foreground-secondary dark:hover:text-foreground-primary"
        >
          {t('backDashboard')}
        </Link>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-background-secondary text-gray-900 dark:text-foreground-primary text-sm focus:ring-2 focus:ring-banana-500 outline-none w-64"
          />
          <select
            value={filterPlan}
            onChange={(e) => setFilterPlan(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-background-secondary text-gray-900 dark:text-foreground-primary text-sm"
          >
            <option value="">{t('allPlans')}</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-background-secondary text-gray-900 dark:text-foreground-primary text-sm"
          >
            <option value="">{t('allStatus')}</option>
            <option value="active">{t('active')}</option>
            <option value="inactive">{t('inactive')}</option>
            <option value="verified">{t('verified')}</option>
          </select>
          <span className="ml-auto text-sm text-gray-500 dark:text-foreground-secondary">
            {t('total', { count: total })}
          </span>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-background-secondary shadow-sm overflow-hidden">
          {loading ? (
            <p className="text-center py-8 text-gray-500 dark:text-foreground-secondary">
              {t('loading')}
            </p>
          ) : error ? (
            <p className="text-center py-8 text-red-500">{t('error')}</p>
          ) : (
            <UserTable
              users={users}
              onAdjustCredits={setCreditsTarget}
              onToggleActive={handleToggleActive}
              onChangePlan={handleChangePlan}
            />
          )}
        </div>

        {/* Pagination */}
        {!loading && !error && total > 0 && (
          <div className="flex items-center justify-center gap-4 mt-4">
            <button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-foreground-secondary hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('prev')}
            </button>
            <span className="text-sm text-gray-500 dark:text-foreground-secondary">
              {offset + 1}-{Math.min(offset + PAGE_SIZE, total)} / {total}
            </span>
            <button
              disabled={!hasMore}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-foreground-secondary hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('next')}
            </button>
          </div>
        )}
      </main>

      {/* Adjust credits modal */}
      {creditsTarget && (
        <AdjustCreditsModal
          userEmail={creditsTarget.email}
          currentBalance={creditsTarget.credits_balance}
          onConfirm={handleAdjustCredits}
          onClose={() => setCreditsTarget(null)}
        />
      )}
    </div>
  );
}
