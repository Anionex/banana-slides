import { useCallback, useRef, useState } from 'react';
import { apiClient } from '@/api/client';
import { Button } from '@/components/shared';
import type { listProjects } from '@/api/endpoints';
import { History } from './History';
import { Link } from 'react-router-dom';

export function AdminHistory() {
  const password = useRef('');
  const [draft, setDraft] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
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
  const exportWaitlist = async () => {
    setExporting(true);
    setExportError('');
    try {
      const response = await apiClient.post('/api/admin/waitlist/export', { password: password.current }, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'banana-slides-beta-waitlist.csv';
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setExportError('导出失败，请检查管理员口令后重试。');
    } finally { setExporting(false); }
  };
  if (unlocked) return <><History readOnly projectLoader={loadProjects} onExit={exit} headerActions={<><Link className="text-sm underline" to="/admin/feedback">查看问题反馈</Link><Button variant="secondary" size="sm" disabled={exporting} onClick={() => { void exportWaitlist(); }}>{exporting ? '正在导出…' : '导出内测邮箱'}</Button></>} />{exportError && <p role="alert" className="fixed bottom-4 right-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700">{exportError}</p>}</>;
  return <main className="min-h-screen bg-gray-50 dark:bg-background-primary flex items-center justify-center p-4">
    <form onSubmit={event => { event.preventDefault(); void unlock(); }} className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-border-primary bg-white dark:bg-background-secondary p-6 space-y-4 text-gray-900 dark:text-foreground-primary">
      <h1 className="text-xl font-semibold">历史记录访问</h1>
      <label className="block text-sm space-y-2"><span>管理员口令</span>
        <input type="password" autoComplete="off" required disabled={loading} value={draft} onChange={event => setDraft(event.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-border-primary bg-transparent px-3 py-2" />
      </label>
      <p className="text-xs text-gray-500">刷新页面后需重新输入口令。</p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading}>{loading ? '正在验证…' : '查看历史'}</Button>
      <p><Link className="text-sm text-banana-700 underline dark:text-banana-400" to="/admin/feedback">查看问题反馈</Link></p>
    </form>
  </main>;
}
