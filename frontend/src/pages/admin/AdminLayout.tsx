import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Crown,
  LayoutDashboard,
  Lock,
  LogOut,
  Receipt,
  Settings,
  Users,
  WalletCards,
} from 'lucide-react';

import { useAdminStore } from '../../store/useAdminStore';

const mainNavItems = [
  { to: '/', label: '概览', icon: LayoutDashboard, end: true },
  { to: '/users', label: '用户管理', icon: Users, end: false },
  { to: '/subscriptions', label: '订阅管理', icon: Crown, end: false },
  { to: '/transactions', label: '积分流水', icon: Receipt, end: false },
  { to: '/pricing', label: '定价', icon: WalletCards, end: false },
  { to: '/settings', label: '系统设置', icon: Settings, end: false },
  { to: '/account', label: '账号安全', icon: Lock, end: false },
];

const legacyNavItems = [
  { to: '/admin', label: '概览', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: '用户管理', icon: Users, end: false },
  { to: '/admin/subscriptions', label: '订阅管理', icon: Crown, end: false },
  { to: '/admin/transactions', label: '积分流水', icon: Receipt, end: false },
  { to: '/admin/pricing', label: '定价', icon: WalletCards, end: false },
  { to: '/admin/settings', label: '系统设置', icon: Settings, end: false },
  { to: '/admin/account', label: '账号安全', icon: Lock, end: false },
];

export function AdminLayout({ hideBackButton = false }: { hideBackButton?: boolean }) {
  const navigate = useNavigate();
  const { logout } = useAdminStore();
  const navItems = hideBackButton ? mainNavItems : legacyNavItems;

  return (
    <div className="min-h-screen flex bg-[var(--bg-primary)]">
      <aside className="w-56 shrink-0 flex flex-col border-r border-[var(--border-secondary)] bg-[var(--bg-elevated)]">
        <div className="border-b border-[var(--border-secondary)] px-5 py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--banana-yellow)]">
              <span className="text-xs font-bold text-white">F</span>
            </div>
            <span className="text-sm font-semibold text-[var(--text-primary)]">飞叶管理后台</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-[var(--banana-yellow-pale)] text-[var(--banana-yellow-dark)] font-medium'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-[var(--border-secondary)] px-3 py-4">
          {hideBackButton ? (
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-red-500"
            >
              <LogOut size={16} />
              退出登录
            </button>
          ) : (
            <button
              onClick={() => navigate('/')}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              <ChevronLeft size={16} />
              返回主页
            </button>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
