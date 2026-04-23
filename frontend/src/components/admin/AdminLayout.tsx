import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useT } from '@/hooks/useT';
import {
  LayoutDashboard,
  Users,
  ArrowLeftRight,
  ShoppingCart,
  Settings,
  Megaphone,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Home,
  Shield,
  CreditCard,
  Wallet,
  Database,
  type LucideIcon,
} from 'lucide-react';

const i18n = {
  zh: {
    dashboard: '仪表盘',
    users: '用户管理',
    transactions: '积分明细',
    orders: '订单审计',
    config: '系统配置',
    configGeneral: '通用',
    configCredits: '积分与套餐',
    configPayment: '支付',
    configStorage: '存储与 AI',
    announcements: '公告管理',
    logs: '后端日志',
    backHome: '返回首页',
    collapse: '收起菜单',
    expand: '展开菜单',
  },
  en: {
    dashboard: 'Dashboard',
    users: 'Users',
    transactions: 'Transactions',
    orders: 'Orders',
    config: 'Configuration',
    configGeneral: 'General',
    configCredits: 'Credits',
    configPayment: 'Payment',
    configStorage: 'Storage & AI',
    announcements: 'Announcements',
    logs: 'Logs',
    backHome: 'Back to Home',
    collapse: 'Collapse',
    expand: 'Expand',
  },
};

interface NavChild {
  path: string;
  key: string;
  icon: LucideIcon;
}

interface NavItem {
  path: string;
  key: string;
  icon: LucideIcon;
  exact?: boolean;
  children?: NavChild[];
}

const navItems: NavItem[] = [
  { path: '/admin', key: 'dashboard', icon: LayoutDashboard, exact: true },
  { path: '/admin/users', key: 'users', icon: Users },
  { path: '/admin/transactions', key: 'transactions', icon: ArrowLeftRight },
  { path: '/admin/orders', key: 'orders', icon: ShoppingCart },
  {
    path: '/admin/config', key: 'config', icon: Settings,
    children: [
      { path: '/admin/config/general', key: 'configGeneral', icon: Shield },
      { path: '/admin/config/credits', key: 'configCredits', icon: CreditCard },
      { path: '/admin/config/payment', key: 'configPayment', icon: Wallet },
      { path: '/admin/config/storage', key: 'configStorage', icon: Database },
    ],
  },
  { path: '/admin/announcements', key: 'announcements', icon: Megaphone },
  { path: '/admin/logs', key: 'logs', icon: FileText },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const t = useT(i18n);
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const configActive = location.pathname.startsWith('/admin/config');
  const [configOpen, setConfigOpen] = useState(configActive);

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const activeCls = 'bg-banana-50 text-banana-700 dark:bg-banana-500/10 dark:text-banana-400';
  const inactiveCls = 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-foreground-secondary dark:hover:bg-background-hover dark:hover:text-foreground-primary';

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-background-primary">
      <aside
        className={`${
          collapsed ? 'w-16' : 'w-56'
        } flex-shrink-0 bg-white dark:bg-background-secondary border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-200`}
      >
        <div className="h-14 flex items-center px-4 border-b border-gray-200 dark:border-gray-700">
          {!collapsed && (
            <span className="text-lg font-bold text-gray-900 dark:text-foreground-primary truncate">
              Admin
            </span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`${
              collapsed ? 'mx-auto' : 'ml-auto'
            } p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-foreground-secondary dark:hover:bg-background-hover transition-colors`}
            title={collapsed ? t('expand') : t('collapse')}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item.path, item.exact);
            const Icon = item.icon;
            const hasChildren = item.children && item.children.length > 0;
            const showChildren = hasChildren && (configOpen || configActive) && !collapsed;

            if (hasChildren && !collapsed) {
              return (
                <div key={item.path}>
                  <button
                    type="button"
                    onClick={() => setConfigOpen(!configOpen)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      active ? activeCls : inactiveCls
                    }`}
                  >
                    <Icon size={18} className="flex-shrink-0" />
                    <span className="truncate flex-1 text-left">{t(item.key)}</span>
                    <ChevronDown
                      size={14}
                      className={`flex-shrink-0 transition-transform ${showChildren ? '' : '-rotate-90'}`}
                    />
                  </button>
                  {showChildren && (
                    <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-gray-200 dark:border-gray-700 pl-2">
                      {item.children!.map((child) => {
                        const childActive = location.pathname === child.path;
                        const ChildIcon = child.icon;
                        return (
                          <Link
                            key={child.path}
                            to={child.path}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                              childActive ? activeCls : inactiveCls
                            }`}
                          >
                            <ChildIcon size={15} className="flex-shrink-0" />
                            <span className="truncate">{t(child.key)}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.path}
                to={hasChildren ? item.children![0].path : item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active ? activeCls : inactiveCls
                }`}
                title={collapsed ? t(item.key) : undefined}
              >
                <Icon size={18} className="flex-shrink-0" />
                {!collapsed && <span className="truncate">{t(item.key)}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-200 dark:border-gray-700 p-2">
          <Link
            to="/app"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-foreground-tertiary dark:hover:bg-background-hover dark:hover:text-foreground-secondary transition-colors"
            title={collapsed ? t('backHome') : undefined}
          >
            <Home size={18} className="flex-shrink-0" />
            {!collapsed && <span className="truncate">{t('backHome')}</span>}
          </Link>
        </div>
      </aside>

      <div className="flex-1 min-w-0 overflow-auto">
        {children}
      </div>
    </div>
  );
}
