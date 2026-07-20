import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Hash,
  Info,
  LayoutTemplate,
  Layers,
  Loader2,
  Mic,
  PanelRightClose,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/utils';
import { useT } from '@/hooks/useT';
import { StatusBadge } from '@/components/shared';
import { getImageUrl } from '@/api/client';
import type { DescriptionContent, Page, TemplateAsset } from '@/types';

const drawerI18n = {
  zh: {
    props: {
      title: '页面属性',
      close: '收起属性面板',
      open: '页面属性',
      resize: '拖动调整面板宽度',
      saving: '保存中',
      saved: '已保存',
      section: { content: '内容', narration: '演讲备注', template: '模板', meta: '信息' },
      pageTitle: '标题',
      pageTitlePlaceholder: '输入页面标题',
      part: '所属章节',
      partPlaceholder: '未分组',
      points: '要点',
      pointsHint: '每行一个',
      pointsPlaceholder: '每行输入一个要点',
      description: '页面描述',
      descriptionHint: '生成图片的依据',
      descriptionPlaceholder: '输入页面的详细描述内容',
      narration: '旁白讲稿',
      narrationHint: '导出讲解视频时朗读的文字',
      narrationPlaceholder: '还没有讲稿，可在此撰写或在导出视频时自动生成',
      templateImage: '模板图片',
      templateStyle: '风格描述',
      templateNone: '跟随项目模板',
      templateAuto: 'AI 自动匹配',
      templateManual: '手动指定',
      templateBatch: '批量应用',
      templateConfigure: '前往模板配置',
      pageIndex: '页码',
      pageIndexValue: '第 {{index}} / {{total}} 页',
      versions: '图片版本',
      versionsValue: '{{count}} 个',
      updatedAt: '更新时间',
      createdAt: '创建时间',
      charCount: '{{count}} 字',
      emptyTitle: '没有选中的页面',
      emptyHint: '在左侧选择一页后即可查看并修改它的属性',
    },
  },
  en: {
    props: {
      title: 'Page Properties',
      close: 'Collapse properties panel',
      open: 'Page properties',
      resize: 'Drag to resize the panel',
      saving: 'Saving',
      saved: 'Saved',
      section: { content: 'Content', narration: 'Speaker Notes', template: 'Template', meta: 'Info' },
      pageTitle: 'Title',
      pageTitlePlaceholder: 'Enter page title',
      part: 'Section',
      partPlaceholder: 'Ungrouped',
      points: 'Key points',
      pointsHint: 'one per line',
      pointsPlaceholder: 'Enter one key point per line',
      description: 'Description',
      descriptionHint: 'drives image generation',
      descriptionPlaceholder: 'Enter the detailed description for this page',
      narration: 'Narration script',
      narrationHint: 'spoken aloud when exporting a narration video',
      narrationPlaceholder: 'No script yet — write one here or let the video export generate it',
      templateImage: 'Template image',
      templateStyle: 'Style description',
      templateNone: 'Inherits project template',
      templateAuto: 'AI matched',
      templateManual: 'Manually set',
      templateBatch: 'Batch applied',
      templateConfigure: 'Open template setup',
      pageIndex: 'Position',
      pageIndexValue: 'Page {{index}} of {{total}}',
      versions: 'Image versions',
      versionsValue: '{{count}}',
      updatedAt: 'Updated',
      createdAt: 'Created',
      charCount: '{{count}} chars',
      emptyTitle: 'No page selected',
      emptyHint: 'Pick a slide on the left to view and edit its properties',
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

/** Rebuild DescriptionContent from edited text, keeping the fields we don't own. */
const buildDescriptionContent = (
  previous: DescriptionContent | undefined,
  text: string
): DescriptionContent => {
  const { extra_fields, layout_suggestion } = (previous ?? {}) as {
    extra_fields?: Record<string, unknown>;
    layout_suggestion?: string;
  };
  return {
    text,
    ...(extra_fields ? { extra_fields } : {}),
    ...(layout_suggestion ? { layout_suggestion } : {}),
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

/** Textarea that grows with its content instead of scrolling inside a fixed box. */
const AutoTextarea: React.FC<
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number; maxHeight?: number }
> = ({ minRows = 3, maxHeight = 320, className, value, ...props }) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [value, maxHeight]);

  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      className={cn(
        'w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm leading-relaxed text-gray-900 transition-colors placeholder:text-gray-400',
        'focus:border-banana-400 focus:outline-none focus:ring-2 focus:ring-banana-500/30',
        'dark:border-border-primary dark:bg-background-secondary dark:text-foreground-primary dark:placeholder:text-foreground-tertiary',
        className
      )}
      {...props}
    />
  );
};

const Field: React.FC<{ label: string; hint?: string; count?: number; children: React.ReactNode }> = ({
  label,
  hint,
  count,
  children,
}) => (
  <div className="space-y-1.5">
    <div className="flex items-baseline justify-between gap-2">
      <label className="text-xs font-medium text-gray-600 dark:text-foreground-secondary">
        {label}
        {hint && (
          <span className="ml-1.5 font-normal text-gray-400 dark:text-foreground-tertiary">{hint}</span>
        )}
      </label>
      {count !== undefined && count > 0 && (
        <span className="text-[11px] tabular-nums text-gray-400 dark:text-foreground-tertiary">{count}</span>
      )}
    </div>
    {children}
  </div>
);

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
    <span className="text-right font-medium text-gray-700 dark:text-foreground-secondary">{children}</span>
  </div>
);

