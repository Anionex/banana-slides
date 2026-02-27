import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, ArrowRight, Plus, FileText, Sparkle, Download, Upload, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useT } from '@/hooks/useT';

// 组件内翻译
const outlineI18n = {
  zh: {
    home: { title: '蕉幻' },
    outline: {
      title: "编辑大纲", pageCount: "共 {{count}} 页", addPage: "添加页面",
      generateDescriptions: "生成描述", generating: "生成中...", chapter: "章节",
      page: "第 {{num}} 页", titleLabel: "标题", keyPoints: "要点",
      keyPointsPlaceholder: "要点（每行一个）", addKeyPoint: "添加要点",
      deletePage: "删除页面", confirmDeletePage: "确定要删除这一页吗？",
      preview: "预览", clickToPreview: "点击左侧卡片查看详情",
      noPages: "还没有页面", noPagesHint: "点击「添加页面」手动创建，或「自动生成大纲」让 AI 帮你完成",
      parseOutline: "解析大纲", autoGenerate: "自动生成大纲",
      reParseOutline: "重新解析大纲", reGenerate: "重新生成大纲", export: "导出大纲", import: "导入",
      aiPlaceholder: "例如：增加一页关于XXX的内容、删除第3页、合并前两页... · Ctrl+Enter提交",
      aiPlaceholderShort: "例如：增加/删除页面... · Ctrl+Enter",
      contextLabels: { idea: "PPT构想", outline: "大纲", description: "描述" },
      inputLabel: { idea: "PPT 构想", outline: "原始大纲", description: "页面描述", ppt_renovation: "原始 PPT 内容" },
      inputPlaceholder: { idea: "输入你的 PPT 构想...", outline: "输入大纲内容...", description: "输入页面描述...", ppt_renovation: "已从 PDF 中提取内容" },
      messages: {
        outlineEmpty: "大纲不能为空", generateSuccess: "描述生成完成", generateFailed: "生成描述失败",
        generateIncomplete: "大纲生成可能不完整，请检查后重试",
        confirmRegenerate: "已有大纲内容，重新生成将覆盖现有内容，确定继续吗？",
        confirmRegenerateTitle: "确认重新生成", refineSuccess: "大纲修改成功",
        refineFailed: "修改失败，请稍后重试", exportSuccess: "导出成功",
        importSuccess: "导入成功", importFailed: "导入失败，请检查文件格式", importEmpty: "文件中未找到有效页面",
        loadingProject: "加载项目中...", generatingOutline: "生成大纲中...",
        saveFailed: "保存失败",
      }
    }
  },
  en: {
    home: { title: 'Banana Slides' },
    outline: {
      title: "Edit Outline", pageCount: "{{count}} pages", addPage: "Add Page",
      generateDescriptions: "Generate Descriptions", generating: "Generating...", chapter: "Chapter",
      page: "Page {{num}}", titleLabel: "Title", keyPoints: "Key Points",
      keyPointsPlaceholder: "Key points (one per line)", addKeyPoint: "Add Key Point",
      deletePage: "Delete Page", confirmDeletePage: "Are you sure you want to delete this page?",
      preview: "Preview", clickToPreview: "Click a card on the left to view details",
      noPages: "No pages yet", noPagesHint: "Click \"Add Page\" to create manually, or \"Auto Generate\" to let AI help you",
      parseOutline: "Parse Outline", autoGenerate: "Auto Generate Outline",
      reParseOutline: "Re-parse Outline", reGenerate: "Regenerate Outline", export: "Export Outline", import: "Import",
      aiPlaceholder: "e.g., Add a page about XXX, delete page 3, merge first two pages... · Ctrl+Enter to submit",
      aiPlaceholderShort: "e.g., Add/delete pages... · Ctrl+Enter",
      contextLabels: { idea: "PPT Idea", outline: "Outline", description: "Description" },
      inputLabel: { idea: "PPT Idea", outline: "Original Outline", description: "Page Descriptions", ppt_renovation: "Original PPT Content" },
      inputPlaceholder: { idea: "Enter your PPT idea...", outline: "Enter outline content...", description: "Enter page descriptions...", ppt_renovation: "Content extracted from PDF" },
      messages: {
        outlineEmpty: "Outline cannot be empty", generateSuccess: "Descriptions generated successfully", generateFailed: "Failed to generate descriptions",
        generateIncomplete: "Outline generation may be incomplete, please review and retry",
        confirmRegenerate: "Existing outline will be overwritten. Continue?",
        confirmRegenerateTitle: "Confirm Regenerate", refineSuccess: "Outline modified successfully",
        refineFailed: "Modification failed, please try again", exportSuccess: "Export successful",
        importSuccess: "Import successful", importFailed: "Import failed, please check file format", importEmpty: "No valid pages found in file",
        loadingProject: "Loading project...", generatingOutline: "Generating outline...",
        saveFailed: "Save failed",
      }
    }
  }
};
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Loading, useConfirm, useToast, AiRefineInput, FilePreviewModal, ReferenceFileList } from '@/components/shared';
import { MarkdownTextarea, type MarkdownTextareaRef } from '@/components/shared/MarkdownTextarea';
import { OutlineCard } from '@/components/outline/OutlineCard';
import { useProjectStore } from '@/store/useProjectStore';
import { refineOutline, updateProject, addPage } from '@/api/endpoints';
import { useImagePaste } from '@/hooks/useImagePaste';
import { exportProjectToMarkdown, parseMarkdownPages } from '@/utils/projectUtils';
import type { Page } from '@/types';

