/**
 * UserTable - admin user list table
 */
import { useT } from '../../hooks/useT';
import type { User } from '../../store/useAuthStore';

const i18n = {
  zh: {
    id: 'ID',
    email: '邮箱',
    username: '用户名',
    plan: '套餐',
    credits: '积分',
    status: '状态',
    verified: '已验证',
    createdAt: '注册时间',
    lastLogin: '最后登录',
    actions: '操作',
    active: '启用',
    inactive: '禁用',
    yes: '是',
    no: '否',
    adjustCredits: '调整积分',
    disable: '禁用',
    enable: '启用',
    changePlan: '改套餐',
    noUsers: '暂无用户',
  },
  en: {
    id: 'ID',
    email: 'Email',
    username: 'Username',
    plan: 'Plan',
    credits: 'Credits',
    status: 'Status',
    verified: 'Verified',
    createdAt: 'Created',
    lastLogin: 'Last Login',
    actions: 'Actions',
    active: 'Active',
    inactive: 'Inactive',
    yes: 'Yes',
    no: 'No',
    adjustCredits: 'Credits',
    disable: 'Disable',
    enable: 'Enable',
    changePlan: 'Plan',
    noUsers: 'No users found',
  },
};

interface UserTableProps {
  users: User[];
  onAdjustCredits: (user: User) => void;
  onToggleActive: (user: User) => void;
  onChangePlan: (user: User) => void;
}

export default function UserTable({
  users,
  onAdjustCredits,
  onToggleActive,
  onChangePlan,
}: UserTableProps) {
  const t = useT(i18n);

  if (users.length === 0) {
    return (
      <p className="text-center py-8 text-gray-500 dark:text-foreground-secondary">
        {t('noUsers')}
      </p>
    );
  }

  const fmtDate = (s?: string | null) => {
    if (!s) return '-';
    return new Date(s).toLocaleDateString();
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="text-xs uppercase bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-foreground-secondary">
          <tr>
            <th className="px-3 py-2">{t('id')}</th>
            <th className="px-3 py-2">{t('email')}</th>
            <th className="px-3 py-2">{t('username')}</th>
            <th className="px-3 py-2">{t('plan')}</th>
            <th className="px-3 py-2">{t('credits')}</th>
            <th className="px-3 py-2">{t('status')}</th>
            <th className="px-3 py-2">{t('verified')}</th>
            <th className="px-3 py-2">{t('createdAt')}</th>
            <th className="px-3 py-2">{t('lastLogin')}</th>
            <th className="px-3 py-2">{t('actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className="px-3 py-2 text-gray-500 dark:text-foreground-secondary text-xs font-mono">
                {u.id}
              </td>
              <td className="px-3 py-2 text-gray-900 dark:text-foreground-primary font-medium max-w-[200px] truncate">
                {u.email}
              </td>
              <td className="px-3 py-2 text-gray-700 dark:text-foreground-secondary">
                {u.username || '-'}
              </td>
              <td className="px-3 py-2">
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-foreground-secondary">
                  {u.subscription_plan}
                </span>
              </td>
              <td className="px-3 py-2 text-gray-700 dark:text-foreground-secondary">
                {u.credits_balance}
              </td>
              <td className="px-3 py-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    u.is_active
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}
                >
                  {u.is_active ? t('active') : t('inactive')}
                </span>
              </td>
              <td className="px-3 py-2 text-gray-700 dark:text-foreground-secondary">
                {u.email_verified ? t('yes') : t('no')}
              </td>
              <td className="px-3 py-2 text-gray-500 dark:text-foreground-secondary text-xs">
                {fmtDate(u.created_at)}
              </td>
              <td className="px-3 py-2 text-gray-500 dark:text-foreground-secondary text-xs">
                {fmtDate(u.last_login_at)}
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onAdjustCredits(u)}
                    className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                  >
                    {t('adjustCredits')}
                  </button>
                  <button
                    onClick={() => onToggleActive(u)}
                    className={`px-2 py-1 text-xs rounded ${
                      u.is_active
                        ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50'
                        : 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50'
                    }`}
                  >
                    {u.is_active ? t('disable') : t('enable')}
                  </button>
                  <button
                    onClick={() => onChangePlan(u)}
                    className="px-2 py-1 text-xs rounded bg-purple-50 text-purple-600 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/50"
                  >
                    {t('changePlan')}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