interface PagePropertiesDrawerProps {
  page?: Page;
  pageIndex: number;
  pageCount: number;
  versionCount: number;
  templateMode?: 'single' | 'multi';
  templateAssets?: TemplateAsset[];
  isOpen: boolean;
  isSaving: boolean;
  width: number;
  onWidthChange: (width: number) => void;
  onClose: () => void;
  onUpdate: (pageId: string, data: Partial<Page>) => void;
  onOpenTemplateSetup: () => void;
}

export const PagePropertiesDrawer: React.FC<PagePropertiesDrawerProps> = ({
  page,
  pageIndex,
  pageCount,
  versionCount,
  templateMode,
  templateAssets = [],
  isOpen,
  isSaving,
  width,
  onWidthChange,
  onClose,
  onUpdate,
  onOpenTemplateSetup,
}) => {
  const t = useT(drawerI18n);
  const [isDragging, setIsDragging] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
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
  // Drafts are re-seeded only when the selected page changes, so a background
  // syncProject() can never overwrite what the user is currently typing.
  const [title, setTitle] = useState('');
  const [part, setPart] = useState('');
  const [points, setPoints] = useState('');
  const [description, setDescription] = useState('');
  const [narration, setNarration] = useState('');

  useEffect(() => {
    setTitle(page?.outline_content?.title ?? '');
    setPart(page?.part ?? '');
    setPoints(page?.outline_content?.points?.join('\n') ?? '');
    setDescription(getDescriptionText(page?.description_content));
    setNarration(page?.narration_text ?? '');
  }, [pageId]);

  // Surface "已保存" for a moment once the queue drains.
  useEffect(() => {
    if (isSaving) {
      wasSavingRef.current = true;
      setShowSaved(false);
      return;
    }
    if (!wasSavingRef.current) return;
    wasSavingRef.current = false;
    setShowSaved(true);
    const timer = setTimeout(() => setShowSaved(false), 2200);
    return () => clearTimeout(timer);
  }, [isSaving]);

  const commitOutline = useCallback(
    (nextTitle: string, nextPoints: string) => {
      if (!pageId) return;
      onUpdate(pageId, {
        outline_content: {
          title: nextTitle,
          points: nextPoints.split('\n').filter((p) => p.trim()),
        },
      });
    },
    [pageId, onUpdate]
  );

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

  return (
    <>
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
          className={cn(
            'group absolute inset-y-0 left-0 z-10 hidden w-1.5 cursor-col-resize md:block',
            'focus:outline-none'
          )}
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
                isSaving || showSaved ? 'opacity-100' : 'opacity-0'
              )}
            >
              {isSaving ? (
                <>
                  <Loader2 size={11} className="animate-spin text-gray-400" />
                  <span className="text-gray-400 dark:text-foreground-tertiary">{t('props.saving')}</span>
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
            <Layers size={32} className="text-gray-300 dark:text-foreground-tertiary" strokeWidth={1.5} />
            <p className="text-sm font-medium text-gray-600 dark:text-foreground-secondary">
              {t('props.emptyTitle')}
            </p>
            <p className="text-xs text-gray-400 dark:text-foreground-tertiary">{t('props.emptyHint')}</p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4">
            <div className="flex items-center gap-2">
              <StatusBadge status={page.status} />
            </div>

            <Section icon={<Hash size={11} />} title={t('props.section.content')}>
              <Field label={t('props.pageTitle')}>
                <input
                  data-testid="drawer-title-input"
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    commitOutline(e.target.value, points);
                  }}
                  placeholder={t('props.pageTitlePlaceholder')}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition-colors placeholder:font-normal placeholder:text-gray-400 focus:border-banana-400 focus:outline-none focus:ring-2 focus:ring-banana-500/30 dark:border-border-primary dark:bg-background-secondary dark:text-foreground-primary dark:placeholder:text-foreground-tertiary"
                />
              </Field>

              <Field label={t('props.part')}>
                <input
                  data-testid="drawer-part-input"
                  type="text"
                  value={part}
                  onChange={(e) => {
                    setPart(e.target.value);
                    if (pageId) onUpdate(pageId, { part: e.target.value });
                  }}
                  placeholder={t('props.partPlaceholder')}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus:border-banana-400 focus:outline-none focus:ring-2 focus:ring-banana-500/30 dark:border-border-primary dark:bg-background-secondary dark:text-foreground-primary dark:placeholder:text-foreground-tertiary"
                />
              </Field>

              <Field
                label={t('props.points')}
                hint={t('props.pointsHint')}
                count={points.split('\n').filter((p) => p.trim()).length}
              >
                <AutoTextarea
                  data-testid="drawer-points-input"
                  value={points}
                  onChange={(e) => {
                    setPoints(e.target.value);
                    commitOutline(title, e.target.value);
                  }}
                  placeholder={t('props.pointsPlaceholder')}
                />
              </Field>

              <Field
                label={t('props.description')}
                hint={t('props.descriptionHint')}
                count={description.length}
              >
                <AutoTextarea
                  data-testid="drawer-description-input"
                  minRows={5}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (pageId) {
                      onUpdate(pageId, {
                        description_content: buildDescriptionContent(
                          page.description_content,
                          e.target.value
                        ),
                      });
                    }
                  }}
                  placeholder={t('props.descriptionPlaceholder')}
                />
              </Field>
            </Section>

            <Section icon={<Mic size={11} />} title={t('props.section.narration')}>
              <Field label={t('props.narration')} hint={t('props.narrationHint')} count={narration.length}>
                <AutoTextarea
                  data-testid="drawer-narration-input"
                  minRows={4}
                  value={narration}
                  onChange={(e) => {
                    setNarration(e.target.value);
                    if (pageId) onUpdate(pageId, { narration_text: e.target.value });
                  }}
                  placeholder={t('props.narrationPlaceholder')}
                />
              </Field>
            </Section>

            {templateMode === 'multi' && (
              <Section icon={<LayoutTemplate size={11} />} title={t('props.section.template')}>
                <div className="rounded-lg border border-gray-200 p-3 dark:border-border-primary">
                  {templateAsset ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={getImageUrl(templateAsset.thumb_url || templateAsset.image_url)}
                        alt=""
                        className="h-10 w-16 flex-shrink-0 rounded border border-gray-200 object-cover dark:border-border-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-gray-700 dark:text-foreground-secondary">
                          {templateAsset.user_label || t('props.templateImage')}
                        </div>
                        {sourceLabel && (
                          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-400 dark:text-foreground-tertiary">
                            {page.template_selection_source === 'auto' && <Sparkles size={10} />}
                            {sourceLabel}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : page.template_style_text ? (
                    <div className="space-y-1">
                      <div className="text-[11px] font-medium text-gray-500 dark:text-foreground-tertiary">
                        {t('props.templateStyle')}
                      </div>
                      <p className="line-clamp-3 text-xs leading-relaxed text-gray-600 dark:text-foreground-secondary">
                        {page.template_style_text}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-foreground-tertiary">
                      {t('props.templateNone')}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={onOpenTemplateSetup}
                    className="mt-3 w-full rounded-md border border-gray-200 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-banana-400 hover:bg-banana-50 hover:text-banana-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-banana-500 dark:border-border-primary dark:text-foreground-secondary dark:hover:bg-background-hover dark:hover:text-banana-300"
                  >
                    {t('props.templateConfigure')}
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
                <MetaRow label={t('props.createdAt')}>{formatTimestamp(page.created_at)}</MetaRow>
                <MetaRow label={t('props.updatedAt')}>{formatTimestamp(page.updated_at)}</MetaRow>
              </div>
            </Section>
          </div>
        )}
        </>
        )}
      </aside>
    </>
  );
};
