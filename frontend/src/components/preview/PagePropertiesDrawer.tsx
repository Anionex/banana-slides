import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronDown,
  FileText,
  ImageOff,
  Info,
  Layers,
  LayoutTemplate,
  Loader2,
  Mic,
  PanelRightClose,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/utils';
import { useT } from '@/hooks/useT';
import { useTranslation } from 'react-i18next';
import { useImagePaste, buildMaterialsMarkdown } from '@/hooks/useImagePaste';
import { StatusBadge, MaterialSelector } from '@/components/shared';
import { MarkdownTextarea, type MarkdownTextareaRef } from '@/components/shared/MarkdownTextarea';
import { TemplatePickerModal } from '@/components/template/TemplatePickerModal';
import { getImageUrl } from '@/api/client';
import type { DescriptionContent, Material, Page, TemplateAsset } from '@/types';

const drawerI18n = {
  zh: {
    props: {
      title: '页面属性',
      close: '收起属性面板',
      open: '展开页面属性',
      resize: '拖动调整面板宽度',
      saving: '保存中',
      saved: '已保存',
      section: { content: '内容', template: '模板', meta: '信息' },
      pageTitle: '标题',
      pageTitlePlaceholder: '输入页面标题',
      part: '所属章节',
      partPlaceholder: '未分组',
      description: '页面描述',
      descriptionPlaceholder: '输入页面描述, 可包含页面文字、素材、排版设计等信息，支持粘贴图片',
      notInImagePrompt: '不影响图片生成',
      narration: '旁白讲稿',
      narrationHint: '导出讲解视频时朗读，留空则由导出流程自动生成',
      narrationPlaceholder: '还没有讲稿，可在此撰写',
      templateChange: '更换',
      templateLabel: '模板图片',
      templateStyle: '模板提示词',
      templateStylePlaceholder: '用文字描述这一页想要的版式与风格',
      templateNone: '跟随项目模板',
      templateAuto: 'AI 自动匹配',
      templateManual: '手动指定',
      templateBatch: '批量应用',
      templateSetup: '批量配置模板',
      pageIndex: '页码',
      pageIndexValue: '第 {{index}} / {{total}} 页',
      versions: '图片版本',
      versionsValue: '{{count}} 个',
      updatedAt: '更新时间',
      createdAt: '创建时间',
      emptyTitle: '没有选中的页面',
      emptyHint: '在左侧选择一页后即可查看并修改它的属性',
      templateSaveFailed: '模板保存失败',
      templateChanged: '已更换这一页的模板',
    },
  },
  en: {
    props: {
      title: 'Page Properties',
      close: 'Collapse properties panel',
      open: 'Show page properties',
      resize: 'Drag to resize the panel',
      saving: 'Saving',
      saved: 'Saved',
      section: { content: 'Content', template: 'Template', meta: 'Info' },
      pageTitle: 'Title',
      pageTitlePlaceholder: 'Enter page title',
      part: 'Section',
      partPlaceholder: 'Ungrouped',
      description: 'Description',
      descriptionPlaceholder:
        'Enter page description — page text, materials, layout notes; you can paste images',
      notInImagePrompt: 'Not used in image generation',
      narration: 'Narration script',
      narrationHint:
        'Read aloud when exporting a narration video; leave empty and the export generates one',
      narrationPlaceholder: 'No script yet — write one here',
      templateChange: 'Change',
      templateLabel: 'Template image',
      templateStyle: 'Template prompt',
      templateStylePlaceholder: 'Describe the layout and style you want for this page',
      templateNone: 'Inherits project template',
      templateAuto: 'AI matched',
      templateManual: 'Manually set',
      templateBatch: 'Batch applied',
      templateSetup: 'Bulk template setup',
      pageIndex: 'Position',
      pageIndexValue: 'Page {{index}} of {{total}}',
      versions: 'Image versions',
      versionsValue: '{{count}}',
      updatedAt: 'Updated',
      createdAt: 'Created',
      emptyTitle: 'No page selected',
      emptyHint: 'Pick a slide on the left to view and edit its properties',
      templateSaveFailed: 'Could not save the template',
      templateChanged: 'Template changed for this page',
    },
  },
};

