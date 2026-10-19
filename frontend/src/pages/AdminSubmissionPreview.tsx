import { useEffect, useState } from 'react';
import { apiClient } from '@/api/client';
import { Button } from '@/components/shared';

export type Submission = {
  id: string; filename: string; page_count: number; byte_size: number;
  metadata: Record<string, string>; created_at: string;
};

export function AdminSubmissionPreview({ item, password, zh }: { item: Submission; password: string; zh: boolean | undefined }) {
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [downloading, setDownloading] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const controller = new AbortController();
    let objectUrl = '';
    setLoading(true); setError(''); setUrl('');
    void apiClient.post<Blob>(`/api/admin/gallery-submissions/${item.id}/preview`, { password }, { params: { page }, responseType: 'blob', signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) { objectUrl = URL.createObjectURL(response.data); setUrl(objectUrl); } })
      .catch(() => { if (!controller.signal.aborted) setError(zh ? '预览加载失败，可重试或下载 PDF 查看。' : 'Preview failed. Retry or download the PDF.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [expanded, item.id, page, password, zh, attempt]);
  async function download() {
    setDownloading(true); setError('');
    try {
      const response = await apiClient.post<Blob>(`/api/admin/gallery-submissions/${item.id}/pdf`, { password }, { responseType: 'blob' });
      const href = URL.createObjectURL(response.data);
      const link = document.createElement('a'); link.href = href; link.download = item.filename;
      document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch { setError(zh ? '下载失败，请重试。' : 'Download failed. Please retry.'); }
    finally { setDownloading(false); }
  }
  return <>
    <h2 className="text-lg font-semibold break-words">{item.filename}</h2>
    <p className="mt-2 text-sm text-gray-500">{item.page_count} {zh ? '页' : 'slides'} · {(item.byte_size / 1024 / 1024).toFixed(1)} MB</p>
    <p className="mt-2 text-xs text-gray-500">{zh ? '导出标记' : 'Export metadata'}: Author / Creator / Producer = {item.metadata.producer}</p>
    <div className="mt-4 flex flex-wrap gap-3"><Button variant="secondary" size="sm" onClick={() => setExpanded(!expanded)}>{expanded ? (zh ? '收起预览' : 'Hide preview') : (zh ? '逐页查看' : 'Preview slides')}</Button><Button variant="secondary" size="sm" disabled={downloading} onClick={() => void download()}>{downloading ? (zh ? '下载中…' : 'Downloading…') : (zh ? '下载原始 PDF' : 'Download original PDF')}</Button></div>
    {expanded && <div className="mt-4 space-y-3">
      <div className="min-h-48 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-background-primary" aria-busy={loading}>{url ? <img className="max-h-[65vh] max-w-full object-contain" src={url} alt={zh ? `第 ${page} 页` : `Slide ${page}`} /> : <p role="status" className="p-6 text-sm text-gray-500">{loading ? (zh ? '正在加载…' : 'Loading…') : (zh ? '预览不可用' : 'Preview unavailable')}</p>}</div>
      <div className="flex items-center justify-between gap-3"><Button variant="secondary" size="sm" disabled={loading || page === 1} onClick={() => setPage(page - 1)}>{zh ? '上一页' : 'Previous'}</Button><span className="text-sm tabular-nums">{page} / {item.page_count}</span><Button variant="secondary" size="sm" disabled={loading || page === item.page_count} onClick={() => setPage(page + 1)}>{zh ? '下一页' : 'Next'}</Button></div>
    </div>}
    {error && <div className="mt-3 space-x-3 text-sm" role="alert"><span>{error}</span>{expanded && <button className="underline min-h-11" onClick={() => setAttempt(attempt + 1)}>{zh ? '重试预览' : 'Retry preview'}</button>}</div>}
  </>;
}
