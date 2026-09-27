import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/api/client';
import { Button } from '@/components/shared';

type Feedback = {
  id: number;
  message: string;
  reply_email: string | null;
  page_path: string;
  created_at: string;
};

const PAGE_SIZE = 20;

export function AdminFeedback() {
  const { i18n } = useTranslation();
  const zh = i18n.language?.startsWith('zh');
  const password = useRef('');
  const [draft, setDraft] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [items, setItems] = useState<Feedback[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load(nextOffset: number, nextPassword = password.current) {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.post('/api/admin/feedback', { password: nextPassword }, { params: { limit: PAGE_SIZE, offset: nextOffset } });
      setItems(response.data.data.items);
      setTotal(response.data.data.total);
      setOffset(nextOffset);
      password.current = nextPassword;
      setDraft('');
      setUnlocked(true);
    } catch (cause) {
      const status = (cause as { response?: { status?: number } }).response?.status;
      setError(status === 401 ? (zh ? '管理员口令错误。' : 'Incorrect admin password.') :
        zh ? '反馈加载失败，请重试。' : 'Could not load feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void load(0, draft);
  }

  if (!unlocked) return <main className="min-h-screen bg-gray-50 dark:bg-background-primary flex items-center justify-center p-4">
    <form onSubmit={unlock} className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-border-primary bg-white dark:bg-background-secondary p-6 space-y-4 text-gray-900 dark:text-foreground-primary">
      <h1 className="text-xl font-semibold">{zh ? '问题反馈管理' : 'Problem reports'}</h1>
      <label className="block text-sm space-y-2"><span>{zh ? '管理员口令' : 'Admin password'}</span>
        <input type="password" autoComplete="off" required disabled={loading} value={draft} onChange={event => setDraft(event.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-border-primary bg-transparent px-3 py-2" />
      </label>
      <p className="text-xs text-gray-500">{zh ? '刷新页面后需重新输入口令。' : 'Enter the password again after refreshing.'}</p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading}>{loading ? (zh ? '正在验证…' : 'Checking…') : (zh ? '查看反馈' : 'View reports')}</Button>
      <p><Link className="text-sm text-banana-700 underline dark:text-banana-400" to="/admin/history">{zh ? '查看历史项目' : 'View project history'}</Link></p>
    </form>
  </main>;

  return <main className="min-h-screen bg-gray-50 dark:bg-background-primary px-4 py-8 text-gray-900 dark:text-foreground-primary">
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">{zh ? '问题反馈' : 'Problem reports'}</h1><p className="mt-1 text-sm text-gray-500">{zh ? `共 ${total} 条` : `${total} reports`}</p></div>
        <div className="flex items-center gap-3"><Link className="text-sm underline" to="/admin/history">{zh ? '历史项目' : 'Project history'}</Link><Button variant="secondary" size="sm" onClick={() => { password.current = ''; setUnlocked(false); setItems([]); }}>{zh ? '退出' : 'Sign out'}</Button></div>
      </header>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {items.length === 0 ? <p className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500 dark:border-border-primary dark:bg-background-secondary">{zh ? '暂时没有反馈' : 'No reports yet'}</p> :
        <div className="space-y-3">{items.map(item => <article key={item.id} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-border-primary dark:bg-background-secondary">
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString(zh ? 'zh-CN' : 'en-US')}</time>
            <a href={item.page_path} className="underline">{item.page_path}</a>
          </div>
          <p className="whitespace-pre-wrap break-words leading-relaxed">{item.message}</p>
          {item.reply_email && <a className="mt-3 inline-block text-sm text-banana-700 underline dark:text-banana-400" href={`mailto:${item.reply_email}`}>{item.reply_email}</a>}
        </article>)}</div>}
      <nav aria-label={zh ? '反馈分页' : 'Report pages'} className="flex items-center justify-between gap-3">
        <Button variant="secondary" size="sm" disabled={loading || offset === 0} onClick={() => void load(Math.max(0, offset - PAGE_SIZE))}>{zh ? '上一页' : 'Previous'}</Button>
        <span className="text-sm text-gray-500">{total ? `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} / ${total}` : '0 / 0'}</span>
        <Button variant="secondary" size="sm" disabled={loading || offset + PAGE_SIZE >= total} onClick={() => void load(offset + PAGE_SIZE)}>{zh ? '下一页' : 'Next'}</Button>
      </nav>
    </div>
  </main>;
}