export const DRAWER_MIN_WIDTH = 300;
export const DRAWER_MAX_WIDTH = 640;
export const DRAWER_DEFAULT_WIDTH = 380;
const WIDTH_STORAGE_KEY = 'previewDrawer.width';
/** Room the thumbnail rail (320) plus the slide itself need to stay usable. */
const RESERVED_WIDTH = 800;
const clampWidth = (width: number, viewportWidth: number) => {
  const max = Math.min(DRAWER_MAX_WIDTH, Math.max(DRAWER_MIN_WIDTH, viewportWidth - RESERVED_WIDTH));
  return Math.round(Math.min(max, Math.max(DRAWER_MIN_WIDTH, width)));
};

export const readStoredDrawerWidth = (): number => {
  const stored = Number(localStorage.getItem(WIDTH_STORAGE_KEY));
  return Number.isFinite(stored) && stored > 0 ? stored : DRAWER_DEFAULT_WIDTH;
};

/** Pull plain text out of either shape of DescriptionContent. */
export const getDescriptionText = (description?: DescriptionContent | null): string => {
  if (!description) return '';
  if ('text' in description && typeof description.text === 'string') return description.text;
  if ('text_content' in description && Array.isArray(description.text_content)) {
    return description.text_content.join('\n');
  }
  return '';
};

/**
 * Extra fields, with the same legacy layout_suggestion fallback DescriptionCard
 * uses. description_content is a JSON blob and layout_suggestion has no writer
 * left in the backend, so old rows can carry values that were never strings —
 * coerce here, at the one entry point, so neither the editors nor the save path
 * has to guard again.
 */
export const getExtraFields = (description?: DescriptionContent | null): Record<string, string> => {
  const toText = (value: unknown) => (typeof value === 'string' ? value : String(value ?? ''));
  const normalize = (fields: Record<string, unknown>): Record<string, string> =>
    Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, toText(value)]));

  if (!description) return {};
  if (description.extra_fields) return normalize(description.extra_fields);
  if (description.layout_suggestion) return { 排版建议: toText(description.layout_suggestion) };
  return {};
};

/** Rebuild DescriptionContent the way DescriptionCard's save does, so both agree. */
const buildDescriptionContent = (
  text: string,
  fields: Record<string, string>
): DescriptionContent => {
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value.trim()) filtered[key] = value;
  }
  return {
    text,
    ...(Object.keys(filtered).length > 0 ? { extra_fields: filtered } : {}),
  } as DescriptionContent;
};

