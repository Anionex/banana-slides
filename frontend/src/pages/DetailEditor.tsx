import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, FileText, Sparkles, Download, Upload } from 'lucide-react';
import { useT } from '@/hooks/useT';

// 组件内翻译
const detailI18n = {
  zh: {
    home: { title: '蕉幻' },
    detail: {
      title: "编辑页面描述", pageCount: "共 {{count}} 页", generateImages: "生成图片",
      generating: "生成中...", page: "第 {{num}} 页", titleLabel: "标题",
      description: "描述", batchGenerate: "批量生成描述", export: "导出描述", exportFull: "导出大纲+描述", import: "导入",
      pagesCompleted: "页已完成", noPages: "还没有页面",
      noPagesHint: "请先返回大纲编辑页添加页面", backToOutline: "返回大纲编辑",
      aiPlaceholder: "例如：让描述更详细、删除第2页的某个要点、强调XXX的重要性... · Ctrl+Enter提交",
      aiPlaceholderShort: "例如：让描述更详细... · Ctrl+Enter",
      renovationProcessing: "正在解析页面内容...",
      renovationProgress: "{{completed}}/{{total}} 页",
      renovationFailed: "PDF 解析失败，请返回重试",
      renovationPollFailed: "与服务器通信失败，请检查网络后刷新页面重试",
      messages: {
        generateSuccess: "生成成功", generateFailed: "生成失败",
        confirmRegenerate: "部分页面已有描述，重新生成将覆盖，确定继续吗？",
        confirmRegenerateTitle: "确认重新生成",
        confirmRegeneratePage: "该页面已有描述，重新生成将覆盖现有内容，确定继续吗？",
        confirmRenovationRegenerate: "您现在是 PPT 翻新模式，重新生成会依照原 PPT 相同页码页面，重新解析并生成该页的大纲和描述，覆盖已有内容。确定要继续吗？",
        confirmRenovationRegenerateTitle: "重新解析此页",
        refineSuccess: "页面描述修改成功", refineFailed: "修改失败，请稍后重试",
        exportSuccess: "导出成功", importSuccess: "导入成功", importFailed: "导入失败，请检查文件格式", importEmpty: "文件中未找到有效页面",
        loadingProject: "加载项目中..."
      }
    }
  },
  en: {
    home: { title: 'Banana Slides' },
    detail: {
      title: "Edit Descriptions", pageCount: "{{count}} pages", generateImages: "Generate Images",
      generating: "Generating...", page: "Page {{num}}", titleLabel: "Title",
      description: "Description", batchGenerate: "Batch Generate Descriptions", export: "Export Descriptions", exportFull: "Export Outline+Descriptions", import: "Import",
      pagesCompleted: "pages completed", noPages: "No pages yet",
      noPagesHint: "Please go back to outline editor to add pages first", backToOutline: "Back to Outline Editor",
      aiPlaceholder: "e.g., Make descriptions more detailed, remove a point from page 2, emphasize XXX... · Ctrl+Enter to submit",
      aiPlaceholderShort: "e.g., Make descriptions more detailed... · Ctrl+Enter",
      renovationProcessing: "Parsing page content...",
      renovationProgress: "{{completed}}/{{total}} pages",
      renovationFailed: "PDF parsing failed, please go back and retry",
      renovationPollFailed: "Lost connection to server. Please check your network and refresh the page.",
      messages: {
        generateSuccess: "Generated successfully", generateFailed: "Generation failed",
        confirmRegenerate: "Some pages already have descriptions. Regenerating will overwrite them. Continue?",
        confirmRegenerateTitle: "Confirm Regenerate",
        confirmRegeneratePage: "This page already has a description. Regenerating will overwrite it. Continue?",
        confirmRenovationRegenerate: "You are in PPT renovation mode. Regenerating will re-parse the original PDF page and regenerate the outline and description, overwriting existing content. Continue?",
        confirmRenovationRegenerateTitle: "Re-parse This Page",
        refineSuccess: "Descriptions modified successfully", refineFailed: "Modification failed, please try again",
        exportSuccess: "Export successful", importSuccess: "Import successful", importFailed: "Import failed, please check file format", importEmpty: "No valid pages found in file",
        loadingProject: "Loading project..."
      }
    }
  }
};
import { Button, Loading, useToast, useConfirm, AiRefineInput, FilePreviewModal, ReferenceFileList } from '@/components/shared';
import { DescriptionCard } from '@/components/preview/DescriptionCard';
import { useProjectStore } from '@/store/useProjectStore';
import { refineDescriptions, getTaskStatus, addPage } from '@/api/endpoints';
import { exportProjectToMarkdown, parseMarkdownPages } from '@/utils/projectUtils';

