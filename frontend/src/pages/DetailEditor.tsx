import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, FileText, Sparkles, Download, Upload, ChevronDown, Settings2, X, Plus, HelpCircle, ImageIcon } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { MarkdownTextarea, type MarkdownTextareaRef } from '@/components/shared/MarkdownTextarea';
import PresetCapsules from '@/components/shared/PresetCapsules';
import { useImagePaste, buildMaterialsMarkdown } from '@/hooks/useImagePaste';
import type { Material } from '@/types';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, useSortable, rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// 组件内翻译
const detailI18n = {
  zh: {
    home: { title: '蕉幻' },
    detail: {
      title: "编辑页面描述", pageCount: "共 {{count}} 页", generateImages: "生成图片",
      generating: "生成中...", page: "第 {{num}} 页", titleLabel: "标题",
      description: "描述", batchGenerate: "批量生成描述", export: "导出描述", exportFull: "导出大纲和描述", import: "导入", importExport: "导入/导出",
      pagesCompleted: "页已完成", noPages: "还没有页面",
      noPagesHint: "请先返回大纲编辑页添加页面", backToOutline: "返回大纲编辑",
      aiPlaceholder: "例如：让描述更详细、删除第2页的某个要点、强调XXX的重要性... · Ctrl+Enter提交",
      aiPlaceholderShort: "例如：让描述更详细... · Ctrl+Enter",
      renovationProcessing: "正在解析页面内容...",
      renovationProgress: "{{completed}}/{{total}} 页",
      renovationFailed: "PDF 解析失败，请返回重试",
      renovationPollFailed: "与服务器通信失败，请检查网络后刷新页面重试",
      disabledNextTip: "还有 {{count}} 页缺少描述，请先完成所有页面的描述",
      detailLevel: { label: "详细程度", concise: "精简", default: "默认", detailed: "详细" },
      descSettings: "描述设置",
      generationMode: "生成模式",
      generationModeHint: "流式：AI 从第一页开始逐页输出，速度慢但效果更好。并行：AI 根据大纲并行生成每页描述，速度快但可能不够细致。",
      streaming: "流式",
      parallel: "并行",
      extraFields: "额外字段",
      extraFieldsHint: "启用后，AI 生成描述时会带上这些字段。可通过「描述生成要求」进一步约束字段输出的内容。点击胶囊启用/禁用，拖拽调整顺序。",
      imagePromptOn: "该字段会影响生成的图片效果，点击可关闭",
      imagePromptOff: "该字段不会影响生成的图片，点击可开启",
      addField: "添加字段",
      descRequirements: "描述生成要求",
      descRequirementsPlaceholder: "例如：每页描述控制在100字以内、多使用数据和案例、强调关键指标...",
      messages: {
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
      description: "Description", batchGenerate: "Batch Generate Descriptions", export: "Export Descriptions", exportFull: "Export Outline & Descriptions", import: "Import", importExport: "Import/Export",
      pagesCompleted: "pages completed", noPages: "No pages yet",
      noPagesHint: "Please go back to outline editor to add pages first", backToOutline: "Back to Outline Editor",
      aiPlaceholder: "e.g., Make descriptions more detailed, remove a point from page 2, emphasize XXX... · Ctrl+Enter to submit",
      aiPlaceholderShort: "e.g., Make descriptions more detailed... · Ctrl+Enter",
      renovationProcessing: "Parsing page content...",
      renovationProgress: "{{completed}}/{{total}} pages",
      renovationFailed: "PDF parsing failed, please go back and retry",
      renovationPollFailed: "Lost connection to server. Please check your network and refresh the page.",
      disabledNextTip: "{{count}} page(s) are missing descriptions. Please complete all page descriptions first",
      detailLevel: { label: "Detail Level", concise: "Concise", default: "Default", detailed: "Detailed" },
      descSettings: "Description Settings",
      generationMode: "Generation Mode",
      generationModeHint: "Streaming: AI outputs pages sequentially from first to last, slower but better quality. Parallel: AI generates each page independently based on the outline, faster but may be less detailed.",
      streaming: "Streaming",
      parallel: "Parallel",
      extraFields: "Extra Fields",
      extraFieldsHint: "When enabled, AI will include these fields when generating descriptions. Use \"Generation Requirements\" to further constrain field output. Click pills to enable/disable, drag to reorder.",
      imagePromptOn: "This field affects generated image results, click to disable",
      imagePromptOff: "This field does not affect generated images, click to enable",
      addField: "Add Field",
      descRequirements: "Generation Requirements",
      descRequirementsPlaceholder: "e.g., Keep each page under 100 words, use data and examples, highlight key metrics...",
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
import { Button, Loading, useToast, useConfirm, AiRefineInput, FilePreviewModal, ReferenceFileList, MaterialSelector } from '@/components/shared';
import { DescriptionCard } from '@/components/preview/DescriptionCard';
import { useProjectStore } from '@/store/useProjectStore';
import { refineDescriptions, getTaskStatus, addPage, updateProject, getSettings, updateSettings } from '@/api/endpoints';
import { exportProjectToMarkdown, parseMarkdownPages } from '@/utils/projectUtils';

// 详细程度图标 — 暂时屏蔽，效果不够理想
// const DETAIL_LEVEL_LINES: Record<string, number[]> = {
//   concise:  [5, 8],
//   default:  [4, 7, 10],
//   detailed: [3.5, 5.5, 7.5, 9.5, 11.5],
// };
// const DetailLevelIcon: React.FC<{ level: string }> = ({ level }) => ( ... );

const PRESET_EXTRA_FIELDS = new Set(['视觉元素', '视觉焦点', '排版布局', '演讲者备注']);

// 可拖拽排序的额外字段胶囊
const SortableFieldPill: React.FC<{
  name: string;
  active: boolean;
  removable?: boolean;
  inImagePrompt?: boolean;
  imagePromptTooltip?: string;
  onToggle: () => void;
  onRemove: () => void;
  onToggleImagePrompt?: () => void;
}> = ({ name, active, onToggle, onRemove, removable = true, inImagePrompt, imagePromptTooltip, onToggleImagePrompt }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: name });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      type="button"
      className={`group inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border cursor-grab active:cursor-grabbing ${
        isDragging ? '' : 'transition-colors duration-150 '
      }${
        active
          ? 'bg-banana-50 dark:bg-banana-900/20 border-banana-300 dark:border-banana-700 text-banana-700 dark:text-banana-400'
          : 'bg-gray-50 dark:bg-background-hover border-gray-200 dark:border-border-primary text-gray-400 dark:text-foreground-tertiary line-through'
      }`}
      onClick={onToggle}
    >
      {name}
      {active && onToggleImagePrompt && (
        <span
          role="button"
          className={`relative group/img ml-0.5 transition-colors ${inImagePrompt ? 'text-banana-500' : 'text-gray-300 dark:text-gray-600'}`}
          onClick={e => { e.stopPropagation(); onToggleImagePrompt(); }}
        >
          <ImageIcon size={10} />
          {imagePromptTooltip && (
            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-40 px-2 py-1 text-[10px] leading-snug text-gray-600 dark:text-foreground-secondary bg-white dark:bg-background-primary border border-gray-200 dark:border-border-primary rounded-md shadow-md opacity-0 pointer-events-none group-hover/img:opacity-100 transition-opacity z-50">
              {imagePromptTooltip}
            </span>
          )}
        </span>
      )}
      {!active && removable && (
        <span
          role="button"
          className="opacity-0 group-hover:opacity-100 ml-0.5 text-gray-400 hover:text-red-500 transition-all"
          onClick={e => { e.stopPropagation(); onRemove(); }}
        >
          <X size={10} />
        </span>
      )}
    </button>
  );
};

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
  } = useProjectStore();
  const { show, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [isAiRefining, setIsAiRefining] = React.useState(false);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [isRenovationProcessing, setIsRenovationProcessing] = useState(false);
  const [renovationProgress, setRenovationProgress] = useState<{ total: number; completed: number } | null>(null);
  const [detailLevel, setDetailLevel] = useState<string>('default');
  const [generationMode, setGenerationMode] = useState<'streaming' | 'parallel'>('streaming');
  const [extraFieldNames, setExtraFieldNames] = useState<string[]>(['视觉元素', '视觉焦点', '排版布局', '演讲者备注']);
  const [imagePromptFields, setImagePromptFields] = useState<string[]>(['视觉元素', '视觉焦点', '排版布局']);
  // 可选字段池（localStorage 持久化，包含所有已知字段名）
  const [availableFields, setAvailableFields] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('banana-available-extra-fields');
      return stored ? JSON.parse(stored) : ['视觉元素', '视觉焦点', '排版布局', '演讲者备注'];
    } catch { return ['视觉元素', '视觉焦点', '排版布局', '演讲者备注']; }
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [newFieldName, setNewFieldName] = useState('');
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const settingsSaveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Load settings from DB on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await getSettings();
        const s = res.data;
        if (!s) return;
        setDetailLevel('default');
        // detail level from sessionStorage (backwards compat, then from DB if we add it later)
        const storedLevel = sessionStorage.getItem('banana-detail-level');
        if (storedLevel) setDetailLevel(storedLevel);
        setGenerationMode(s.description_generation_mode || 'streaming');
        const activeFields = s.description_extra_fields || ['视觉元素', '视觉焦点', '排版布局', '演讲者备注'];
        setExtraFieldNames(activeFields);
        if (s.image_prompt_extra_fields) setImagePromptFields(s.image_prompt_extra_fields);
        // 合并活跃字段到可选池
        setAvailableFields(prev => {
          const merged = [...new Set([...prev, ...activeFields])];
          localStorage.setItem('banana-available-extra-fields', JSON.stringify(merged));
          return merged;
        });
        // Cache settings in sessionStorage for store to read
        sessionStorage.setItem('banana-settings', JSON.stringify(s));
      } catch { /* ignore */ }
    })();
  }, []);

  // Debounced save settings to DB
  const saveSettingsDebounced = useCallback((updates: Record<string, unknown>) => {
    if (settingsSaveTimerRef.current) clearTimeout(settingsSaveTimerRef.current);
    settingsSaveTimerRef.current = setTimeout(async () => {
      try {
        const res = await updateSettings(updates as any);
        if (res.data) {
          sessionStorage.setItem('banana-settings', JSON.stringify(res.data));
        }
      } catch (e) {
        console.error('Failed to save settings:', e);
      }
    }, 800);
  }, []);

  // 额外字段拖拽排序
  const fieldSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const handleFieldDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = availableFields.indexOf(active.id as string);
    const newIdx = availableFields.indexOf(over.id as string);
    if (oldIdx === -1 || newIdx === -1) return;
    const nextPool = arrayMove(availableFields, oldIdx, newIdx);
    setAvailableFields(nextPool);
    localStorage.setItem('banana-available-extra-fields', JSON.stringify(nextPool));
    // 激活字段按新池顺序重排
    const activeSet = new Set(extraFieldNames);
    const nextActive = nextPool.filter(f => activeSet.has(f));
    setExtraFieldNames(nextActive);
    saveSettingsDebounced({ description_extra_fields: nextActive });
  }, [availableFields, extraFieldNames, saveSettingsDebounced]);

  const [descRequirements, setDescRequirements] = useState('');
  const [isDescReqDirty, setIsDescReqDirty] = useState(false);
  const reqTextareaRef = useRef<MarkdownTextareaRef>(null);
  const [isDescReqOpen, setIsDescReqOpen] = useState(
    () => localStorage.getItem('descReqOpen') !== 'false'
  );

  const [isMaterialSelectorOpen, setIsMaterialSelectorOpen] = useState(false);
  const handleMaterialSelect = useCallback((materials: Material[]) => {
    const markdown = buildMaterialsMarkdown(materials, setDescRequirements);
    reqTextareaRef.current?.insertAtCursor(markdown + '\n');
  }, []);

  // 点击外部关闭下拉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setFileMenuOpen(false);
      }
    };
    if (settingsOpen || fileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [settingsOpen, fileMenuOpen]);

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

  // 同步描述生成要求
  useEffect(() => {
    if (currentProject) {
      setDescRequirements(currentProject.description_requirements || '');
      setIsDescReqDirty(false);
    }
  }, [currentProject?.id]);

  // Debounced auto-save for description requirements
  useEffect(() => {
    if (!isDescReqDirty || !projectId) return;
    const timer = setTimeout(async () => {
      try {
        await updateProject(projectId, { description_requirements: descRequirements });
        setIsDescReqDirty(false);
      } catch (e) {
        console.error('保存描述要求失败:', e);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [descRequirements, isDescReqDirty, projectId]);

  const insertAtReqCursor = useCallback((markdown: string) => {
    reqTextareaRef.current?.insertAtCursor(markdown);
  }, []);

  const { handlePaste: handleReqImagePaste, handleFiles: handleReqImageFiles } = useImagePaste({
    projectId: projectId || null,
    setContent: (updater) => {
      setDescRequirements(updater);
      setIsDescReqDirty(true);
    },
    showToast: show,
    insertAtCursor: insertAtReqCursor,
  });

  const handleGenerateAll = async () => {
    const hasDescriptions = currentProject?.pages.some(
      (p) => p.description_content
    );
    
    const executeGenerate = async () => {
      await generateDescriptions(detailLevel);
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
          await generatePageDescription(pageId, detailLevel);
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
      await Promise.all(parsed.map(({ title, points, text: desc, part, extra_fields }, i) =>
        addPage(projectId, {
          outline_content: { title, points },
          description_content: desc ? { text: desc, ...(extra_fields ? { extra_fields } : {}) } : undefined,
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
  const missingDescCount = currentProject.pages.filter(p => !p.description_content).length;

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
              title={!hasAllDescriptions && !isRenovationProcessing ? t('detail.disabledNextTip', { count: missingDescCount }) : undefined}
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

            {/* 描述设置面板 */}
            <div className="relative" ref={settingsRef}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSettingsOpen(!settingsOpen)}
                icon={<Settings2 size={16} />}
                title={t('detail.descSettings')}
              />
              {settingsOpen && (
                <div className="absolute top-full left-0 mt-1 z-50 w-72 rounded-lg border border-gray-200 dark:border-border-primary bg-white dark:bg-background-secondary shadow-lg dark:shadow-none p-4 space-y-4">
                  {/* 生成模式 */}
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-foreground-tertiary mb-1.5">
                      {t('detail.generationMode')}
                      <span className="relative group">
                        <HelpCircle size={12} className="text-gray-400 cursor-help" />
                        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-52 px-2.5 py-1.5 text-[11px] leading-relaxed text-gray-600 dark:text-foreground-secondary bg-white dark:bg-background-primary border border-gray-200 dark:border-border-primary rounded-md shadow-md opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">{t('detail.generationModeHint')}</span>
                      </span>
                    </label>
                    <div className="flex gap-1">
                      {(['streaming', 'parallel'] as const).map(mode => (
                        <button
                          key={mode}
                          type="button"
                          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                            generationMode === mode
                              ? 'bg-banana-500 text-white'
                              : 'bg-gray-100 dark:bg-background-hover text-gray-600 dark:text-foreground-tertiary hover:bg-gray-200 dark:hover:bg-background-primary'
                          }`}
                          onClick={() => {
                            setGenerationMode(mode);
                            saveSettingsDebounced({ description_generation_mode: mode });
                          }}
                        >
                          {t(`detail.${mode}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 详细程度 — 暂时屏蔽，效果不够理想，始终使用默认值 */}

                  {/* 额外字段 */}
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-foreground-tertiary mb-1.5">
                      {t('detail.extraFields')}
                      <span className="relative group">
                        <HelpCircle size={12} className="text-gray-400 cursor-help" />
                        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-52 px-2.5 py-1.5 text-[11px] leading-relaxed text-gray-600 dark:text-foreground-secondary bg-white dark:bg-background-primary border border-gray-200 dark:border-border-primary rounded-md shadow-md opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">{t('detail.extraFieldsHint')}</span>
                      </span>
                    </label>
                    <DndContext sensors={fieldSensors} collisionDetection={closestCenter} onDragEnd={handleFieldDragEnd}>
                      <SortableContext items={availableFields} strategy={rectSortingStrategy}>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {availableFields.map(name => {
                            const active = extraFieldNames.includes(name);
                            return (
                              <SortableFieldPill
                                key={name}
                                name={name}
                                active={active}
                                removable={!PRESET_EXTRA_FIELDS.has(name)}
                                onToggle={() => {
                                  const next = active
                                    ? extraFieldNames.filter(f => f !== name)
                                    : [...extraFieldNames, name];
                                  setExtraFieldNames(next);
                                  saveSettingsDebounced({ description_extra_fields: next.length > 0 ? next : ['视觉元素', '视觉焦点', '排版布局', '演讲者备注'] });
                                }}
                                inImagePrompt={imagePromptFields.includes(name)}
                                imagePromptTooltip={imagePromptFields.includes(name) ? t('detail.imagePromptOn') : t('detail.imagePromptOff')}
                                onToggleImagePrompt={() => {
                                  const next = imagePromptFields.includes(name)
                                    ? imagePromptFields.filter(f => f !== name)
                                    : [...imagePromptFields, name];
                                  setImagePromptFields(next);
                                  saveSettingsDebounced({ image_prompt_extra_fields: next });
                                }}
                                onRemove={() => {
                                  const nextPool = availableFields.filter(f => f !== name);
                                  setAvailableFields(nextPool);
                                  localStorage.setItem('banana-available-extra-fields', JSON.stringify(nextPool));
                                }}
                              />
                            );
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        className="flex-1 min-w-0 px-2 py-1 text-xs rounded-md border border-gray-200 dark:border-border-primary bg-white dark:bg-background-primary text-gray-700 dark:text-foreground-secondary focus:outline-none focus:ring-1 focus:ring-banana-500/30"
                        placeholder={t('detail.addField')}
                        value={newFieldName}
                        onChange={e => setNewFieldName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && newFieldName.trim()) {
                            e.preventDefault();
                            const trimmed = newFieldName.trim();
                            if (!availableFields.includes(trimmed) && availableFields.length < 10) {
                              const nextPool = [...availableFields, trimmed];
                              setAvailableFields(nextPool);
                              localStorage.setItem('banana-available-extra-fields', JSON.stringify(nextPool));
                              // 新增字段默认勾选
                              const nextActive = [...extraFieldNames, trimmed];
                              setExtraFieldNames(nextActive);
                              saveSettingsDebounced({ description_extra_fields: nextActive });
                              setNewFieldName('');
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="p-1 rounded-md text-gray-400 hover:text-banana-500 hover:bg-gray-100 dark:hover:bg-background-hover transition-colors disabled:opacity-40"
                        disabled={!newFieldName.trim() || availableFields.includes(newFieldName.trim()) || availableFields.length >= 10}
                        onClick={() => {
                          const trimmed = newFieldName.trim();
                          if (trimmed && !availableFields.includes(trimmed) && availableFields.length < 10) {
                            const nextPool = [...availableFields, trimmed];
                            setAvailableFields(nextPool);
                            localStorage.setItem('banana-available-extra-fields', JSON.stringify(nextPool));
                            const nextActive = [...extraFieldNames, trimmed];
                            setExtraFieldNames(nextActive);
                            saveSettingsDebounced({ description_extra_fields: nextActive });
                            setNewFieldName('');
                          }
                        }}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="w-px h-6 bg-gray-200 dark:bg-border-primary flex-shrink-0" />
            {/* 导入导出下拉菜单 */}
            <div className="relative" ref={fileMenuRef}>
              <Button
                variant="secondary"
                onClick={() => setFileMenuOpen(!fileMenuOpen)}
                icon={<FileText size={16} className="md:w-[18px] md:h-[18px]" />}
                className="text-sm md:text-base"
              >
                {t('detail.importExport')}
                <ChevronDown size={14} className={`ml-1 transition-transform duration-200 ${fileMenuOpen ? 'rotate-180' : ''}`} />
              </Button>
              {fileMenuOpen && (
                <div className="absolute top-full right-0 mt-1 z-50 min-w-[160px] rounded-lg border border-gray-200 dark:border-border-primary bg-white dark:bg-background-secondary shadow-lg dark:shadow-none overflow-hidden">
                  <button
                    type="button"
                    onClick={() => { handleExportDescriptions(); setFileMenuOpen(false); }}
                    disabled={!currentProject.pages.some(p => p.description_content)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 dark:text-foreground-tertiary hover:bg-gray-50 dark:hover:bg-background-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
                  >
                    <Download size={14} />
                    {t('detail.export')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleExportFull(); setFileMenuOpen(false); }}
                    disabled={!currentProject.pages.some(p => p.description_content)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 dark:text-foreground-tertiary hover:bg-gray-50 dark:hover:bg-background-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
                  >
                    <Download size={14} />
                    {t('detail.exportFull')}
                  </button>
                  <div className="border-t border-gray-100 dark:border-border-primary" />
                  <button
                    type="button"
                    onClick={() => { importFileRef.current?.click(); setFileMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 dark:text-foreground-tertiary hover:bg-gray-50 dark:hover:bg-background-hover transition-colors duration-150"
                  >
                    <Upload size={14} />
                    {t('detail.import')}
                  </button>
                </div>
              )}
            </div>
            <input ref={importFileRef} type="file" accept=".md,.txt" className="hidden" onChange={handleImportDescriptions} />
            <span className="text-xs md:text-sm text-gray-500 dark:text-foreground-tertiary whitespace-nowrap">
              {currentProject.pages.filter((p) => p.description_content).length} /{' '}
              {currentProject.pages.length} {t('detail.pagesCompleted')}
            </span>
          </div>
        </div>
        )}
      </div>

      {/* 描述生成要求 - 可折叠 */}
      <div className="bg-white dark:bg-background-secondary border-b border-gray-200 dark:border-border-primary flex-shrink-0">
        <button
          type="button"
          data-testid="desc-requirements-toggle"
          onClick={() => { const next = !isDescReqOpen; setIsDescReqOpen(next); localStorage.setItem('descReqOpen', String(next)); }}
          className="w-full px-3 md:px-6 py-2 flex items-center gap-2 text-xs text-gray-500 dark:text-foreground-tertiary hover:text-gray-700 dark:hover:text-foreground-secondary hover:bg-gray-50 dark:hover:bg-background-hover transition-colors"
        >
          <Settings2 size={12} className="flex-shrink-0" />
          <span className="font-medium">{t('detail.descRequirements')}</span>
          {descRequirements && !isDescReqOpen && (
            <span className="w-1.5 h-1.5 rounded-full bg-banana-400 flex-shrink-0" />
          )}
          <ChevronDown
            size={12}
            className={`ml-auto transition-transform duration-200 ${isDescReqOpen ? 'rotate-180' : ''}`}
          />
        </button>
        <div
          className={`transition-all duration-200 ease-in-out ${isDescReqOpen ? 'overflow-visible' : 'overflow-hidden'}`}
          style={{ maxHeight: isDescReqOpen ? '600px' : '0px' }}
        >
          <div className="px-3 md:px-6 pb-3">
            <div data-testid="desc-requirements-textarea">
              <MarkdownTextarea
                ref={reqTextareaRef}
                value={descRequirements}
                onChange={(val) => { setDescRequirements(val); setIsDescReqDirty(true); }}
                onPaste={handleReqImagePaste}
                onFiles={handleReqImageFiles}
                onSelectFromLibrary={() => setIsMaterialSelectorOpen(true)}
                placeholder={t('detail.descRequirementsPlaceholder')}
                className="ring-inset"
                rows={2}
                showImagePreview={false}
              />
            </div>
            <PresetCapsules
              type="description"
              onAppend={(text) => {
                setDescRequirements((prev) => prev ? `${prev}\n${text}` : text);
                setIsDescReqDirty(true);
              }}
            />
          </div>
        </div>
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
                    page={{ id: `skeleton-${index}`, title: '', sort_order: index, status: 'GENERATING_DESCRIPTION' } as any}
                    index={index}
                    projectId={currentProject.id}
                    extraFieldNames={extraFieldNames}
                    imagePromptFields={imagePromptFields}
                    showToast={show}
                    onUpdate={() => {}}
                    onRegenerate={() => {}}
                  />
                ))
              ) : (
                currentProject.pages.map((page, index) => {
                const pageId = page.id || page.page_id;
                // Renovation processing: treat pages without description as generating
                const hasDescription = page.description_content && (
                  (typeof page.description_content === 'object' && 'text' in page.description_content && page.description_content.text?.trim())
                );
                const effectivePage = (isRenovationProcessing && !hasDescription)
                  ? { ...page, status: 'GENERATING_DESCRIPTION' as const }
                  : page;
                return (
                  <DescriptionCard
                    key={pageId}
                    page={effectivePage}
                    index={index}
                    projectId={currentProject.id}
                    extraFieldNames={extraFieldNames}
                    imagePromptFields={imagePromptFields}
                    showToast={show}
                    onUpdate={(data) => updatePageLocal(pageId, data)}
                    onRegenerate={() => stableHandleRegeneratePage(pageId)}
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
      <MaterialSelector
        projectId={projectId}
        isOpen={isMaterialSelectorOpen}
        onClose={() => setIsMaterialSelectorOpen(false)}
        onSelect={handleMaterialSelect}
        multiple
      />
    </div>
  );
};