// 可排序的卡片包装器
const SortableCard: React.FC<{
  page: Page;
  index: number;
  projectId?: string;
  showToast: (props: { message: string; type: 'success' | 'error' | 'info' | 'warning' }) => void;
  onUpdate: (data: Partial<Page>) => void;
  onDelete: () => void;
  onClick: () => void;
  isSelected: boolean;
  isAiRefining?: boolean;
}> = (props) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: props.page.id || `page-${props.index}`,
  });

  const style = {
    // 只使用位移变换，不使用缩放，避免拖拽时元素被拉伸
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <OutlineCard {...props} dragHandleProps={listeners} />
    </div>
  );
};

export const OutlineEditor: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT(outlineI18n);
  const { projectId } = useParams<{ projectId: string }>();
  const fromHistory = (location.state as any)?.from === 'history';
  const {
    currentProject,
    syncProject,
    updatePageLocal,
    saveAllPages,
    reorderPages,
    deletePageById,
    addNewPage,
    generateOutlineStream,
    isGlobalLoading,
    isOutlineStreaming,
  } = useProjectStore();

  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [isAiRefining, setIsAiRefining] = useState(false);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  // Skeleton fade-out: keep it mounted briefly after streaming ends
  const [skeletonVisible, setSkeletonVisible] = useState(false);
  const [skeletonFading, setSkeletonFading] = useState(false);
  useEffect(() => {
    if (isOutlineStreaming) {
      setSkeletonVisible(true);
      setSkeletonFading(false);
    } else if (skeletonVisible) {
      setSkeletonFading(true);
      const timer = setTimeout(() => {
        setSkeletonVisible(false);
        setSkeletonFading(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isOutlineStreaming]);
  const { confirm, ConfirmDialog } = useConfirm();
  const { show, ToastContainer } = useToast();

  // 左侧可编辑文本区域 — desktop and mobile use separate refs to avoid
  // the shared-ref bug where insertAtCursor targets the wrong (hidden) instance.
  const desktopTextareaRef = useRef<MarkdownTextareaRef>(null);
  const mobileTextareaRef = useRef<MarkdownTextareaRef>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const getInputText = useCallback((project: typeof currentProject) => {
    if (!project) return '';
    if (project.creation_type === 'outline' || project.creation_type === 'ppt_renovation') return project.outline_text || project.idea_prompt || '';
    if (project.creation_type === 'descriptions') return project.description_text || project.idea_prompt || '';
    return project.idea_prompt || '';
  }, []);

  const [inputText, setInputText] = useState('');
  const [isInputDirty, setIsInputDirty] = useState(false);

  // 项目切换时：强制加载文本
  useEffect(() => {
    if (currentProject) {
      setInputText(getInputText(currentProject));
      setIsInputDirty(false);
    }
  }, [currentProject?.id]);

  const saveInputText = useCallback(async (text: string, creationType: string | undefined) => {
    if (!projectId || !creationType) return;
    try {
      const field = creationType === 'outline'
        ? 'outline_text'
        : creationType === 'descriptions'
          ? 'description_text'
          : 'idea_prompt';
      await updateProject(projectId, { [field]: text } as any);
      await syncProject(projectId);
      setIsInputDirty(false);
    } catch (e) {
      console.error('保存输入文本失败:', e);
      show({ message: t('outline.messages.saveFailed'), type: 'error' });
    }
  }, [projectId, show, syncProject]);

  // Debounced auto-save: save 1s after user stops typing
  useEffect(() => {
    if (!isInputDirty) return;
    const timer = setTimeout(() => {
      saveInputText(inputText, currentProject?.creation_type);
    }, 1000);
    return () => clearTimeout(timer);
  }, [inputText, isInputDirty, saveInputText, currentProject?.creation_type]);

  const handleSaveInputText = useCallback(() => {
    if (!isInputDirty) return;
    saveInputText(inputText, currentProject?.creation_type);
  }, [inputText, isInputDirty, saveInputText, currentProject?.creation_type]);

  const handleInputChange = useCallback((text: string) => {
    setInputText(text);
    setIsInputDirty(true);
  }, []);

  const insertAtCursor = useCallback((markdown: string) => {
    // Prefer the desktop ref (visible at md+), fall back to mobile
    const ref = desktopTextareaRef.current || mobileTextareaRef.current;
    ref?.insertAtCursor(markdown);
  }, []);

  const { handlePaste: handleImagePaste, handleFiles: handleImageFiles, isUploading: _isUploadingImage } = useImagePaste({
    projectId: projectId || null,
    setContent: setInputText,
    showToast: show,
    insertAtCursor,
  });

  const inputLabel = useMemo(() => {
    const type = currentProject?.creation_type || 'idea';
    const key = type === 'descriptions' ? 'description' : type;
    return t(`outline.inputLabel.${key}` as any) || t('outline.contextLabels.idea');
  }, [currentProject?.creation_type, t]);

  const inputPlaceholder = useMemo(() => {
    const type = currentProject?.creation_type || 'idea';
    const key = type === 'descriptions' ? 'description' : type;
    return t(`outline.inputPlaceholder.${key}` as any) || '';
  }, [currentProject?.creation_type, t]);

  // 加载项目数据
  useEffect(() => {
    if (projectId && (!currentProject || currentProject.id !== projectId)) {
      syncProject(projectId);
    }
  }, [projectId, currentProject, syncProject]);

  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && currentProject) {
      const oldIndex = currentProject.pages.findIndex((p) => p.id === active.id);
      const newIndex = currentProject.pages.findIndex((p) => p.id === over.id);

      const reorderedPages = arrayMove(currentProject.pages, oldIndex, newIndex);
      reorderPages(reorderedPages.map((p) => p.id).filter((id): id is string => id !== undefined));
    }
  };

  const handleGenerateOutline = async () => {
    if (!currentProject) return;

    const doGenerate = async () => {
      try {
        const result = await generateOutlineStream();
        if (result && !result.complete) {
          show({ message: t('outline.messages.generateIncomplete'), type: 'warning' });
        }
      } catch (error: any) {
        console.error('生成大纲失败:', error);
        const message = error.friendlyMessage || error.message || t('outline.messages.generateFailed');
        show({ message, type: 'error' });
      }
    };

    if (currentProject.pages.length > 0) {
      confirm(
        t('outline.messages.confirmRegenerate'),
        doGenerate,
        { title: t('outline.messages.confirmRegenerateTitle'), variant: 'warning' }
      );
      return;
    }

    await doGenerate();
  };

  const handleAiRefineOutline = useCallback(async (requirement: string, previousRequirements: string[]) => {
    if (!currentProject || !projectId) return;

    try {
      const response = await refineOutline(projectId, requirement, previousRequirements);
      await syncProject(projectId);
      show({
        message: response.data?.message || t('outline.messages.refineSuccess'),
        type: 'success'
      });
    } catch (error: any) {
      console.error('修改大纲失败:', error);
      const errorMessage = error?.response?.data?.error?.message
        || error?.message
        || t('outline.messages.refineFailed');
      show({ message: errorMessage, type: 'error' });
      throw error;
    }
  }, [currentProject, projectId, syncProject, show]);

  // 导出大纲为 Markdown 文件
  const handleExportOutline = useCallback(() => {
    if (!currentProject) return;
    exportProjectToMarkdown(currentProject, { outline: true, description: false });
    show({ message: t('outline.messages.exportSuccess'), type: 'success' });
  }, [currentProject, show]);

  // 导入大纲 Markdown 文件（追加新页面）
  const handleImportOutline = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (importFileRef.current) importFileRef.current.value = '';
    if (!file || !currentProject || !projectId) return;
    try {
      const text = await file.text();
      const parsed = parseMarkdownPages(text);
      if (parsed.length === 0) {
        show({ message: t('outline.messages.importEmpty'), type: 'error' });
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
      show({ message: t('outline.messages.importSuccess'), type: 'success' });
    } catch {
      show({ message: t('outline.messages.importFailed'), type: 'error' });
    }
  }, [currentProject, projectId, syncProject, show, t]);

  if (!currentProject) {
    return <Loading fullscreen message={t('outline.messages.loadingProject')} />;
  }

  if (isGlobalLoading && !isOutlineStreaming) {
    return <Loading fullscreen message={t('outline.messages.generatingOutline')} />;
  }

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
                  navigate('/');
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
            <span className="text-sm md:text-lg font-semibold hidden lg:inline">{t('outline.title')}</span>
          </div>

          {/* 中间：AI 修改输入框 */}
          <div className="flex-1 max-w-xl mx-auto hidden md:block md:-translate-x-2 pr-10">
            <AiRefineInput
              title=""
              placeholder={t('outline.aiPlaceholder')}
              onSubmit={handleAiRefineOutline}
              disabled={false}
              className="!p-0 !bg-transparent !border-0"
              onStatusChange={setIsAiRefining}
            />
          </div>

          {/* 右侧：操作按钮 */}
          <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
            <Button
              variant="primary"
              size="sm"
              icon={<ArrowRight size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={async () => {
                if (isInputDirty && projectId && currentProject) {
                  const field = currentProject.creation_type === 'outline'
                    ? 'outline_text'
                    : currentProject.creation_type === 'descriptions'
                      ? 'description_text'
                      : 'idea_prompt';
                  try {
                    await updateProject(projectId, { [field]: inputText } as any);
                  } catch (e) {
                    console.error('自动保存失败:', e);
                  }
                }
                navigate(`/project/${projectId}/detail`);
              }}
              className="text-xs md:text-sm"
            >
              <span className="hidden sm:inline">{t('common.next')}</span>
            </Button>
          </div>
        </div>

        {/* 移动端：AI 输入框 */}
        <div className="mt-2 md:hidden">
            <AiRefineInput
            title=""
            placeholder={t('outline.aiPlaceholderShort')}
            onSubmit={handleAiRefineOutline}
            disabled={false}
            className="!p-0 !bg-transparent !border-0"
            onStatusChange={setIsAiRefining}
          />
        </div>
      </header>

      {/* 操作栏 - 与 DetailEditor 风格一致 */}
      <div className="bg-white dark:bg-background-secondary border-b border-gray-200 dark:border-border-primary px-3 md:px-6 py-3 md:py-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-1">
            <Button
              variant="primary"
              icon={<Plus size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={addNewPage}
              className="flex-1 sm:flex-initial text-sm md:text-base"
            >
              {t('outline.addPage')}
            </Button>
            {currentProject.pages.length === 0 && !isOutlineStreaming ? (
              <Button
                variant="secondary"
                onClick={handleGenerateOutline}
                disabled={isOutlineStreaming}
                className="flex-1 sm:flex-initial text-sm md:text-base"
              >
                {currentProject.creation_type === 'outline' ? t('outline.parseOutline') : t('outline.autoGenerate')}
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={handleGenerateOutline}
                disabled={isOutlineStreaming}
                className="flex-1 sm:flex-initial text-sm md:text-base"
              >
                {isOutlineStreaming
                  ? t('outline.generating')
                  : currentProject.creation_type === 'outline' ? t('outline.reParseOutline') : t('outline.reGenerate')}
              </Button>
            )}
            <Button
              variant="secondary"
              icon={<Download size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={handleExportOutline}
              disabled={currentProject.pages.length === 0}
              className="flex-1 sm:flex-initial text-sm md:text-base"
            >
              {t('outline.export')}
            </Button>
            <Button
              variant="secondary"
              icon={<Upload size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => importFileRef.current?.click()}
              className="flex-1 sm:flex-initial text-sm md:text-base"
            >
              {t('outline.import')}
            </Button>
            <input ref={importFileRef} type="file" accept=".md,.txt" className="hidden" onChange={handleImportOutline} />
            {/* 手机端：保存按钮 */}
            <Button
              variant="secondary"
              icon={<Save size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={async () => await saveAllPages()}
              className="md:hidden flex-1 sm:flex-initial text-sm md:text-base"
            >
              {t('common.save')}
            </Button>
            <span className="text-xs md:text-sm text-gray-500 dark:text-foreground-tertiary whitespace-nowrap">
              {t('outline.pageCount', { count: String(currentProject.pages.length) })}
            </span>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col md:flex-row gap-3 md:gap-6 p-3 md:p-6 overflow-y-auto min-h-0 relative">
        {/* 左侧：可编辑文本区域（可收起） */}
        <div
          className="flex-shrink-0 transition-[width] duration-300 ease-in-out hidden md:block"
          style={{ width: isPanelOpen ? undefined : 0 }}
        >
          <div
            className="w-[320px] lg:w-[360px] xl:w-[400px] transition-[opacity,transform] duration-300 ease-in-out md:sticky md:top-0"
            style={{
              opacity: isPanelOpen ? 1 : 0,
              transform: isPanelOpen ? 'translateX(0)' : 'translateX(-16px)',
              pointerEvents: isPanelOpen ? 'auto' : 'none',
            }}
          >
            <div className="bg-white dark:bg-background-secondary rounded-card shadow-md border border-gray-100 dark:border-border-primary overflow-hidden">
              <div className="px-4 py-2.5 flex items-center gap-2 border-b border-gray-100 dark:border-border-secondary">
                {currentProject.creation_type === 'idea'
                  ? <Sparkle size={14} className="text-banana-500 flex-shrink-0" />
                  : <FileText size={14} className="text-banana-500 flex-shrink-0" />}
                <span className="text-xs font-medium text-gray-500 dark:text-foreground-tertiary">{inputLabel}</span>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsPanelOpen(false)}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-foreground-secondary rounded hover:bg-gray-100 dark:hover:bg-background-hover transition-colors"
                  >
                    <PanelLeftClose size={14} />
                  </button>
                </div>
              </div>
              <MarkdownTextarea
                ref={desktopTextareaRef}
                value={inputText}
                onChange={handleInputChange}
                onBlur={handleSaveInputText}
                onPaste={handleImagePaste}
                onFiles={handleImageFiles}
                placeholder={inputPlaceholder}
                rows={12}
                className="border-0 rounded-none shadow-none"
              />
            </div>
            <ReferenceFileList
              projectId={projectId}
              onFileClick={setPreviewFileId}
              className="mt-3"
              showToast={show}
            />
          </div>
        </div>

        {/* 收起时的把手 - 绝对定位贴左边缘 */}
        {!isPanelOpen && (
          <button
            type="button"
            onClick={() => setIsPanelOpen(true)}
            className="hidden md:flex absolute left-0 top-6 z-10 items-center justify-center w-6 h-14 bg-white dark:bg-background-secondary border border-l-0 border-gray-200 dark:border-border-primary rounded-r-lg shadow-md text-gray-400 hover:text-banana-500 hover:border-banana-300 dark:hover:border-banana-500/40 hover:shadow-lg transition-all"
          >
            <PanelLeftOpen size={14} />
          </button>
        )}

        {/* 移动端：始终显示卡片 */}
        <div className="md:hidden w-full flex-shrink-0">
          <div className="bg-white dark:bg-background-secondary rounded-card shadow-md border border-gray-100 dark:border-border-primary overflow-hidden">
            <div className="px-4 py-2.5 flex items-center gap-2 border-b border-gray-100 dark:border-border-secondary">
              {currentProject.creation_type === 'idea'
                ? <Sparkle size={14} className="text-banana-500 flex-shrink-0" />
                : <FileText size={14} className="text-banana-500 flex-shrink-0" />}
              <span className="text-xs font-medium text-gray-500 dark:text-foreground-tertiary">{inputLabel}</span>
            </div>
            <MarkdownTextarea
              ref={mobileTextareaRef}
              value={inputText}
              onChange={handleInputChange}
              onBlur={handleSaveInputText}
              onPaste={handleImagePaste}
              onFiles={handleImageFiles}
              placeholder={inputPlaceholder}
              rows={6}
              className="border-0 rounded-none shadow-none"
            />
          </div>
          <ReferenceFileList
            projectId={projectId}
            onFileClick={setPreviewFileId}
            className="mt-3"
            showToast={show}
          />
        </div>

        {/* 右侧：大纲列表 */}
        <div className="flex-1 min-w-0">
          {currentProject.pages.length === 0 && !isOutlineStreaming ? (
            <div className="text-center py-12 md:py-20">
              <div className="flex justify-center mb-4">
                <FileText size={48} className="text-gray-300" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-foreground-primary mb-2">
                {t('outline.noPages')}
              </h3>
              <p className="text-gray-500 dark:text-foreground-tertiary mb-6">
                {t('outline.noPagesHint')}
              </p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={currentProject.pages.map((p, idx) => p.id || `page-${idx}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3 md:space-y-4">
                  {currentProject.pages.map((page, index) => (
                    <div
                      key={page.id || `page-${index}`}
                      className={isOutlineStreaming ? 'animate-slide-in-up' : ''}
                      style={isOutlineStreaming ? { animationDelay: `${index * 60}ms` } : undefined}
                    >
                      <SortableCard
                        page={page}
                        index={index}
                        projectId={projectId}
                        showToast={show}
                        onUpdate={(data) => page.id && updatePageLocal(page.id, data)}
                        onDelete={() => page.id && deletePageById(page.id)}
                        onClick={() => setSelectedPageId(page.id || null)}
                        isSelected={selectedPageId === page.id}
                        isAiRefining={isAiRefining}
                      />
                    </div>
                  ))}
                  {skeletonVisible && (
                    <div
                      className="transition-opacity duration-1000"
                      style={{ opacity: skeletonFading ? 0 : 1 }}
                    >
                      <div className="animate-pulse">
                        <div className="bg-white dark:bg-background-secondary rounded-xl shadow-sm border border-gray-100 dark:border-border-primary p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded mt-1" />
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
                              <div className="h-4 w-16 bg-banana-100 dark:bg-banana-900/30 rounded" />
                            </div>
                            <div className="h-5 w-2/3 bg-gray-200 dark:bg-gray-700 rounded" />
                            <div className="space-y-2">
                              <div className="h-3.5 w-full bg-gray-100 dark:bg-gray-800 rounded" />
                              <div className="h-3.5 w-4/5 bg-gray-100 dark:bg-gray-800 rounded" />
                              <div className="h-3.5 w-3/5 bg-gray-100 dark:bg-gray-800 rounded" />
                            </div>
                          </div>
                        </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </main>
      {ConfirmDialog}
      <ToastContainer />
      <FilePreviewModal fileId={previewFileId} onClose={() => setPreviewFileId(null)} />
    </div>
  );
};
