import { Settings } from '../Settings';
import { adminApi } from '../../api/admin';

export function AdminSettingsPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">系统设置</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          当前页修改的是当前管理员自己的系统设置，不会影响其他管理员。
        </p>
      </div>
      <div className="rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-elevated)] p-6">
        <Settings apiModule={adminApi} persistKey="banana-admin-settings" mode="admin" />
      </div>
    </div>
  );
}