export const DetailEditor: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT(detailI18n);
  const { projectId } = useParams<{ projectId: string }>();
  const fromHistory = (location.state as any)?.from === 'history';
  const importFileRef = useRef<HTMLInputElement>(null);
  const {
    currentProject,
    syncProject,
    updatePageLocal,
    generateDescriptions,
    generatePageDescription,
    regenerateRenovationPage,
    pageDescriptionGeneratingTasks,
  } = useProjectStore();
  const { show, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [isAiRefining, setIsAiRefining] = React.useState(false);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [isRenovationProcessing, setIsRenovationProcessing] = useState(false);
  const [renovationProgress, setRenovationProgress] = useState<{ total: number; completed: number } | null>(null);

  // PPT 翻新：异步任务轮询
  useEffect(() => {
    if (!projectId) return;
    const taskId = localStorage.getItem('renovationTaskId');
    if (!taskId) return;

    setIsRenovationProcessing(true);
    let cancelled = false;
    let pollFailCount = 0;

    const poll = async () => {
      try {
        const response = await getTaskStatus(projectId, taskId);
        if (cancelled) return;
        const task = response.data;
        if (!task) return;
        pollFailCount = 0; // reset on success

        if (task.progress) {
          setRenovationProgress({
            total: task.progress.total || 0,
            completed: task.progress.completed || 0,
          });
        }

        // Sync project to get latest page data (incremental updates)
        await syncProject(projectId);

        if (task.status === 'COMPLETED') {
          localStorage.removeItem('renovationTaskId');
          setIsRenovationProcessing(false);
          setRenovationProgress(null);
          await syncProject(projectId);
          return;
        }

        if (task.status === 'FAILED') {
          localStorage.removeItem('renovationTaskId');
          setIsRenovationProcessing(false);
          setRenovationProgress(null);
          show({ message: task.error_message || t('detail.renovationFailed'), type: 'error' });
          return;
        }

        // Still processing — poll again
        setTimeout(poll, 2000);
      } catch (err) {
        if (cancelled) return;
        pollFailCount++;
        console.error('Renovation task poll error:', err);
        if (pollFailCount >= 5) {
          localStorage.removeItem('renovationTaskId');
          setIsRenovationProcessing(false);
          setRenovationProgress(null);
          show({ message: t('detail.renovationPollFailed'), type: 'error' });
          return;
        }
        setTimeout(poll, 3000);
      }
    };

    poll();
    return () => { cancelled = true; };
  }, [projectId]);

  // 加载项目数据
  useEffect(() => {
    if (projectId && (!currentProject || currentProject.id !== projectId)) {
      // 直接使用 projectId 同步项目数据
      syncProject(projectId);
    } else if (projectId && currentProject && currentProject.id === projectId) {
      // 如果项目已存在，也同步一次以确保数据是最新的（特别是从描述生成后）
      // 但只在首次加载时同步，避免频繁请求
      const shouldSync = !currentProject.pages.some(p => p.description_content);
      if (shouldSync) {
        syncProject(projectId);
      }
    }
  }, [projectId, currentProject?.id]); // 只在 projectId 或项目ID变化时更新


  const handleGenerateAll = async () => {
    const hasDescriptions = currentProject?.pages.some(
      (p) => p.description_content
    );
    
    const executeGenerate = async () => {
      await generateDescriptions();
    };
    
    if (hasDescriptions) {
      confirm(
        t('detail.messages.confirmRegenerate'),
        executeGenerate,
        { title: t('detail.messages.confirmRegenerateTitle'), variant: 'warning' }
      );
    } else {
      await executeGenerate();
    }
  };

  const handleRegeneratePage = async (pageId: string) => {
    if (!currentProject) return;

    const page = currentProject.pages.find((p) => p.id === pageId);
    if (!page) return;

    // 判断是否是 PPT 翻新模式
    const isRenovation = currentProject.creation_type === 'ppt_renovation';

    const executeRegenerate = async () => {
      try {
        if (isRenovation) {
          await regenerateRenovationPage(pageId);
        } else {
          await generatePageDescription(pageId);
        }
        show({ message: t('detail.messages.generateSuccess'), type: 'success' });
      } catch (error: any) {
        show({
          message: `${t('detail.messages.generateFailed')}: ${error.message || t('common.unknownError')}`,
          type: 'error'
        });
      }
    };

    // PPT 翻新模式 或 已有描述时，需要确认
    if (isRenovation) {
      confirm(
        t('detail.messages.confirmRenovationRegenerate'),
        executeRegenerate,
        { title: t('detail.messages.confirmRenovationRegenerateTitle'), variant: 'warning' }
      );
    } else if (page.description_content) {
      confirm(
        t('detail.messages.confirmRegeneratePage'),
        executeRegenerate,
        { title: t('detail.messages.confirmRegenerateTitle'), variant: 'warning' }
      );
    } else {
      await executeRegenerate();
    }
  };

  // Stable ref for handleRegeneratePage to avoid stale closures in memoized DescriptionCard
  const handleRegeneratePageRef = useRef(handleRegeneratePage);
  handleRegeneratePageRef.current = handleRegeneratePage;
  const stableHandleRegeneratePage = useCallback((pageId: string) => {
    handleRegeneratePageRef.current(pageId);
  }, []);

  const handleAiRefineDescriptions = useCallback(async (requirement: string, previousRequirements: string[]) => {
    if (!currentProject || !projectId) return;
    
    try {
      const response = await refineDescriptions(projectId, requirement, previousRequirements);
      await syncProject(projectId);
      show({ 
        message: response.data?.message || t('detail.messages.refineSuccess'), 
        type: 'success' 
      });
    } catch (error: any) {
      console.error('修改页面描述失败:', error);
      const errorMessage = error?.response?.data?.error?.message 
        || error?.message 
        || t('detail.messages.refineFailed');
      show({ message: errorMessage, type: 'error' });
      throw error; // 抛出错误让组件知道失败了
    }
  }, [currentProject, projectId, syncProject, show, t]);

  // 导出页面描述为 Markdown 文件
  const handleExportDescriptions = useCallback(() => {
    if (!currentProject) return;
    exportProjectToMarkdown(currentProject, { outline: false, description: true });
    show({ message: t('detail.messages.exportSuccess'), type: 'success' });
  }, [currentProject, show, t]);

  // 导出大纲+描述
  const handleExportFull = useCallback(() => {
    if (!currentProject) return;
    exportProjectToMarkdown(currentProject);
    show({ message: t('detail.messages.exportSuccess'), type: 'success' });
  }, [currentProject, show, t]);

  // 导入描述 Markdown 文件（追加新页面）
  const handleImportDescriptions = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (importFileRef.current) importFileRef.current.value = '';
    if (!file || !currentProject || !projectId) return;
    try {
      const text = await file.text();
      const parsed = parseMarkdownPages(text);
      if (parsed.length === 0) {
        show({ message: t('detail.messages.importEmpty'), type: 'error' });
        return;
      }
      const startIndex = currentProject.pages.reduce((max, p) => Math.max(max, (p.order_index ?? 0) + 1), 0);
      await Promise.all(parsed.map(({ title, points, text: desc, part }, i) =>
        addPage(projectId, {
          outline_content: { title, points },
          description_content: desc ? { text: desc } : undefined,
          part,
          order_index: startIndex + i,
        })
      ));
      await syncProject(projectId);
      show({ message: t('detail.messages.importSuccess'), type: 'success' });
    } catch {
      show({ message: t('detail.messages.importFailed'), type: 'error' });
    }
  }, [currentProject, projectId, syncProject, show, t]);

  if (!currentProject) {
    return <Loading fullscreen message={t('detail.messages.loadingProject')} />;
  }

  const hasAllDescriptions = currentProject.pages.every(
    (p) => p.description_content
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background-primary flex flex-col">
      {/* 顶栏 */}
      <header className="bg-white dark:bg-background-secondary shadow-sm dark:shadow-background-primary/30 border-b border-gray-200 dark:border-border-primary px-3 md:px-6 py-2 md:py-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-2 md:gap-4">
          {/* 左侧：Logo 和标题 */}
          <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => {
                if (fromHistory) {
                  navigate('/history');
                } else {
                  navigate(`/project/${projectId}/outline`);
                }
              }}
              disabled={isRenovationProcessing}
              className="flex-shrink-0"
            >
              <span className="hidden sm:inline">{t('common.back')}</span>
            </Button>
            <div className="flex items-center gap-1.5 md:gap-2">
              <span className="text-xl md:text-2xl">🍌</span>
              <span className="text-base md:text-xl font-bold">{t('home.title')}</span>
            </div>
            <span className="text-gray-400 hidden lg:inline">|</span>
            <span className="text-sm md:text-lg font-semibold hidden lg:inline">{t('detail.title')}</span>
          </div>
          
          {/* 中间：AI 修改输入框 */}
          <div className="flex-1 max-w-xl mx-auto hidden md:block md:-translate-x-3 pr-10">
            <AiRefineInput
              title=""
              placeholder={t('detail.aiPlaceholder')}
              onSubmit={handleAiRefineDescriptions}
              disabled={isRenovationProcessing}
              className="!p-0 !bg-transparent !border-0"
              onStatusChange={setIsAiRefining}
            />
          </div>

          {/* 右侧：操作按钮 */}
          <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
            <Button
              variant="secondary"
              size="sm"
              icon={<ArrowLeft size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => navigate(`/project/${projectId}/outline`)}
              disabled={isRenovationProcessing}
              className="hidden md:inline-flex"
            >
              <span className="hidden lg:inline">{t('common.previous')}</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<ArrowRight size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => navigate(`/project/${projectId}/preview`)}
              disabled={!hasAllDescriptions || isRenovationProcessing}
              className="text-xs md:text-sm"
            >
              <span className="hidden sm:inline">{t('detail.generateImages')}</span>
            </Button>
          </div>
        </div>
        
        {/* 移动端：AI 输入框 */}
        <div className="mt-2 md:hidden">
            <AiRefineInput
            title=""
            placeholder={t('detail.aiPlaceholderShort')}
            onSubmit={handleAiRefineDescriptions}
            disabled={isRenovationProcessing}
            className="!p-0 !bg-transparent !border-0"
            onStatusChange={setIsAiRefining}
          />
        </div>
      </header>

      {/* 操作栏 */}
      <div className="bg-white dark:bg-background-secondary border-b border-gray-200 dark:border-border-primary px-3 md:px-6 py-3 md:py-4 flex-shrink-0">
        {isRenovationProcessing ? (
          <div className="max-w-xl mx-auto">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-gray-700 dark:text-foreground-secondary">
                {t('detail.renovationProcessing')}
              </span>
              {renovationProgress && renovationProgress.total > 0 && (
                <span className="text-sm font-medium text-banana-600 dark:text-banana">
                  {t('detail.renovationProgress', { completed: String(renovationProgress.completed), total: String(renovationProgress.total) })}
                </span>
              )}
            </div>
            <div className="w-full h-2.5 bg-gray-200 dark:bg-background-hover rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-banana-400 to-banana-500 rounded-full transition-all duration-500 ease-out"
                style={{
                  width: renovationProgress && renovationProgress.total > 0
                    ? `${Math.round((renovationProgress.completed / renovationProgress.total) * 100)}%`
                    : '0%',
                  animation: !renovationProgress || renovationProgress.total === 0
                    ? 'pulse 1.5s ease-in-out infinite'
                    : undefined,
                  minWidth: !renovationProgress || renovationProgress.completed === 0 ? '10%' : undefined,
                }}
              />
            </div>
          </div>
        ) : (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-1">
            <Button
              variant="primary"
              icon={<Sparkles size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={handleGenerateAll}
              className="flex-1 sm:flex-initial text-sm md:text-base"
            >
              {t('detail.batchGenerate')}
            </Button>
            <Button
              variant="secondary"
              icon={<Download size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={handleExportDescriptions}
              disabled={!currentProject.pages.some(p => p.description_content)}
              className="flex-1 sm:flex-initial text-sm md:text-base"
            >
              {t('detail.export')}
            </Button>
            <Button
              variant="secondary"
              icon={<Download size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={handleExportFull}
              disabled={!currentProject.pages.some(p => p.description_content)}
              className="flex-1 sm:flex-initial text-sm md:text-base"
            >
              {t('detail.exportFull')}
            </Button>
            <Button
              variant="secondary"
              icon={<Upload size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => importFileRef.current?.click()}
              className="flex-1 sm:flex-initial text-sm md:text-base"
            >
              {t('detail.import')}
            </Button>
            <input ref={importFileRef} type="file" accept=".md,.txt" className="hidden" onChange={handleImportDescriptions} />
            <span className="text-xs md:text-sm text-gray-500 dark:text-foreground-tertiary whitespace-nowrap">
              {currentProject.pages.filter((p) => p.description_content).length} /{' '}
              {currentProject.pages.length} {t('detail.pagesCompleted')}
            </span>
          </div>
        </div>
        )}
      </div>

      {/* 主内容区 */}
      <main className="flex-1 p-3 md:p-6 overflow-y-auto min-h-0">
        <div className="max-w-7xl mx-auto">
          <ReferenceFileList
            projectId={projectId}
            onFileClick={setPreviewFileId}
            className="mb-4"
            showToast={show}
          />
          {currentProject.pages.length === 0 && !isRenovationProcessing ? (
            <div className="text-center py-12 md:py-20">
              <div className="flex justify-center mb-4"><FileText size={48} className="text-gray-300" /></div>
              <h3 className="text-lg md:text-xl font-semibold text-gray-700 dark:text-foreground-secondary mb-2">
                {t('detail.noPages')}
              </h3>
              <p className="text-sm md:text-base text-gray-500 dark:text-foreground-tertiary mb-6">
                {t('detail.noPagesHint')}
              </p>
              <Button
                variant="primary"
                onClick={() => navigate(`/project/${projectId}/outline`)}
                className="text-sm md:text-base"
              >
                {t('detail.backToOutline')}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
              {isRenovationProcessing && currentProject.pages.length === 0 ? (
                /* Placeholder skeleton cards while renovation creates pages */
                Array.from({ length: renovationProgress?.total || 6 }).map((_, index) => (
                  <DescriptionCard
                    key={`skeleton-${index}`}
                    page={{ id: `skeleton-${index}`, title: '', sort_order: index } as any}
                    index={index}
                    projectId={currentProject.id}
                    showToast={show}
                    onUpdate={() => {}}
                    onRegenerate={() => {}}
                    isGenerating={true}
                    isAiRefining={false}
                  />
                ))
              ) : (
                currentProject.pages.map((page, index) => {
                const pageId = page.id || page.page_id;
                // Show skeleton only if page has no description content yet
                const hasDescription = page.description_content && (
                  (typeof page.description_content === 'string' && page.description_content.trim()) ||
                  (typeof page.description_content === 'object' && page.description_content.text?.trim())
                );
                const pageIsGenerating = isRenovationProcessing && !hasDescription;
                return (
                  <DescriptionCard
                    key={pageId}
                    page={page}
                    index={index}
                    projectId={currentProject.id}
                    showToast={show}
                    onUpdate={(data) => updatePageLocal(pageId, data)}
                    onRegenerate={() => stableHandleRegeneratePage(pageId)}
                    isGenerating={pageIsGenerating || (pageId ? !!pageDescriptionGeneratingTasks[pageId] : false)}
                    isAiRefining={isAiRefining}
                  />
                );
              })
              )}
            </div>
          )}
        </div>
      </main>
      <ToastContainer />
      {ConfirmDialog}
      <FilePreviewModal fileId={previewFileId} onClose={() => setPreviewFileId(null)} />
    </div>
  );
};

