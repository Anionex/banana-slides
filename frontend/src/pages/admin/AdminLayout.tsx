import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Crown, Receipt, Settings, ChevronLeft, LogOut } from 'lucide-react';
import { useAdminStore } from '../../store/useAdminStore';

const mainNavItems = [
  { to: '/', label: '概览', icon: LayoutDashboard, end: true },
  { to: '/users', label: '用户管理', icon: Users, end: false },
  { to: '/subscriptions', label: '订阅管理', icon: Crown, end: false },
  { to: '/transactions', label: '积分流水', icon: Receipt, end: false },
  { to: '/settings', label: '系统设置', icon: Settings, end: false },
];

// Legacy nav items for when AdminLayout is embedded in the main app
const legacyNavItems = [
  { to: '/admin', label: '概览', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: '用户管理', icon: Users, end: false },
  { to: '/admin/subscriptions', label: '订阅管理', icon: Crown, end: false },
  { to: '/admin/transactions', label: '积分流水', icon: Receipt, end: false },
  { to: '/admin/settings', label: '系统设置', icon: Settings, end: false },
];

export function AdminLayout({ hideBackButton = false }: { hideBackButton?: boolean }) {
  const navigate = useNavigate();
  const { logout } = useAdminStore();
  const navItems = hideBackButton ? mainNavItems : legacyNavItems;
  return (
    <div className="min-h-screen flex bg-[var(--bg-primary)]">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-[var(--bg-elevated)] border-r border-[var(--border-secondary)] flex flex-col">
        <div className="px-5 py-5 border-b border-[var(--border-secondary)]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--banana-yellow)] flex items-center justify-center">
              <span className="text-white text-xs font-bold">F</span>
            </div>
            <span className="font-semibold text-[var(--text-primary)] text-sm">飞页管理后台</span>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${
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
        <div className="px-3 py-4 border-t border-[var(--border-secondary)]">
          {hideBackButton ? (
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="flex items-center gap-2 px-3 py-2 w-full rounded-xl text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-red-500 transition-colors"
            >
              <LogOut size={16} />
              退出登录
            </button>
          ) : (
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-3 py-2 w-full rounded-xl text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ChevronLeft size={16} />
              返回主页
            </button>
          )}
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