const formatTimestamp = (value?: string, locale?: string) => {
  if (!value) return '—';
  // Page timestamps come back without a trailing Z, so treat naive values as UTC.
  const normalized = /[Z+]|-\d{2}:\d{2}$/.test(value) ? value : `${value}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({
  icon,
  title,
  children,
}) => (
  <section className="space-y-3">
    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-foreground-tertiary">
      {icon}
      <span>{title}</span>
    </div>
    {children}
  </section>
);

const MetaRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center justify-between gap-3 py-1.5 text-xs">
    <span className="text-gray-500 dark:text-foreground-tertiary">{label}</span>
    <span className="text-right font-medium text-gray-700 dark:text-foreground-secondary">
      {children}
    </span>
  </div>
);

const textInputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus:border-banana-400 focus:outline-none focus:ring-2 focus:ring-banana-500/30 dark:border-border-primary dark:bg-background-secondary dark:text-foreground-primary dark:placeholder:text-foreground-tertiary';

interface PagePropertiesDrawerProps {
  page?: Page;
  projectId?: string;
  pageIndex: number;
  pageCount: number;
  versionCount: number;
  templateMode?: 'single' | 'multi';
  templateAssets?: TemplateAsset[];
  /** Active description extra-field names from settings (the list DetailEditor uses). */
  extraFieldNames?: string[];
  /** Subset of extra fields that feed the image prompt; others get a muted marker. */
  imagePromptFields?: string[];
  isOpen: boolean;
  isSaving: boolean;
  width: number;
  onWidthChange: (width: number) => void;
  onOpen: () => void;
  onClose: () => void;
  onUpdate: (pageId: string, data: Partial<Page>) => void;
  onUpdatePageTemplate?: (
    pageId: string,
    patch: { template_asset_id?: string | null; template_style_text?: string | null }
  ) => Promise<void>;
  onUploadTemplateAsset?: (file: File) => Promise<TemplateAsset>;
  onOpenTemplateSetup: () => void;
  showToast: (props: { message: string; type: 'success' | 'error' | 'info' | 'warning' }) => void;
}

export const PagePropertiesDrawer: React.FC<PagePropertiesDrawerProps> = ({
  page,
  projectId,
  pageIndex,
  pageCount,
  versionCount,
  templateMode,
  templateAssets = [],
  extraFieldNames = [],
  imagePromptFields,
  isOpen,
  isSaving,
  width,
  onWidthChange,
  onOpen,
  onClose,
  onUpdate,
  onUpdatePageTemplate,
  onUploadTemplateAsset,
  onOpenTemplateSetup,
  showToast,
}) => {
  const t = useT(drawerI18n);
  const { i18n } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isNarrationOpen, setIsNarrationOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isMaterialSelectorOpen, setIsMaterialSelectorOpen] = useState(false);
  const wasSavingRef = useRef(false);

  // A closed drawer must not leave inputs in the DOM, but unmounting them the
  // instant it closes would blank the panel mid-collapse — so trail the
  // width transition by one beat.
  const [renderBody, setRenderBody] = useState(isOpen);
  useEffect(() => {
    if (isOpen) {
      setRenderBody(true);
      return;
    }
    const timer = setTimeout(() => setRenderBody(false), 300);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const pageId = page?.id;
  const [title, setTitle] = useState('');
  const [part, setPart] = useState('');
  const [description, setDescription] = useState('');
  const [extraFields, setExtraFields] = useState<Record<string, string>>({});
  const [narration, setNarration] = useState('');
  const [templateStyle, setTemplateStyle] = useState('');

  const serverTitle = page?.outline_content?.title ?? '';
  const serverPart = page?.part ?? '';
  const serverDescription = getDescriptionText(page?.description_content);
  const serverExtraFields = getExtraFields(page?.description_content);
  const serverExtraFieldsKey = JSON.stringify(serverExtraFields);
  const serverNarration = page?.narration_text ?? '';
  const serverTemplateStyle = page?.template_style_text ?? '';

  // Async image uploads write back while unfocused, so the current drafts have
  // to be readable outside of React state closures. Sync from an effect rather
  // than during render — the update handlers below also write these refs
  // straight after deriving the next value, so a same-tick chain of uploads
  // still accumulates without waiting for the commit.
  const extraFieldsRef = useRef(extraFields);
  const descriptionValueRef = useRef(description);
  useEffect(() => {
    extraFieldsRef.current = extraFields;
  }, [extraFields]);
  useEffect(() => {
    descriptionValueRef.current = description;
  }, [description]);

  // The drawer is not the only way to change a page — the edit modal and AI
  // regeneration write to the same fields — so drafts have to follow the store.
  // But a background syncProject() can land mid-typing carrying values older
  // than the not-yet-flushed edit, so only adopt when nothing is in flight:
  // no focused field, no queued save. A page switch always re-seeds.
  const seededPageIdRef = useRef<string | undefined>(undefined);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const settled = focusedField === null && !isSaving;

  useEffect(() => {
    if (pageId === seededPageIdRef.current && !settled) return;
    seededPageIdRef.current = pageId;
    setTitle(serverTitle);
    setPart(serverPart);
    setDescription(serverDescription);
    setExtraFields(JSON.parse(serverExtraFieldsKey));
    setNarration(serverNarration);
    setTemplateStyle(serverTemplateStyle);
  }, [
    pageId,
    settled,
    serverTitle,
    serverPart,
    serverDescription,
    serverExtraFieldsKey,
    serverNarration,
    serverTemplateStyle,
  ]);

  const busy = isSaving || isSavingTemplate;
  // Surface "已保存" for a moment once the queue drains.
  useEffect(() => {
    if (busy) {
      wasSavingRef.current = true;
      setShowSaved(false);
      return;
    }
    if (!wasSavingRef.current) return;
    wasSavingRef.current = false;
    setShowSaved(true);
    const timer = setTimeout(() => setShowSaved(false), 2200);
    return () => clearTimeout(timer);
  }, [busy]);

  const focusProps = (field: string) => ({
    onFocus: () => setFocusedField(field),
    onBlur: () => setFocusedField((current) => (current === field ? null : current)),
  });

  // ---- description: main text + settings-driven extra fields ----
  const descriptionRef = useRef<MarkdownTextareaRef>(null);
  const extraFieldRefs = useRef<Record<string, MarkdownTextareaRef | null>>({});
  // One paste hook serves every field; these refs re-point it on focus.
  const activeSetContent = useRef<(updater: (prev: string) => string) => void>(() => {});
  const activeInsertAtCursor = useRef<((markdown: string) => void) | undefined>(undefined);

  const commitDescription = useCallback(
    (text: string, fields: Record<string, string>) => {
      if (!pageId) return;
      onUpdate(pageId, { description_content: buildDescriptionContent(text, fields) });
    },
    [pageId, onUpdate]
  );

  // Derive the next value from the refs rather than inside a state updater —
  // updaters must stay pure (StrictMode calls them twice).
  const updateDescription = useCallback(
    (updater: (prev: string) => string) => {
      const next = updater(descriptionValueRef.current);
      descriptionValueRef.current = next;
      setDescription(next);
      commitDescription(next, extraFieldsRef.current);
    },
    [commitDescription]
  );

  const updateExtraField = useCallback(
    (name: string, updater: (prev: string) => string) => {
      const previous = extraFieldsRef.current;
      const next = { ...previous, [name]: updater(previous[name] || '') };
      extraFieldsRef.current = next;
      setExtraFields(next);
      commitDescription(descriptionValueRef.current, next);
    },
    [commitDescription]
  );

  const { handlePaste, handleFiles } = useImagePaste({
    projectId,
    setContent: (updater) => activeSetContent.current(updater),
    showToast,
    insertAtCursor: (md) => activeInsertAtCursor.current?.(md),
  });

  const focusMainDescription = useCallback(() => {
    activeSetContent.current = updateDescription;
    activeInsertAtCursor.current = (md: string) => descriptionRef.current?.insertAtCursor(md);
  }, [updateDescription]);

  const focusExtraField = useCallback(
    (name: string) => {
      activeSetContent.current = (updater) => updateExtraField(name, updater);
      activeInsertAtCursor.current = (md: string) =>
        extraFieldRefs.current[name]?.insertAtCursor(md);
    },
    [updateExtraField]
  );

  const handleMaterialSelect = useCallback((materials: Material[]) => {
    const markdown = buildMaterialsMarkdown(materials, (updater) =>
      activeSetContent.current(updater)
    );
    activeInsertAtCursor.current?.(markdown + '\n');
  }, []);

  // Settings order first, then fields already on the page that settings dropped.
  const allFieldNames = [...new Set([...extraFieldNames, ...Object.keys(serverExtraFields)])];

  // ---- per-page template ----
  const templateAsset = page?.template_asset_id
    ? templateAssets.find((asset) => asset.id === page.template_asset_id)
    : undefined;
  const sourceLabel =
    page?.template_selection_source === 'auto'
      ? t('props.templateAuto')
      : page?.template_selection_source === 'batch_apply'
      ? t('props.templateBatch')
      : page?.template_selection_source === 'manual'
      ? t('props.templateManual')
      : '';

  const styleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingStyleRef = useRef<{ pageId: string; value: string } | null>(null);

  // The flush below runs from an effect that must only re-fire on a page
  // switch, but `t` and `showToast` are fresh references on every render — so
  // reach the writer through a ref instead of an effect dependency, otherwise
  // the effect would re-run each render and cancel the debounce it is meant to
  // protect.
  const writeTemplateStyleRef = useRef<(pageId: string, value: string) => void>(() => {});
  useEffect(() => {
    writeTemplateStyleRef.current = (targetPageId, value) => {
      if (!onUpdatePageTemplate) return;
      onUpdatePageTemplate(targetPageId, { template_style_text: value.trim() || null })
        .catch(() => showToast({ message: t('props.templateSaveFailed'), type: 'error' }))
        .finally(() => setIsSavingTemplate(false));
    };
  });

  const flushTemplateStyle = useCallback(() => {
    if (styleTimerRef.current) {
      clearTimeout(styleTimerRef.current);
      styleTimerRef.current = null;
    }
    const pending = pendingStyleRef.current;
    if (!pending) return;
    pendingStyleRef.current = null;
    writeTemplateStyleRef.current(pending.pageId, pending.value);
  }, []);

  // Switching pages or unmounting used to just clearTimeout, silently dropping
  // a prompt edited within the last 800ms. Send it instead — the pending entry
  // carries its own pageId, so it still lands on the page it was typed on.
  useEffect(() => () => flushTemplateStyle(), [pageId, flushTemplateStyle]);

  const saveTemplateStyle = useCallback(
    (value: string) => {
      if (!pageId || !onUpdatePageTemplate) return;
      if (styleTimerRef.current) clearTimeout(styleTimerRef.current);
      setIsSavingTemplate(true);
      pendingStyleRef.current = { pageId, value };
      styleTimerRef.current = setTimeout(() => {
        styleTimerRef.current = null;
        const pending = pendingStyleRef.current;
        pendingStyleRef.current = null;
        if (pending) writeTemplateStyleRef.current(pending.pageId, pending.value);
      }, 800);
    },
    [pageId, onUpdatePageTemplate]
  );

  const handlePickTemplate = useCallback(
    async (assetId: string | null) => {
      if (!pageId || !onUpdatePageTemplate) return;
      setIsSavingTemplate(true);
      try {
        await onUpdatePageTemplate(pageId, { template_asset_id: assetId });
        showToast({ message: t('props.templateChanged'), type: 'success' });
      } catch {
        showToast({ message: t('props.templateSaveFailed'), type: 'error' });
      } finally {
        setIsSavingTemplate(false);
      }
    },
    [pageId, onUpdatePageTemplate, showToast, t]
  );

  // ---- resizing ----
  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
  };

  const handleResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    onWidthChange(clampWidth(window.innerWidth - e.clientX, window.innerWidth));
  };

  const handleResizeEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);
  };

  const handleResizeKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 48 : 16;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onWidthChange(clampWidth(width + step, window.innerWidth));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onWidthChange(clampWidth(width - step, window.innerWidth));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onWidthChange(clampWidth(DRAWER_MAX_WIDTH, window.innerWidth));
    } else if (e.key === 'End') {
      e.preventDefault();
      onWidthChange(DRAWER_MIN_WIDTH);
    }
  };

  return (
    <>
      {/* Edge grip — the panel's own, permanent way back open. */}
      {!isOpen && (
        <button
          type="button"
          data-testid="toggle-page-properties"
          onClick={onOpen}
          aria-label={t('props.open')}
          title={t('props.open')}
          className="group fixed right-0 top-1/2 z-30 flex h-24 -translate-y-1/2 items-center rounded-l-lg border border-r-0 border-gray-200 bg-white/95 px-0.5 shadow-md backdrop-blur transition-colors hover:bg-banana-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-banana-500 dark:border-border-primary dark:bg-background-secondary/95 dark:hover:bg-background-hover"
        >
          <ChevronLeft
            size={16}
            className="text-gray-400 transition-colors group-hover:text-banana-600 dark:text-foreground-tertiary dark:group-hover:text-banana-300"
          />
        </button>
      )}

      {/* Mobile scrim — the panel floats above the preview on narrow screens. */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[1px] md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        data-testid="page-properties-drawer"
        aria-label={t('props.title')}
        aria-hidden={!isOpen}
        style={{ width: isOpen ? width : 0 }}
        className={cn(
          'z-40 flex min-h-0 flex-shrink-0 flex-col overflow-hidden border-gray-200 bg-white dark:border-border-primary dark:bg-background-secondary',
          'fixed inset-y-0 right-0 max-w-[88vw] shadow-2xl md:relative md:max-w-none md:shadow-none',
          !isDragging && 'transition-[width] duration-300 ease-out',
          // 收起时不能留下 1px 边框，否则预览区右侧会有一条竖线
          isOpen ? 'md:border-l' : 'pointer-events-none'
        )}
      >
        {renderBody && (
          <>
            {/* Resize handle (desktop only) */}
            <div
              data-testid="drawer-resize-handle"
              role="separator"
              aria-orientation="vertical"
              aria-label={t('props.resize')}
              aria-valuenow={width}
              aria-valuemin={DRAWER_MIN_WIDTH}
              aria-valuemax={DRAWER_MAX_WIDTH}
              tabIndex={isOpen ? 0 : -1}
              onPointerDown={handleResizeStart}
              onPointerMove={handleResizeMove}
              onPointerUp={handleResizeEnd}
              onPointerCancel={handleResizeEnd}
              onDoubleClick={() => onWidthChange(DRAWER_DEFAULT_WIDTH)}
              onKeyDown={handleResizeKeyDown}
              className="group absolute inset-y-0 left-0 z-10 hidden w-1.5 cursor-col-resize focus:outline-none md:block"
            >
              <div
                className={cn(
                  'absolute inset-y-0 left-0 w-0.5 transition-colors duration-150',
                  'group-hover:bg-banana-400 group-focus-visible:bg-banana-500',
                  isDragging ? 'bg-banana-500' : 'bg-transparent'
                )}
              />
            </div>

            {/* Header */}
            <header className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 dark:border-border-primary">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="truncate text-sm font-semibold text-gray-900 dark:text-foreground-primary">
                  {t('props.title')}
                </h2>
                {page && (
                  <span className="flex-shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-gray-500 dark:bg-background-hover dark:text-foreground-tertiary">
                    {pageIndex + 1}/{pageCount}
                  </span>
                )}
              </div>
              <div className="flex flex-shrink-0 items-center gap-1">
                <span
                  data-testid="drawer-save-state"
                  className={cn(
                    'flex items-center gap-1 text-[11px] transition-opacity duration-200',
                    busy || showSaved ? 'opacity-100' : 'opacity-0'
                  )}
                >
                  {busy ? (
                    <>
                      <Loader2 size={11} className="animate-spin text-gray-400" />
                      <span className="text-gray-400 dark:text-foreground-tertiary">
                        {t('props.saving')}
                      </span>
                    </>
                  ) : (
                    <>
                      <Check size={11} className="text-green-500" />
                      <span className="text-green-600 dark:text-green-400">{t('props.saved')}</span>
                    </>
                  )}
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t('props.close')}
                  title={t('props.close')}
                  className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-banana-500 dark:text-foreground-tertiary dark:hover:bg-background-hover dark:hover:text-foreground-primary"
                >
                  <PanelRightClose size={16} />
                </button>
              </div>
            </header>

            {/* Body */}
            {!page ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
                <Layers
                  size={32}
                  className="text-gray-300 dark:text-foreground-tertiary"
                  strokeWidth={1.5}
                />
                <p className="text-sm font-medium text-gray-600 dark:text-foreground-secondary">
                  {t('props.emptyTitle')}
                </p>
                <p className="text-xs text-gray-400 dark:text-foreground-tertiary">
                  {t('props.emptyHint')}
                </p>
              </div>
            ) : (
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4">
                <div className="flex items-center gap-2">
                  <StatusBadge status={page.status} />
                </div>

                <Section icon={<FileText size={11} />} title={t('props.section.content')}>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600 dark:text-foreground-secondary">
                      {t('props.pageTitle')}
                    </label>
                    <input
                      data-testid="drawer-title-input"
                      {...focusProps('title')}
                      type="text"
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        if (pageId) {
                          onUpdate(pageId, {
                            // Points belong to the outline stage — carry them through untouched.
                            outline_content: {
                              title: e.target.value,
                              points: page.outline_content?.points ?? [],
                            },
                          });
                        }
                      }}
                      placeholder={t('props.pageTitlePlaceholder')}
                      className={cn(textInputClass, 'font-medium')}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600 dark:text-foreground-secondary">
                      {t('props.part')}
                    </label>
                    <input
                      data-testid="drawer-part-input"
                      {...focusProps('part')}
                      type="text"
                      value={part}
                      onChange={(e) => {
                        setPart(e.target.value);
                        if (pageId) onUpdate(pageId, { part: e.target.value });
                      }}
                      placeholder={t('props.partPlaceholder')}
                      className={textInputClass}
                    />
                  </div>

                  <div data-testid="drawer-description-field">
                    <MarkdownTextarea
                      ref={descriptionRef}
                      label={t('props.description')}
                      value={description}
                      onChange={(value) => updateDescription(() => value)}
                      onPaste={handlePaste}
                      onFiles={handleFiles}
                      onSelectFromLibrary={() => setIsMaterialSelectorOpen(true)}
                      onFocus={() => {
                        focusMainDescription();
                        setFocusedField('description');
                      }}
                      onBlur={() =>
                        setFocusedField((current) => (current === 'description' ? null : current))
                      }
                      rows={6}
                      placeholder={t('props.descriptionPlaceholder')}
                    />
                  </div>

                  {allFieldNames.map((name) => {
                    const notInImagePrompt = imagePromptFields && !imagePromptFields.includes(name);
                    return (
                      <div key={name} data-testid={`drawer-extra-field-${name}`}>
                        <MarkdownTextarea
                          ref={(el) => {
                            extraFieldRefs.current[name] = el;
                          }}
                          label={name}
                          toolbarLeft={
                            notInImagePrompt ? (
                              <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-foreground-tertiary">
                                <ImageOff size={11} />
                                {t('props.notInImagePrompt')}
                              </span>
                            ) : undefined
                          }
                          value={extraFields[name] || ''}
                          onChange={(value) => updateExtraField(name, () => value)}
                          onPaste={handlePaste}
                          onFiles={handleFiles}
                          onFocus={() => {
                            focusExtraField(name);
                            setFocusedField(`extra:${name}`);
                          }}
                          onBlur={() =>
                            setFocusedField((current) =>
                              current === `extra:${name}` ? null : current
                            )
                          }
                          showUploadButton={false}
                          rows={2}
                          placeholder={name}
                        />
                      </div>
                    );
                  })}
                </Section>

                {templateMode === 'multi' && (
                  <Section icon={<LayoutTemplate size={11} />} title={t('props.section.template')}>
                    <div className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-border-primary">
                      <div className="flex items-center gap-3">
                        {templateAsset ? (
                          <img
                            src={getImageUrl(templateAsset.thumb_url || templateAsset.image_url)}
                            alt=""
                            className="h-10 w-16 flex-shrink-0 rounded border border-gray-200 object-cover dark:border-border-primary"
                          />
                        ) : (
                          <div className="flex h-10 w-16 flex-shrink-0 items-center justify-center rounded border border-dashed border-gray-200 text-gray-300 dark:border-border-primary dark:text-foreground-tertiary">
                            <LayoutTemplate size={14} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium text-gray-700 dark:text-foreground-secondary">
                            {templateAsset
                              ? templateAsset.user_label || t('props.templateLabel')
                              : t('props.templateNone')}
                          </div>
                          {templateAsset && sourceLabel && (
                            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-400 dark:text-foreground-tertiary">
                              {page.template_selection_source === 'auto' && <Sparkles size={10} />}
                              {sourceLabel}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          data-testid="drawer-change-template"
                          onClick={() => setIsPickerOpen(true)}
                          className="flex-shrink-0 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:border-banana-400 hover:bg-banana-50 hover:text-banana-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-banana-500 dark:border-border-primary dark:text-foreground-secondary dark:hover:bg-background-hover dark:hover:text-banana-300"
                        >
                          {t('props.templateChange')}
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-600 dark:text-foreground-secondary">
                          {t('props.templateStyle')}
                        </label>
                        <textarea
                          data-testid="drawer-template-style-input"
                          {...focusProps('templateStyle')}
                          value={templateStyle}
                          rows={3}
                          onChange={(e) => {
                            setTemplateStyle(e.target.value);
                            saveTemplateStyle(e.target.value);
                          }}
                          placeholder={t('props.templateStylePlaceholder')}
                          className={cn(textInputClass, 'resize-y text-xs leading-relaxed')}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={onOpenTemplateSetup}
                        className="w-full rounded-md py-1 text-[11px] text-gray-400 transition-colors hover:text-banana-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-banana-500 dark:text-foreground-tertiary dark:hover:text-banana-300"
                      >
                        {t('props.templateSetup')}
                      </button>
                    </div>
                  </Section>
                )}

                <Section icon={<Info size={11} />} title={t('props.section.meta')}>
                  <div className="divide-y divide-gray-100 dark:divide-border-primary">
                    <MetaRow label={t('props.pageIndex')}>
                      {t('props.pageIndexValue', { index: pageIndex + 1, total: pageCount })}
                    </MetaRow>
                    <MetaRow label={t('props.versions')}>
                      {t('props.versionsValue', { count: versionCount })}
                    </MetaRow>
                    <MetaRow label={t('props.createdAt')}>
                      {formatTimestamp(page.created_at, i18n.language)}
                    </MetaRow>
                    <MetaRow label={t('props.updatedAt')}>
                      {formatTimestamp(page.updated_at, i18n.language)}
                    </MetaRow>
                  </div>
                </Section>

                {/* Narration is rarely touched — keep it collapsed, at the bottom. */}
                <div className="border-t border-gray-100 pt-4 dark:border-border-primary">
                  <button
                    type="button"
                    data-testid="drawer-narration-toggle"
                    aria-expanded={isNarrationOpen}
                    onClick={() => setIsNarrationOpen((prev) => !prev)}
                    className="flex w-full items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 transition-colors hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-banana-500 dark:text-foreground-tertiary dark:hover:text-foreground-secondary"
                  >
                    <Mic size={11} />
                    <span>{t('props.narration')}</span>
                    {!isNarrationOpen && narration && (
                      <span
                        data-testid="drawer-narration-dot"
                        className="h-1.5 w-1.5 rounded-full bg-banana-400"
                        aria-hidden="true"
                      />
                    )}
                    <ChevronDown
                      size={12}
                      className={cn('ml-auto transition-transform', isNarrationOpen && 'rotate-180')}
                    />
                  </button>
                  {isNarrationOpen && (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-[11px] leading-relaxed text-gray-400 dark:text-foreground-tertiary">
                        {t('props.narrationHint')}
                      </p>
                      <textarea
                        data-testid="drawer-narration-input"
                        {...focusProps('narration')}
                        value={narration}
                        rows={4}
                        onChange={(e) => {
                          setNarration(e.target.value);
                          if (pageId) onUpdate(pageId, { narration_text: e.target.value });
                        }}
                        placeholder={t('props.narrationPlaceholder')}
                        className={cn(textInputClass, 'resize-y leading-relaxed')}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </aside>

      <TemplatePickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        assets={templateAssets}
        currentAssetId={page?.template_asset_id}
        onSelect={handlePickTemplate}
        onUpload={onUploadTemplateAsset}
      />

      <MaterialSelector
        isOpen={isMaterialSelectorOpen}
        onClose={() => setIsMaterialSelectorOpen(false)}
        onSelect={handleMaterialSelect}
        projectId={projectId}
      />
    </>
  );
};
