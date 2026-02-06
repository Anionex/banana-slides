import React, { useEffect, useCallback, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, FileText, Sparkles, Download } from 'lucide-react';
import { useT } from '@/hooks/useT';

// 组件内翻译
const detailI18n = {
  zh: {
    home: { title: '蕉幻' },
    detail: {
      title: "编辑页面描述", pageCount: "共 {{count}} 页", generateImages: "生成图片",
      generating: "生成中...", page: "第 {{num}} 页", titleLabel: "标题",
      description: "描述", batchGenerate: "批量生成描述", export: "导出描述",
      pagesCompleted: "页已完成", noPages: "还没有页面",
      noPagesHint: "请先返回大纲编辑页添加页面", backToOutline: "返回大纲编辑",
      aiPlaceholder: "例如：让描述更详细、删除第2页的某个要点、强调XXX的重要性... · Ctrl+Enter提交",
      aiPlaceholderShort: "例如：让描述更详细... · Ctrl+Enter",
      messages: {
        generateSuccess: "生成成功", generateFailed: "生成失败",
        confirmRegenerate: "部分页面已有描述，重新生成将覆盖，确定继续吗？",
        confirmRegenerateTitle: "确认重新生成",
        confirmRegeneratePage: "该页面已有描述，重新生成将覆盖现有内容，确定继续吗？",
        refineSuccess: "页面描述修改成功", refineFailed: "修改失败，请稍后重试",
        exportSuccess: "导出成功", loadingProject: "加载项目中..."
      }
    }
  },
  en: {
    home: { title: 'Banana Slides' },
    detail: {
      title: "Edit Descriptions", pageCount: "{{count}} pages", generateImages: "Generate Images",
      generating: "Generating...", page: "Page {{num}}", titleLabel: "Title",
      description: "Description", batchGenerate: "Batch Generate Descriptions", export: "Export Descriptions",
      pagesCompleted: "pages completed", noPages: "No pages yet",
      noPagesHint: "Please go back to outline editor to add pages first", backToOutline: "Back to Outline Editor",
      aiPlaceholder: "e.g., Make descriptions more detailed, remove a point from page 2, emphasize XXX... · Ctrl+Enter to submit",
      aiPlaceholderShort: "e.g., Make descriptions more detailed... · Ctrl+Enter",
      messages: {
        generateSuccess: "Generated successfully", generateFailed: "Generation failed",
        confirmRegenerate: "Some pages already have descriptions. Regenerating will overwrite them. Continue?",
        confirmRegenerateTitle: "Confirm Regenerate",
        confirmRegeneratePage: "This page already has a description. Regenerating will overwrite it. Continue?",
        refineSuccess: "Descriptions modified successfully", refineFailed: "Modification failed, please try again",
        exportSuccess: "Export successful", loadingProject: "Loading project..."
      }
    }
  }
};
import { Button, Loading, useToast, useConfirm, AiRefineInput, FilePreviewModal, ProjectResourcesList } from '@/components/shared';
import { DescriptionCard } from '@/components/preview/DescriptionCard';
import { useProjectStore } from '@/store/useProjectStore';
import { refineDescriptions } from '@/api/endpoints';
import { refreshCredits } from '@/api/auth';
import { exportDescriptionsToMarkdown } from '@/utils/projectUtils';

export const DetailEditor: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT(detailI18n);
  const { projectId } = useParams<{ projectId: string }>();
  const fromHistory = (location.state as any)?.from === 'history';
  const {
    currentProject,
    syncProject,
    updatePageLocal,
    generateDescriptions,
    generatePageDescription,
    pageDescriptionGeneratingTasks,
  } = useProjectStore();
  const { show, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [isAiRefining, setIsAiRefining] = React.useState(false);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);

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
    
    // 如果已有描述，询问是否覆盖
    if (page.description_content) {
      confirm(
        t('detail.messages.confirmRegeneratePage'),
        async () => {
          try {
            await generatePageDescription(pageId);
            show({ message: t('detail.messages.generateSuccess'), type: 'success' });
          } catch (error: any) {
            show({ 
              message: `${t('detail.messages.generateFailed')}: ${error.message || t('common.unknownError')}`, 
              type: 'error' 
            });
          }
        },
        { title: t('detail.messages.confirmRegenerateTitle'), variant: 'warning' }
      );
      return;
    }
    
    try {
      await generatePageDescription(pageId);
      show({ message: t('detail.messages.generateSuccess'), type: 'success' });
    } catch (error: any) {
      show({ 
        message: `${t('detail.messages.generateFailed')}: ${error.message || t('common.unknownError')}`, 
        type: 'error' 
      });
    }
  };

  const handleAiRefineDescriptions = useCallback(async (requirement: string, previousRequirements: string[]) => {
    if (!currentProject || !projectId) return;
    
    try {
      const response = await refineDescriptions(projectId, requirement, previousRequirements);
      await syncProject(projectId);
      refreshCredits();
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
    exportDescriptionsToMarkdown(currentProject);
    show({ message: t('detail.messages.exportSuccess'), type: 'success' });
  }, [currentProject, show, t]);

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
              disabled={false}
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
              className="hidden md:inline-flex"
            >
              <span className="hidden lg:inline">{t('common.previous')}</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<ArrowRight size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => navigate(`/project/${projectId}/preview`)}
              disabled={!hasAllDescriptions}
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
            disabled={false}
            className="!p-0 !bg-transparent !border-0"
            onStatusChange={setIsAiRefining}
          />
        </div>
      </header>

      {/* 操作栏 */}
      <div className="bg-white dark:bg-background-secondary border-b border-gray-200 dark:border-border-primary px-3 md:px-6 py-3 md:py-4 flex-shrink-0">
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
            <span className="text-xs md:text-sm text-gray-500 dark:text-foreground-tertiary whitespace-nowrap">
              {currentProject.pages.filter((p) => p.description_content).length} /{' '}
              {currentProject.pages.length} {t('detail.pagesCompleted')}
            </span>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <main className="flex-1 p-3 md:p-6 overflow-y-auto min-h-0">
        <div className="max-w-7xl mx-auto">
          {/* 项目资源列表（文件和图片） */}
          <ProjectResourcesList
            projectId={projectId || null}
            onFileClick={setPreviewFileId}
            showFiles={true}
            showImages={true}
          />
          
          {currentProject.pages.length === 0 ? (
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
              {currentProject.pages.map((page, index) => {
                const pageId = page.id || page.page_id;
                return (
                  <DescriptionCard
                    key={pageId}
                    page={page}
                    index={index}
                    projectId={currentProject.id}
                    onUpdate={(data) => updatePageLocal(pageId, data)}
                    onRegenerate={() => handleRegeneratePage(pageId)}
                    isGenerating={pageId ? !!pageDescriptionGeneratingTasks[pageId] : false}
                    isAiRefining={isAiRefining}
                  />
                );
              })}
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

