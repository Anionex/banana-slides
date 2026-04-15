import { Settings } from '../Settings';
import { adminApi } from '../../api/admin';

export function AdminSettingsPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">系统设置</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          当前页面维护的是平台共享设置，供普通用户使用；不会覆盖内部用户各自的私有配置。
        </p>
      </div>
      <div className="rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-elevated)] p-6">
        <Settings apiModule={adminApi} persistKey="banana-admin-settings" mode="global" />
      </div>
    </div>
  );
}
