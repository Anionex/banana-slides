import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '../../hooks/useT';
import { getAdminLogs } from '../../api/adminApi';
import { Search, RefreshCw, Filter } from 'lucide-react';

const i18n = {
  zh: {
    title: '后端日志',
    keyword: '关键词搜索...',
    allLevels: '全部级别',
    lines: '行数',
    refresh: '刷新',
    autoRefresh: '自动刷新',
    loading: '加载中...',
    error: '加载失败',
    noLogs: '暂无日志',
    total: '共 {{count}} 条匹配',
  },
  en: {
    title: 'Backend Logs',
    keyword: 'Search keyword...',
    allLevels: 'All Levels',
    lines: 'Lines',
    refresh: 'Refresh',
    autoRefresh: 'Auto Refresh',
    loading: 'Loading...',
    error: 'Failed to load',
    noLogs: 'No logs',
    total: '{{count}} matches',
  },
};

const LOG_LEVELS = ['INFO', 'WARNING', 'ERROR', 'DEBUG'];
const LINE_OPTIONS = [100, 200, 500, 1000];

export default function AdminLogs() {
  const t = useT(i18n);
  const [lines, setLines] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [level, setLevel] = useState('');
  const [lineCount, setLineCount] = useState(200);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  // Debounce keyword input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword), 400);
    return () => clearTimeout(timer);
  }, [keyword]);

  const fetchLogs = useCallback(async () => {
    try {
      setError(false);
      const res = await getAdminLogs({
        lines: lineCount,
        level: level || undefined,
        keyword: debouncedKeyword || undefined,
      });
      const data = res.data.data;
      setLines(data.lines);
      setTotal(data.total);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [lineCount, level, debouncedKeyword]);

  useEffect(() => {
    setLoading(true);
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLogs, 5000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, fetchLogs]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const getLevelColor = (line: string) => {
    if (line.includes('[ERROR]')) return 'text-red-500';
    if (line.includes('[WARNING]')) return 'text-amber-500';
    if (line.includes('[DEBUG]')) return 'text-gray-400';
    return 'text-gray-300';
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('keyword')}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-background-secondary text-gray-900 dark:text-foreground-primary text-sm focus:ring-2 focus:ring-banana-500 outline-none w-56"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-background-secondary text-gray-900 dark:text-foreground-primary text-sm"
            >
              <option value="">{t('allLevels')}</option>
              {LOG_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <select
            value={lineCount}
            onChange={(e) => setLineCount(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-background-secondary text-gray-900 dark:text-foreground-primary text-sm"
          >
            {LINE_OPTIONS.map((n) => <option key={n} value={n}>{n} {t('lines')}</option>)}
          </select>
          <button
            onClick={() => { setLoading(true); fetchLogs(); }}
            className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-foreground-secondary hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <RefreshCw className="w-4 h-4" /> {t('refresh')}
          </button>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-foreground-secondary cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="rounded" />
            {t('autoRefresh')}
          </label>
          <span className="ml-auto text-sm text-gray-500 dark:text-foreground-secondary">
            {t('total', { count: total })}
          </span>
        </div>

        {/* Log content */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-900 shadow-sm overflow-hidden">
          {loading ? (
            <p className="text-center py-8 text-gray-400">{t('loading')}</p>
          ) : error ? (
            <p className="text-center py-8 text-red-500">{t('error')}</p>
          ) : lines.length === 0 ? (
            <p className="text-center py-8 text-gray-500">{t('noLogs')}</p>
          ) : (
            <div className="overflow-auto max-h-[70vh] p-4 font-mono text-xs leading-5">
              {lines.map((line, i) => (
                <div key={i} className={getLevelColor(line)}>{line}</div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
    </div>
  );
}
