/**
 * User Menu Component
 * 用户菜单组件 - 显示用户信息、积分和退出登录
 */
import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Settings, CreditCard, LogOut, ChevronDown, User, Shield, List, Lock } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { logoutUser } from '../../api/auth';
import ChangePasswordModal from './ChangePasswordModal';

export default function UserMenu() {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logoutUser();
    navigate('/login');
  };

  if (!isAuthenticated || !user) {
    return (
      <Link
        to="/login"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-banana-500 to-orange-500 rounded-lg hover:from-banana-600 hover:to-orange-600 shadow-sm hover:shadow-md transition-all"
      >
        <User size={16} />
        <span>{t('auth.login', '登录')}</span>
      </Link>
    );
  }

  const initials = user.username 
    ? user.username.slice(0, 2).toUpperCase()
    : user.email.slice(0, 2).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      {/* Credits Display + Avatar */}
      <div className="flex items-center gap-2">
        {/* Credits Badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 rounded-full">
          <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.736 6.979C9.208 6.193 9.696 6 10 6c.304 0 .792.193 1.264.979a1 1 0 001.715-1.029C12.279 4.784 11.232 4 10 4s-2.279.784-2.979 1.95c-.285.475-.507 1-.67 1.55H6a1 1 0 000 2h.013a9.358 9.358 0 000 1H6a1 1 0 100 2h.351c.163.55.385 1.075.67 1.55C7.721 15.216 8.768 16 10 16s2.279-.784 2.979-1.95a1 1 0 10-1.715-1.029c-.472.786-.96.979-1.264.979-.304 0-.792-.193-1.264-.979a4.265 4.265 0 01-.264-.521H10a1 1 0 100-2H8.017a7.36 7.36 0 010-1H10a1 1 0 100-2H8.472a4.265 4.265 0 01.264-.521z" />
          </svg>
          <span className="text-sm font-medium text-amber-700 dark:text-amber-300">{user.credits_balance}</span>
        </div>

        {/* Avatar Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-background-hover transition-colors"
        >
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.username || user.email}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-banana-200 dark:ring-banana/30"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-banana-400 to-orange-500 flex items-center justify-center text-white text-sm font-medium ring-2 ring-banana-200 dark:ring-banana/30">
              {initials}
            </div>
          )}
          <ChevronDown 
            size={14} 
            className={`text-gray-500 dark:text-foreground-tertiary transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-background-secondary rounded-xl shadow-xl dark:shadow-none border border-gray-200 dark:border-border-primary overflow-hidden z-50">
            {/* User Info */}
            <div className="px-4 py-3 border-b border-gray-100 dark:border-border-primary bg-gray-50 dark:bg-background-tertiary">
              <p className="text-gray-900 dark:text-white font-medium truncate">{user.username || user.email}</p>
              <p className="text-sm text-gray-500 dark:text-foreground-tertiary truncate">{user.email}</p>
            </div>

            {/* Credits (mobile) */}
            <div className="sm:hidden px-4 py-3 border-b border-gray-100 dark:border-border-primary flex items-center justify-between">
              <span className="text-gray-600 dark:text-foreground-secondary">{t('auth.credits', '积分余额')}</span>
              <span className="text-amber-600 dark:text-amber-400 font-medium">{user.credits_balance}</span>
            </div>

            {/* Menu Items */}
            <div className="py-1">
              {user.is_admin && (
                <Link
                  to="/admin"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-gray-700 dark:text-foreground-secondary hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-background-hover transition-colors"
                >
                  <Shield size={18} />
                  <span>{t('nav.admin', '管理后台')}</span>
                </Link>
              )}
              <Link
                to="/settings"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-gray-700 dark:text-foreground-secondary hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-background-hover transition-colors"
              >
                <Settings size={18} />
                <span>{t('nav.settings', '设置')}</span>
              </Link>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setShowChangePassword(true);
                }}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-gray-700 dark:text-foreground-secondary hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-background-hover transition-colors"
              >
                <Lock size={18} />
                <span>{t('auth.changePassword.menuItem', '修改密码')}</span>
              </button>
              <Link
                to="/credits"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-gray-700 dark:text-foreground-secondary hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-background-hover transition-colors"
              >
                <List size={18} />
                <span>{t('auth.creditsHistory', '积分明细')}</span>
              </Link>
              <Link
                to="/pricing"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-gray-700 dark:text-foreground-secondary hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-background-hover transition-colors"
              >
                <CreditCard size={18} />
                <span>{t('auth.buyCredits', '购买积分')}</span>
              </Link>
            </div>

            {/* Logout */}
            <div className="border-t border-gray-100 dark:border-border-primary py-1">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
              >
                <LogOut size={18} />
                <span>{t('auth.logout', '退出登录')}</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </div>
  );
}
