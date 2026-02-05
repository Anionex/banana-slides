/**
 * Admin Dashboard page
 * Shows overview stats and user-growth chart
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../hooks/useT';
import StatsCard from '../../components/admin/StatsCard';
import SimpleBarChart from '../../components/admin/SimpleBarChart';
import { getStatsOverview, getUserGrowthTrend } from '../../api/adminApi';

const i18n = {
  zh: {
    title: '管理后台',
    backHome: '返回首页',
    manageUsers: '管理用户',
    auditTransactions: '积分明细',
    auditOrders: '订单审计',
    systemConfig: '系统配置',
    totalUsers: '总用户数',
    activeUsers: '活跃用户',
    verifiedUsers: '已验证用户',
    creditsConsumed: '总积分消耗',
    newToday: '今日新增',
    newThisWeek: '本周新增',
    newThisMonth: '本月新增',
    userGrowth: '用户增长趋势（近30天）',
    loading: '加载中...',
    error: '加载失败',
  },
  en: {
    title: 'Admin Dashboard',
    backHome: 'Back to Home',
    manageUsers: 'Manage Users',
    auditTransactions: 'Transactions',
    auditOrders: 'Orders',
    systemConfig: 'System Config',
    totalUsers: 'Total Users',
    activeUsers: 'Active Users',
    verifiedUsers: 'Verified Users',
    creditsConsumed: 'Credits Consumed',
    newToday: 'New Today',
    newThisWeek: 'New This Week',
    newThisMonth: 'New This Month',
    userGrowth: 'User Growth Trend (Last 30 Days)',
    loading: 'Loading...',
    error: 'Failed to load',
  },
};

interface OverviewStats {
  total_users: number;
  active_users: number;
  verified_users: number;
  total_credits_consumed: number;
  new_users_today: number;
  new_users_this_week: number;
  new_users_this_month: number;
}

interface GrowthData {
  labels: string[];
  values: number[];
}

export default function AdminDashboard() {
  const t = useT(i18n);
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [growth, setGrowth] = useState<GrowthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [statsRes, growthRes] = await Promise.all([
          getStatsOverview(),
          getUserGrowthTrend(30),
        ]);
        setStats(statsRes.data.data);
        setGrowth(growthRes.data.data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background-primary">
        <p className="text-gray-500 dark:text-foreground-secondary">{t('loading')}</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background-primary">
        <p className="text-red-500">{t('error')}</p>
      </div>
    );
  }

  const cards: { key: string; value: number }[] = [
    { key: 'totalUsers', value: stats.total_users },
    { key: 'activeUsers', value: stats.active_users },
    { key: 'verifiedUsers', value: stats.verified_users },
    { key: 'creditsConsumed', value: stats.total_credits_consumed },
    { key: 'newToday', value: stats.new_users_today },
    { key: 'newThisWeek', value: stats.new_users_this_week },
    { key: 'newThisMonth', value: stats.new_users_this_month },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background-primary">
      {/* Nav */}
      <header className="bg-white dark:bg-background-secondary border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-foreground-primary">{t('title')}</h1>
        <div className="flex items-center gap-4">
          <Link
            to="/admin/users"
            className="px-4 py-2 bg-banana-500 text-white rounded-lg hover:bg-banana-600 text-sm font-medium"
          >
            {t('manageUsers')}
          </Link>
          <Link
            to="/admin/transactions"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium"
          >
            {t('auditTransactions')}
          </Link>
          <Link
            to="/admin/orders"
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium"
          >
            {t('auditOrders')}
          </Link>
          <Link
            to="/admin/config"
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm font-medium"
          >
            {t('systemConfig')}
          </Link>
          <Link
            to="/app"
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-foreground-secondary dark:hover:text-foreground-primary"
          >
            {t('backHome')}
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          {cards.map((c) => (
            <StatsCard key={c.key} label={t(c.key)} value={c.value} />
          ))}
        </div>

        {/* Growth chart */}
        {growth && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-background-secondary p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 dark:text-foreground-primary mb-4">
              {t('userGrowth')}
            </h2>
            <SimpleBarChart labels={growth.labels} values={growth.values} />
          </div>
        )}
      </main>
    </div>
  );
}
