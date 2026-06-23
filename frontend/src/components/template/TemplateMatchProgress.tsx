import React from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { cn } from '@/utils';
import type { Task } from '@/types';

const i18n = {
  zh: {
    tmp: {
      matching: '正在自动匹配模板…',
      done: '自动匹配完成',
      failed: '自动匹配失败',
      progress: '已处理 {completed}/{total} 页',
      matched: '匹配 {matched} 页',
      failedPages: '{failed} 页失败',
    },
  },
  en: {
    tmp: {
      matching: 'Auto-matching templates…',
      done: 'Auto-match completed',
      failed: 'Auto-match failed',
      progress: 'Processed {completed}/{total} pages',
      matched: '{matched} pages matched',
      failedPages: '{failed} pages failed',
    },
  },
};

export interface TemplateMatchProgressProps {
  task: Task | null;
}

export const TemplateMatchProgress: React.FC<TemplateMatchProgressProps> = ({ task }) => {
  const t = useT(i18n);
  if (!task) return null;

  const total = task.progress?.total ?? 0;
  const completed = task.progress?.completed ?? 0;
  const failed = task.progress?.failed ?? 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const isRunning = task.status === 'RUNNING' || task.status === 'PENDING';
  const isFailed = task.status === 'FAILED';
  const isDone = task.status === 'COMPLETED';

  const fill = (s: string, vars: Record<string, number>) =>
    s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

  return (
    <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-2 text-sm font-medium">
        {isRunning && <Loader2 size={16} className="animate-spin text-banana-600" />}
        {isDone && <CheckCircle2 size={16} className="text-green-600" />}
        {isFailed && <XCircle size={16} className="text-red-600" />}
        <span
          className={cn(
            isDone && 'text-green-700 dark:text-green-400',
            isFailed && 'text-red-700 dark:text-red-400',
            isRunning && 'text-gray-700 dark:text-gray-200'
          )}
        >
          {isRunning && t('tmp.matching')}
          {isDone && t('tmp.done')}
          {isFailed && t('tmp.failed')}
        </span>
      </div>

      {!isFailed && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              isDone ? 'bg-green-500' : 'bg-banana-500'
            )}
            style={{ width: `${isDone ? 100 : pct}%` }}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-x-3 text-xs text-gray-500 dark:text-gray-400">
        <span>{fill(t('tmp.progress'), { completed, total })}</span>
        {failed > 0 && (
          <span className="text-red-500">{fill(t('tmp.failedPages'), { failed })}</span>
        )}
      </div>

      {isFailed && task.error_message && (
        <p className="text-xs text-red-500">{task.error_message}</p>
      )}
    </div>
  );
};

export default TemplateMatchProgress;
