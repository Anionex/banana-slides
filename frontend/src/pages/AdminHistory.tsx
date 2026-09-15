import { useCallback, useRef, useState } from 'react';
import { apiClient } from '@/api/client';
import { Button } from '@/components/shared';
import type { listProjects } from '@/api/endpoints';
import { History } from './History';

export function AdminHistory() {
  const password = useRef('');
  const [draft, setDraft] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const loadProjects: typeof listProjects = useCallback(async (limit = 5, offset = 0) => {
    try {
      const response = await apiClient.post('/api/admin/history', { password: password.current }, { params: { limit, offset } });
      return response.data;
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      throw new Error(status === 401 ? '管理员口令错误。' : status === 404 ? '入口未启用，请检查服务端配置。' : '历史记录加载失败，请重试。');
    }
  }, []);
  const unlock = async () => {
    setLoading(true);
    setError('');
    password.current = draft;
    try {
      await loadProjects(1, 0);
      setDraft('');
      setUnlocked(true);
    } catch (err) {
      password.current = '';
      setError((err as Error).message);
    } finally { setLoading(false); }
  };
  const exit = () => { password.current = ''; setUnlocked(false); setError(''); };
  if (unlocked) return <History readOnly projectLoader={loadProjects} onExit={exit} />;
  return <main className="min-h-screen bg-gray-50 dark:bg-background-primary flex items-center justify-center p-4">
    <form onSubmit={event => { event.preventDefault(); void unlock(); }} className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-border-primary bg-white dark:bg-background-secondary p-6 space-y-4 text-gray-900 dark:text-foreground-primary">
      <h1 className="text-xl font-semibold">历史记录访问</h1>
      <label className="block text-sm space-y-2"><span>管理员口令</span>
        <input type="password" autoComplete="off" required disabled={loading} value={draft} onChange={event => setDraft(event.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-border-primary bg-transparent px-3 py-2" />
      </label>
      <p className="text-xs text-gray-500">刷新页面后需重新输入口令。</p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading}>{loading ? '正在验证…' : '查看历史'}</Button>
    </form>
  </main>;
}
