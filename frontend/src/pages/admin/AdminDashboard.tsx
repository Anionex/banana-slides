/**
 * Admin Dashboard page
 * Shows overview stats and user-growth chart
 */
import { useEffect, useState } from 'react';
import { useT } from '../../hooks/useT';
import StatsCard from '../../components/admin/StatsCard';
import SimpleBarChart from '../../components/admin/SimpleBarChart';
import { getStatsOverview, getUserGrowthTrend } from '../../api/adminApi';

const i18n = {
  zh: {
    title: '管理后台',
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
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 dark:text-foreground-secondary">{t('loading')}</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex-1 flex items-center justify-center">
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
    <div className="max-w-7xl mx-auto px-6 py-6">
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
    </div>
  );
}
