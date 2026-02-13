import React, { useState, useEffect } from 'react';
import { Download, X, Trash2, FileText, Clock, CheckCircle, XCircle, Loader2, AlertTriangle, HelpCircle, Settings } from 'lucide-react';
import { useExportTasksStore, type ExportTask, type ExportTaskType } from '@/store/useExportTasksStore';
import { useT } from '@/hooks/useT';
import type { Page } from '@/types';
import { Button } from './Button';
import { cn } from '@/utils';

// Export 组件自包含翻译
const exportI18n = {
  zh: {
    export: {
      tasks: "导出任务", inProgress: "{{count}} 进行中", clearHistory: "清除",
      exportPptx: "PPTX", exportPdf: "PDF", exportEditablePptx: "可编辑 PPTX",
      allPages: "全部", pageRange: "第{{start}}-{{end}}页", singlePage: "第{{num}}页", pagesCount: "{{count}}页",
      warnings: "{{count}} 条警告", clickToView: "点击查看", warningsTitle: "导出警告",
      warningsCount: "导出警告 ({{count}} 条)", detailInfo: "详细信息",
      styleExtractionFailed: "样式提取失败 ({{count}} 个)", textRenderFailed: "文本渲染失败 ({{count}} 个)",
      moreItems: "... 还有 {{count}} 条", exportFailed: "导出失败", preparing: "准备中...",
      settingsTip: "可在「项目设置 → 导出设置」中调整配置或开启「返回半成品」选项"
    },
    shared: { historyRecords: "历史记录" }
  },
  en: {
    export: {
      tasks: "Export Tasks", inProgress: "{{count}} in progress", clearHistory: "Clear",
      exportPptx: "PPTX", exportPdf: "PDF", exportEditablePptx: "Editable PPTX",
      allPages: "All", pageRange: "Pages {{start}}-{{end}}", singlePage: "Page {{num}}", pagesCount: "{{count}} pages",
      warnings: "{{count}} warnings", clickToView: "Click to view", warningsTitle: "Export Warnings",
      warningsCount: "Export Warnings ({{count}})", detailInfo: "Details",
      styleExtractionFailed: "Style extraction failed ({{count}})", textRenderFailed: "Text render failed ({{count}})",
      moreItems: "... {{count}} more", exportFailed: "Export Failed", preparing: "Preparing...",
      settingsTip: "Adjust settings in \"Project Settings → Export Settings\" or enable \"Allow Partial Results\""
    },
    shared: { historyRecords: "History Records" }
  }
};

const getPageRangeText = (pageIds: string[] | undefined, pages: Page[], t: (key: string, options?: any) => string): string => {
  if (!pageIds || pageIds.length === 0) {
    return t('export.allPages');
  }
  
  const indices: number[] = [];
  pageIds.forEach(pageId => {
    const index = pages.findIndex(p => (p.id || p.page_id) === pageId);
    if (index >= 0) {
      indices.push(index);
    }
  });
  
  if (indices.length === 0) {
    return t('export.pagesCount', { count: pageIds.length });
  }
  
  indices.sort((a, b) => a - b);
  const minIndex = indices[0];
  const maxIndex = indices[indices.length - 1];
  
  if (indices.length === maxIndex - minIndex + 1) {
    if (minIndex === maxIndex) {
      return t('export.singlePage', { num: minIndex + 1 });
    }
    return t('export.pageRange', { start: minIndex + 1, end: maxIndex + 1 });
  } else {
    return t('export.pagesCount', { count: pageIds.length });
  }
};

const TaskStatusIcon: React.FC<{ status: ExportTask['status'] }> = ({ status }) => {
  switch (status) {
    case 'PENDING':
      return <Clock size={16} className="text-gray-400" />;
    case 'PROCESSING':
    case 'RUNNING':
      return <Loader2 size={16} className="text-banana-500 animate-spin" />;
    case 'COMPLETED':
      return <CheckCircle size={16} className="text-green-500" />;
    case 'FAILED':
      return <XCircle size={16} className="text-red-500" />;
    default:
      return null;
  }
};

const WarningsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  warnings: string[];
  warningDetails?: any;
}> = ({ isOpen, onClose, warnings, warningDetails }) => {
  const t = useT(exportI18n);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white dark:bg-background-secondary rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-border-primary bg-amber-50">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            <h3 className="text-base font-semibold text-amber-800">
              {t('export.warningsCount', { count: warnings.length })}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-amber-100 rounded transition-colors"
          >
            <X size={18} className="text-gray-500 dark:text-foreground-tertiary" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {warnings.map((warning, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800"
              >
                <span className="text-amber-500 mt-0.5">•</span>
                <span className="break-words">{warning}</span>
              </div>
            ))}
          </div>
          
          {warningDetails && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-border-primary">
              <h4 className="text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">{t('export.detailInfo')}</h4>
              
              {warningDetails.style_extraction_failed?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 dark:text-foreground-tertiary mb-1">
                    {t('export.styleExtractionFailed', { count: warningDetails.style_extraction_failed.length })}
                  </p>
                  <div className="text-xs text-gray-600 dark:text-foreground-tertiary bg-gray-50 dark:bg-background-primary p-2 rounded max-h-32 overflow-y-auto">
                    {warningDetails.style_extraction_failed.slice(0, 10).map((item: any, idx: number) => (
                      <div key={idx} className="truncate" title={item.reason}>
                        • {item.element_id}: {item.reason}
                      </div>
                    ))}
                    {warningDetails.style_extraction_failed.length > 10 && (
                      <div className="text-gray-400 mt-1">
                        {t('export.moreItems', { count: warningDetails.style_extraction_failed.length - 10 })}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {warningDetails.text_render_failed?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 dark:text-foreground-tertiary mb-1">
                    {t('export.textRenderFailed', { count: warningDetails.text_render_failed.length })}
                  </p>
                  <div className="text-xs text-gray-600 dark:text-foreground-tertiary bg-gray-50 dark:bg-background-primary p-2 rounded max-h-32 overflow-y-auto">
                    {warningDetails.text_render_failed.slice(0, 10).map((item: any, idx: number) => (
                      <div key={idx} className="truncate" title={item.reason}>
                        • "{item.text}": {item.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="px-4 py-3 border-t border-gray-200 dark:border-border-primary bg-gray-50 dark:bg-background-primary">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:text-foreground-secondary rounded-md text-sm font-medium transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

const TaskItem: React.FC<{ task: ExportTask; pages: Page[]; onRemove: () => void }> = ({ task, pages, onRemove }) => {
  const t = useT(exportI18n);
  const [showWarningsModal, setShowWarningsModal] = useState(false);
  
  const taskTypeLabels: Record<ExportTaskType, string> = {
    'pptx': t('export.exportPptx'),
    'pdf': t('export.exportPdf'),
    'editable-pptx': t('export.exportEditablePptx'),
  };
  
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const pageRangeText = getPageRangeText(task.pageIds, pages, t);

  const getProgressPercent = () => {
    if (!task.progress) return 0;
    if (task.progress.percent !== undefined) return task.progress.percent;
    if (task.progress.total > 0) {
      return Math.round((task.progress.completed / task.progress.total) * 100);
    }
    return 0;
  };

  const progressPercent = getProgressPercent();
  const isProcessing = task.status === 'PROCESSING' || task.status === 'RUNNING' || task.status === 'PENDING';
  
  const hasWarnings = task.status === 'COMPLETED' && task.progress?.warnings && task.progress.warnings.length > 0;

  return (
    <div className="flex items-start gap-3 py-2.5 px-3 hover:bg-gray-50 dark:hover:bg-background-hover rounded-lg transition-colors">
      <div className="mt-0.5">
        <TaskStatusIcon status={task.status} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-gray-700 dark:text-foreground-secondary truncate">
            {taskTypeLabels[task.type]}
          </span>
          <span className="text-xs text-gray-500 dark:text-foreground-tertiary">
            {pageRangeText}
          </span>
          <span className="text-xs text-gray-400">
            {formatTime(task.createdAt)}
          </span>
        </div>
        
        {isProcessing && (
          <div className="mt-2 space-y-1.5">
            {task.progress ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-banana-600">
                    {progressPercent > 0 ? `${progressPercent}%` : t('export.preparing')}
                  </span>
                  {task.progress.current_step && (
                    <span className="text-xs text-gray-500 dark:text-foreground-tertiary truncate max-w-[140px]" title={task.progress.current_step}>
                      {task.progress.current_step}
                    </span>
                  )}
                </div>
                
                <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-banana-500 to-banana-600 transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                
                {task.progress.messages && task.progress.messages.length > 0 && (
                  <div className="mt-1.5 space-y-0.5">
                    {task.progress.messages.slice(-2).map((msg, idx) => (
                      <div key={idx} className="text-xs text-gray-500 dark:text-foreground-tertiary truncate" title={msg}>
                        {msg}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-banana-500 animate-pulse" style={{ width: '30%' }} />
                </div>
                <span className="text-xs text-gray-500 dark:text-foreground-tertiary whitespace-nowrap">{t('common.pending')}</span>
              </div>
            )}
          </div>
        )}
        
        {task.status === 'FAILED' && task.errorMessage && (
          <div className="mt-2 space-y-2">
            <div className="p-2 bg-red-50 border border-red-200 rounded">
              <div className="flex items-start gap-2">
                <XCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-red-700 font-medium">{t('export.exportFailed')}</p>
                  <p className="text-xs text-red-600 mt-1 whitespace-pre-wrap break-words">
                    {task.errorMessage}
                  </p>
                </div>
              </div>
            </div>

            {task.progress?.help_text && (
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded">
                <div className="flex items-start gap-2">
                  <HelpCircle size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    {task.progress.help_text}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-foreground-tertiary">
              <Settings size={12} />
              <span>{t('export.settingsTip')}</span>
            </div>
          </div>
        )}
        
        {hasWarnings && (
          <>
            <button
              onClick={() => setShowWarningsModal(true)}
              className="mt-1.5 w-full text-left px-2 py-1.5 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />
                <span className="text-xs font-medium text-amber-700">
                  {t('export.warnings', { count: task.progress?.warnings?.length ?? 0 })}
                </span>
                <span className="text-[11px] text-amber-500 ml-auto">
                  {t('export.clickToView')}
                </span>
              </div>
            </button>
            
            <WarningsModal
              isOpen={showWarningsModal}
              onClose={() => setShowWarningsModal(false)}
              warnings={task.progress?.warnings ?? []}
              warningDetails={task.progress?.warning_details}
            />
          </>
        )}
      </div>
      
      <div className="flex items-center gap-1 flex-shrink-0">
        {task.status === 'COMPLETED' && task.downloadUrl && (
          <Button
            variant="primary"
            size="sm"
            icon={<Download size={14} />}
            onClick={() => window.open(task.downloadUrl, '_blank')}
            className="text-xs px-2 py-1"
          >
            {t('common.download')}
          </Button>
        )}
        
        <button
          onClick={onRemove}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          title={t('common.delete')}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

interface ExportTasksPanelProps {
  projectId?: string;
  pages?: Page[];
  className?: string;
}

export const ExportTasksPanel: React.FC<ExportTasksPanelProps> = ({ projectId, pages = [], className }) => {
  const t = useT(exportI18n);
  const [isExpanded, setIsExpanded] = useState(true);
  const { tasks, removeTask, clearCompleted, restoreActiveTasks } = useExportTasksStore();
  
  const filteredTasks = projectId 
    ? tasks.filter(task => task.projectId === projectId)
    : tasks;
  
  const activeTasks = filteredTasks.filter(
    task => task.status === 'PENDING' || task.status === 'PROCESSING' || task.status === 'RUNNING'
  );
  const completedTasks = filteredTasks.filter(
    task => task.status === 'COMPLETED' || task.status === 'FAILED'
  );
  
  useEffect(() => {
    restoreActiveTasks();
  }, []);
  
  useEffect(() => {
    if (activeTasks.length > 0 && !isExpanded) {
      setIsExpanded(true);
    }
  }, [activeTasks.length, isExpanded]);
  
  if (filteredTasks.length === 0) {
    return null;
  }
  
  return (
    <div className={cn(
      "bg-white dark:bg-background-secondary rounded-lg shadow-lg border border-gray-200 dark:border-border-primary overflow-hidden",
      className
    )}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center bg-gray-50 dark:bg-background-primary hover:bg-gray-100 dark:hover:bg-background-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-gray-600 dark:text-foreground-tertiary" />
          <span className="text-sm font-medium text-gray-700 dark:text-foreground-secondary">
            {t('export.tasks')}
          </span>
          {activeTasks.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-banana-100 text-banana-700 rounded-full">
              {t('export.inProgress', { count: activeTasks.length })}
            </span>
          )}
        </div>
      </button>
      
      {isExpanded && (
        <div className="max-h-96 overflow-y-auto">
          {activeTasks.length > 0 && (
            <div className="p-2 border-b border-gray-100 dark:border-border-primary">
              {activeTasks.map(task => (
                <TaskItem 
                  key={task.id} 
                  task={task}
                  pages={pages}
                  onRemove={() => removeTask(task.id)}
                />
              ))}
            </div>
          )}
          
          {completedTasks.length > 0 && (
            <div className="p-2">
              <div className="flex items-center justify-between px-3 py-1 mb-1">
                <span className="text-xs text-gray-400">{t('shared.historyRecords')}</span>
                <button
                  onClick={clearCompleted}
                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                >
                  <Trash2 size={12} />
                  {t('export.clearHistory')}
                </button>
              </div>
              {completedTasks.map(task => (
                <TaskItem 
                  key={task.id} 
                  task={task}
                  pages={pages}
                  onRemove={() => removeTask(task.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
