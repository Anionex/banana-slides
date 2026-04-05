import { useEffect, useState } from 'react';
import { Users, Crown, Zap, Coins } from 'lucide-react';
import { adminApi } from '../../api/admin';

interface Stats {
  total_users: number;
  active_subscriptions: number;
  today_generations: number;
  total_points_issued: number;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    adminApi.getStats().then((res) => setStats(res.data.data));
  }, []);

  const cards = stats
    ? [
        { label: '总用户数', value: stats.total_users, icon: Users, color: 'text-blue-500 bg-blue-50' },
        { label: '活跃订阅', value: stats.active_subscriptions, icon: Crown, color: 'text-amber-500 bg-amber-50' },
        { label: '今日生成次数', value: stats.today_generations, icon: Zap, color: 'text-[var(--banana-yellow-dark)] bg-[var(--banana-yellow-pale)]' },
        { label: '累计发放积分', value: stats.total_points_issued, icon: Coins, color: 'text-purple-500 bg-purple-50' },
      ]
    : [];

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-6">概览</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[var(--bg-elevated)] rounded-2xl p-5 border border-[var(--border-secondary)]">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon size={20} />
            </div>
            <div className="text-2xl font-bold text-[var(--text-primary)]">{value.toLocaleString()}</div>
            <div className="text-sm text-[var(--text-secondary)] mt-0.5">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
