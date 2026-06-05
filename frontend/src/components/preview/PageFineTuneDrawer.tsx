// Per-page fine-tune drawer for SlidePreview.
// WPS-style right panel that lets users adjust the currently selected page
// without leaving the preview: template (multi-template mode), description,
// extra fields, and the project's template library.
//
// NOTE: Backend for per-page templates isn't ready yet. Template library and
// per-page template assignment are persisted to localStorage so the UX is
// fully testable end-to-end. When the backend lands, swap the helpers in
// `templateLocalStore` for real API calls.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  ChevronRight,
  Sliders,
  Image as ImageIcon,
  Upload,
  Trash2,
  FileText,
  Tag,
  Plus,
  Check,
  ChevronDown,
  GripVertical,
} from 'lucide-react';
import { useT } from '@/hooks/useT';
import { MarkdownTextarea } from '@/components/shared/MarkdownTextarea';
import type { Page, DescriptionContent, TemplateAsset } from '@/types';

// ---------- i18n ----------

const drawerI18n = {
  zh: {
    drawer: {
      title: '页面精调',
      ariaOpen: '打开页面精调',
      ariaClose: '收起面板',
      pageHeader: '第 {{num}} 页',
      noPage: '请先选择一页',
      sections: {
        template: '模板',
        description: '描述',
        extraFields: '附加字段',
        templateLibrary: '项目模板库',
      },
      template: {
        none: '未指定模板（使用项目默认）',
        change: '更换',
        remove: '移除',
        pick: '选择模板',
        textStyleLabel: '文字风格要求',
        textStylePlaceholder: '例如：标题醒目、正文简洁、使用品牌蓝色…',
        matchReason: '匹配理由',
        autoMatch: '智能匹配当前页',
      },
      description: {
        placeholder: '编辑当前页的描述文字，可直接修改',
        empty: '这页还没有描述',
      },
      extraFields: {
        addButton: '添加字段',
        namePlaceholder: '字段名',
        valuePlaceholder: '字段值',
        empty: '暂无附加字段',
      },
      library: {
        upload: '上传模板图片',
        uploadHint: '支持 PNG / JPG / WEBP，可多选',
        analyzing: '分析中…',
        analyzed: '已分析',
        failed: '分析失败',
        pending: '待分析',
        empty: '模板库还是空的，先上传几张吧',
        autoMatchAll: '一键智能匹配全部',
        delete: '删除',
        confirmDelete: '确认删除这个模板吗？使用它的页面会被清空模板。',
        labelPlaceholder: '备注（可选）',
      },
      picker: {
        title: '选择模板',
        none: '不使用模板',
        emptyHint: '还没有模板，请先到下方的项目模板库上传',
      },
      saved: '已保存',
      saveFailed: '保存失败',
    },
  },
  en: {
    drawer: {
      title: 'Page Fine-tune',
      ariaOpen: 'Open fine-tune panel',
      ariaClose: 'Collapse panel',
      pageHeader: 'Page {{num}}',
      noPage: 'Select a page first',
      sections: {
        template: 'Template',
        description: 'Description',
        extraFields: 'Extra Fields',
        templateLibrary: 'Template Library',
      },
      template: {
        none: 'No template assigned (uses project default)',
        change: 'Change',
        remove: 'Remove',
        pick: 'Pick Template',
        textStyleLabel: 'Text Style Requirements',
        textStylePlaceholder: 'e.g. bold titles, concise body text, brand blue…',
        matchReason: 'Match Reason',
        autoMatch: 'Auto-match this page',
      },
      description: {
        placeholder: 'Edit this page\'s description directly',
        empty: 'No description yet for this page',
      },
      extraFields: {
        addButton: 'Add Field',
        namePlaceholder: 'Field name',
        valuePlaceholder: 'Field value',
        empty: 'No extra fields',
      },
      library: {
        upload: 'Upload Template Images',
        uploadHint: 'PNG / JPG / WEBP, multiple allowed',
        analyzing: 'Analyzing…',
        analyzed: 'Analyzed',
        failed: 'Analysis failed',
        pending: 'Pending',
        empty: 'Library is empty — upload some templates first',
        autoMatchAll: 'Auto-match All Pages',
        delete: 'Delete',
        confirmDelete: 'Delete this template? Pages using it will be cleared.',
        labelPlaceholder: 'Label (optional)',
      },
      picker: {
        title: 'Pick a Template',
        none: 'No template',
        emptyHint: 'No templates yet. Upload some in the Template Library below.',
      },
      saved: 'Saved',
      saveFailed: 'Save failed',
    },
  },
};

// ---------- LocalStorage mock store ----------
// These helpers persist the mock data for the per-page template system while
// the backend catches up. Keep the shape identical to what the API will return.

interface StoredAssignment {
  template_asset_id: string | null;
  template_style_text: string | null;
}

const LS_ASSETS = (projectId: string) => `template_assets_${projectId}`;
const LS_ASSIGN = (projectId: string) => `page_template_assign_${projectId}`;

export const templateLocalStore = {
  listAssets(projectId: string): TemplateAsset[] {
    try {
      const raw = localStorage.getItem(LS_ASSETS(projectId));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },
  saveAssets(projectId: string, assets: TemplateAsset[]) {
    localStorage.setItem(LS_ASSETS(projectId), JSON.stringify(assets));
  },
  getAssignment(projectId: string, pageId: string): StoredAssignment {
    try {
      const raw = localStorage.getItem(LS_ASSIGN(projectId));
      const all: Record<string, StoredAssignment> = raw ? JSON.parse(raw) : {};
      return all[pageId] || { template_asset_id: null, template_style_text: null };
    } catch {
      return { template_asset_id: null, template_style_text: null };
    }
  },
  setAssignment(projectId: string, pageId: string, assignment: StoredAssignment) {
    const raw = localStorage.getItem(LS_ASSIGN(projectId));
    const all: Record<string, StoredAssignment> = raw ? JSON.parse(raw) : {};
    all[pageId] = assignment;
    localStorage.setItem(LS_ASSIGN(projectId), JSON.stringify(all));
  },
  clearAssignmentsForAsset(projectId: string, assetId: string) {
    const raw = localStorage.getItem(LS_ASSIGN(projectId));
    const all: Record<string, StoredAssignment> = raw ? JSON.parse(raw) : {};
    let changed = false;
    for (const pid of Object.keys(all)) {
      if (all[pid]?.template_asset_id === assetId) {
        all[pid] = { template_asset_id: null, template_style_text: all[pid]?.template_style_text ?? null };
        changed = true;
      }
    }
    if (changed) {
      localStorage.setItem(LS_ASSIGN(projectId), JSON.stringify(all));
    }
  },
};

// Read a file as a data URL so we can show thumbnails without hitting a server.
const readFileAsDataURL = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// ---------- Helpers reused from DescriptionCard logic ----------

const getDescriptionText = (dc: DescriptionContent | undefined): string => {
  if (!dc) return '';
  if ('text' in dc && typeof dc.text === 'string') return dc.text;
  if ('text_content' in dc && Array.isArray(dc.text_content)) return dc.text_content.join('\n');
  return '';
};

const getExtraFields = (dc: DescriptionContent | undefined): Record<string, string> => {
  if (!dc) return {};
  if (dc.extra_fields) return dc.extra_fields;
  if (dc.layout_suggestion) return { '排版建议': dc.layout_suggestion };
  return {};
};

const buildDescriptionContent = (
  text: string,
  extraFields: Record<string, string>,
): DescriptionContent => {
  const filtered: Record<string, string> = {};
  for (const [k, v] of Object.entries(extraFields)) {
    if (k.trim() && v.trim()) filtered[k.trim()] = v;
  }
  return {
    text,
    ...(Object.keys(filtered).length > 0 ? { extra_fields: filtered } : {}),
  } as DescriptionContent;
};

// ---------- Drawer Props ----------

export interface PageFineTuneDrawerProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  page: Page | null;
  pageIndex: number;
  projectId: string;
  templateMode: 'single' | 'multi';
  onUpdatePage: (updates: Partial<Page>) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// ---------- Width constants ----------
const DEFAULT_WIDTH = 380;
const MIN_WIDTH = 280;
const MAX_WIDTH = 640;
const LS_WIDTH_KEY = 'page_fine_tune_drawer_width';

const readStoredWidth = (): number => {
  if (typeof window === 'undefined') return DEFAULT_WIDTH;
  try {
    const raw = localStorage.getItem(LS_WIDTH_KEY);
    if (!raw) return DEFAULT_WIDTH;
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= MIN_WIDTH && n <= MAX_WIDTH) return n;
  } catch {
    // ignore
  }
  return DEFAULT_WIDTH;
};

// ---------- Drawer Component ----------

export const PageFineTuneDrawer: React.FC<PageFineTuneDrawerProps> = ({
  isOpen,
  onOpen,
  onClose,
  page,
  pageIndex,
  projectId,
  templateMode,
  onUpdatePage,
  showToast,
}) => {
  const t = useT(drawerI18n);
  const isMulti = templateMode === 'multi';

  // ----- Drawer width (resizable) -----
  // The drawer lives inline inside the flex row next to the main preview,
  // so its width directly shrinks the preview. Users can drag the left edge
  // to resize; the chosen width persists in localStorage across sessions.
  const [drawerWidth, setDrawerWidth] = useState<number>(readStoredWidth);
  const [isResizing, setIsResizing] = useState(false);
  const drawerWidthRef = useRef(drawerWidth);
  useEffect(() => {
    drawerWidthRef.current = drawerWidth;
  }, [drawerWidth]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = drawerWidthRef.current;
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (evt: MouseEvent) => {
      // Drawer anchors to the right edge — dragging LEFT should grow it.
      const dx = startX - evt.clientX;
      const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + dx));
      setDrawerWidth(next);
    };
    const onUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try {
        localStorage.setItem(LS_WIDTH_KEY, String(drawerWidthRef.current));
      } catch {
        // ignore storage errors
      }
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  // ----- Template library state (mock) -----
  const [assets, setAssets] = useState<TemplateAsset[]>(() =>
    templateLocalStore.listAssets(projectId),
  );
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reload assets whenever drawer opens or projectId changes.
  useEffect(() => {
    if (projectId) {
      setAssets(templateLocalStore.listAssets(projectId));
    }
  }, [projectId, isOpen]);

  // ----- Per-page assignment (mock-persisted) -----
  // Template fields live purely in localStorage for now because the backend
  // doesn't know about them — round-tripping them through `updatePageLocal`
  // would let the next sync wipe them out. When the backend ships, swap
  // these reads/writes for API calls and also update the page object.
  const pageId = page?.id || page?.page_id;
  const [currentAssetId, setCurrentAssetId] = useState<string | null>(null);
  const [styleDraft, setStyleDraft] = useState<string>('');

  // Reload assignment from storage whenever the page changes or drawer opens.
  useEffect(() => {
    if (!pageId) {
      setCurrentAssetId(null);
      setStyleDraft('');
      return;
    }
    const stored = templateLocalStore.getAssignment(projectId, pageId);
    // Page object wins if present (future backend support); fall back to LS.
    setCurrentAssetId(page?.template_asset_id ?? stored.template_asset_id ?? null);
    setStyleDraft(page?.template_style_text ?? stored.template_style_text ?? '');
  }, [pageId, projectId, isOpen, page?.template_asset_id, page?.template_style_text]);

  const currentAsset = assets.find((a) => a.id === currentAssetId) || null;

  // ----- Description draft -----
  const descriptionText = getDescriptionText(page?.description_content);
  const [descDraft, setDescDraft] = useState<string>(descriptionText);
  useEffect(() => {
    setDescDraft(descriptionText);
  }, [pageId, descriptionText]);

  // ----- Extra fields draft -----
  const initialExtraFields = getExtraFields(page?.description_content);
  const [extraFieldsDraft, setExtraFieldsDraft] = useState<
    Array<{ id: string; name: string; value: string }>
  >(() =>
    Object.entries(initialExtraFields).map(([name, value], idx) => ({
      id: `${idx}-${name}`,
      name,
      value,
    })),
  );
  useEffect(() => {
    setExtraFieldsDraft(
      Object.entries(initialExtraFields).map(([name, value], idx) => ({
        id: `${idx}-${name}`,
        name,
        value,
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  // ----- Commit helpers -----
  const commitDescription = useCallback(() => {
    if (!page) return;
    const fieldsObj: Record<string, string> = {};
    for (const f of extraFieldsDraft) {
      if (f.name.trim() && f.value.trim()) fieldsObj[f.name.trim()] = f.value;
    }
    const newContent = buildDescriptionContent(descDraft, fieldsObj);
    onUpdatePage({ description_content: newContent });
  }, [page, descDraft, extraFieldsDraft, onUpdatePage]);

  const commitAssignment = useCallback(
    (nextAssetId: string | null, nextStyle: string | null) => {
      if (!pageId) return;
      templateLocalStore.setAssignment(projectId, pageId, {
        template_asset_id: nextAssetId,
        template_style_text: nextStyle,
      });
      // Local state reflects the change immediately. We deliberately do NOT
      // call onUpdatePage here — backend doesn't persist these fields yet,
      // so pushing them through would get wiped by the next project sync.
      setCurrentAssetId(nextAssetId);
      if (nextStyle !== null) setStyleDraft(nextStyle);
    },
    [pageId, projectId],
  );

  // ----- Template library handlers -----
  const handleUploadFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const newAssets: TemplateAsset[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        const dataUrl = await readFileAsDataURL(file);
        const id = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        newAssets.push({
          id,
          project_id: projectId,
          image_url: dataUrl,
          thumb_url: dataUrl,
          analysis_status: 'pending',
          user_label: file.name.replace(/\.[^.]+$/, ''),
          sort_order: assets.length + newAssets.length,
          created_at: new Date().toISOString(),
        });
      }
      const next = [...assets, ...newAssets];
      setAssets(next);
      templateLocalStore.saveAssets(projectId, next);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsLibraryOpen(true);
      showToast?.(t('drawer.saved'), 'success');
    },
    [assets, projectId, showToast, t],
  );

  const handleDeleteAsset = useCallback(
    (assetId: string) => {
      if (!confirm(t('drawer.library.confirmDelete'))) return;
      const next = assets.filter((a) => a.id !== assetId);
      setAssets(next);
      templateLocalStore.saveAssets(projectId, next);
      templateLocalStore.clearAssignmentsForAsset(projectId, assetId);
      // If the currently selected page was using it, clear locally too.
      if (currentAssetId === assetId) {
        setCurrentAssetId(null);
      }
    },
    [assets, projectId, currentAssetId, t],
  );

  const handlePickTemplate = useCallback(
    (assetId: string | null) => {
      commitAssignment(assetId, styleDraft.trim() ? styleDraft : null);
      setIsPickerOpen(false);
    },
    [commitAssignment, styleDraft],
  );

  // ----- Extra field editing helpers -----
  const addExtraField = () => {
    setExtraFieldsDraft((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, name: '', value: '' },
    ]);
  };
  const removeExtraField = (id: string) => {
    setExtraFieldsDraft((prev) => prev.filter((f) => f.id !== id));
  };
  const updateExtraField = (id: string, patch: Partial<{ name: string; value: string }>) => {
    setExtraFieldsDraft((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  // ----- Render -----
  // The drawer lives INLINE inside the main flex row next to `<main>`, so
  // when it opens the preview naturally shrinks to fill the remaining space.
  // The left edge carries a drag handle for resizing. When closed, an edge
  // tab floats at the right edge of the parent flex row (absolute-positioned,
  // so it never overlaps the top header).
  //
  // Mobile layout: the parent flex row is `flex-col`, which would put the
  // drawer below the preview — confusing UX. We hide the drawer entirely on
  // mobile and rely on the existing per-page editing controls there.
  return (
    <>
      {/* Edge tab — shown when closed. Absolute-positioned relative to the
          parent flex row (NOT the viewport), so it stays below the header.
          A tall thin pill with only the icon, no label text. */}
      {!isOpen && (
        <button
          onClick={onOpen}
          className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 items-center justify-center bg-white dark:bg-background-secondary border border-r-0 border-gray-200 dark:border-border-primary rounded-l-lg shadow-lg px-1.5 py-8 hover:bg-banana-50 dark:hover:bg-background-hover hover:px-2 transition-all"
          aria-label={t('drawer.ariaOpen')}
          title={t('drawer.title')}
        >
          <Sliders size={16} className="text-banana-600 dark:text-banana-400" />
        </button>
      )}

      {/* Inline drawer — a flex-shrink-0 child of the main row. When closed
          its width animates to 0; when open it takes `drawerWidth`. Inner
          content is kept at fixed width so it doesn't reflow during animation. */}
      <aside
        className={`hidden md:flex relative flex-shrink-0 overflow-hidden bg-white dark:bg-background-secondary border-l border-gray-200 dark:border-border-primary ${
          isOpen ? 'shadow-lg' : ''
        } ${isResizing ? '' : 'transition-[width] duration-200 ease-out'}`}
        style={{
          width: isOpen ? drawerWidth : 0,
        }}
        aria-hidden={!isOpen}
      >
        {/* Left-edge resize handle — only active when drawer is open */}
        {isOpen && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize fine-tune panel"
            onMouseDown={handleResizeMouseDown}
            className={`group absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-30 flex items-center justify-center hover:bg-banana-300/40 ${
              isResizing ? 'bg-banana-400/50' : ''
            }`}
          >
            <GripVertical
              size={12}
              className={`text-gray-300 dark:text-border-primary group-hover:text-banana-500 ${
                isResizing ? 'text-banana-600' : ''
              }`}
            />
          </div>
        )}

        {/* Fixed-width inner content so width animation doesn't reflow sections */}
        <div className="flex flex-col h-full" style={{ width: drawerWidth }}>
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-border-primary flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Sliders size={16} className="text-banana-600 dark:text-banana-400 flex-shrink-0" />
            <span className="font-semibold text-sm text-gray-900 dark:text-foreground-primary truncate">
              {t('drawer.title')}
            </span>
            {page && (
              <span className="text-xs text-gray-500 dark:text-foreground-tertiary flex-shrink-0">
                · {t('drawer.pageHeader', { num: pageIndex + 1 })}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-background-hover text-gray-500 dark:text-foreground-tertiary"
            aria-label={t('drawer.ariaClose')}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Drawer body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {!page ? (
            <div className="p-6 text-center text-sm text-gray-500 dark:text-foreground-tertiary">
              {t('drawer.noPage')}
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-border-primary">
              {/* ---------------- Template ---------------- */}
              {isMulti && (
                <section data-section="template" className="p-4">
                  <SectionHeader
                    icon={<ImageIcon size={14} />}
                    title={t('drawer.sections.template')}
                  />
                  <div className="mt-3">
                    {currentAsset ? (
                      <div className="flex gap-3">
                        <div className="w-20 h-20 rounded border border-gray-200 dark:border-border-primary overflow-hidden bg-gray-50 dark:bg-background-primary flex-shrink-0">
                          <img
                            src={currentAsset.thumb_url || currentAsset.image_url}
                            alt={currentAsset.user_label || 'Template'}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-foreground-primary truncate">
                            {currentAsset.user_label || `Template ${currentAsset.id.slice(0, 6)}`}
                          </div>
                          {page.template_match_reason && (
                            <div className="text-xs text-gray-500 dark:text-foreground-tertiary mt-1 line-clamp-2">
                              {page.template_match_reason}
                            </div>
                          )}
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <button
                              onClick={() => setIsPickerOpen(true)}
                              className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-border-primary hover:bg-banana-50 dark:hover:bg-background-hover text-gray-700 dark:text-foreground-secondary"
                            >
                              {t('drawer.template.change')}
                            </button>
                            <button
                              onClick={() => commitAssignment(null, styleDraft.trim() ? styleDraft : null)}
                              className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-border-primary hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                            >
                              {t('drawer.template.remove')}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsPickerOpen(true)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-6 rounded border-2 border-dashed border-gray-300 dark:border-border-primary text-sm text-gray-500 dark:text-foreground-tertiary hover:border-banana-400 hover:bg-banana-50/40 dark:hover:bg-background-hover transition-colors"
                      >
                        <Plus size={14} />
                        {t('drawer.template.pick')}
                      </button>
                    )}
                  </div>

                  {/* Text style input */}
                  <div className="mt-4">
                    <label className="block text-xs font-medium text-gray-600 dark:text-foreground-tertiary mb-1.5">
                      {t('drawer.template.textStyleLabel')}
                    </label>
                    <MarkdownTextarea
                      value={styleDraft}
                      onChange={setStyleDraft}
                      onBlur={() =>
                        commitAssignment(currentAssetId ?? null, styleDraft.trim() ? styleDraft : null)
                      }
                      placeholder={t('drawer.template.textStylePlaceholder')}
                      rows={2}
                      showUploadButton={false}
                      showImagePreview={false}
                    />
                  </div>
                </section>
              )}

              {/* ---------------- Description ---------------- */}
              <section data-section="description" className="p-4">
                <SectionHeader
                  icon={<FileText size={14} />}
                  title={t('drawer.sections.description')}
                />
                <div className="mt-3">
                  <MarkdownTextarea
                    value={descDraft}
                    onChange={setDescDraft}
                    onBlur={commitDescription}
                    placeholder={t('drawer.description.placeholder')}
                    rows={6}
                    showUploadButton={false}
                    showImagePreview={false}
                  />
                </div>
              </section>

              {/* ---------------- Extra Fields ---------------- */}
              <section data-section="extra-fields" className="p-4">
                <SectionHeader
                  icon={<Tag size={14} />}
                  title={t('drawer.sections.extraFields')}
                />
                <div className="mt-3 space-y-2">
                  {extraFieldsDraft.length === 0 ? (
                    <div className="text-xs text-gray-400 dark:text-foreground-tertiary italic py-2">
                      {t('drawer.extraFields.empty')}
                    </div>
                  ) : (
                    extraFieldsDraft.map((field) => (
                      <div key={field.id}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <input
                            type="text"
                            value={field.name}
                            onChange={(e) => updateExtraField(field.id, { name: e.target.value })}
                            onBlur={commitDescription}
                            placeholder={t('drawer.extraFields.namePlaceholder')}
                            className="flex-1 text-xs font-medium bg-transparent border-b border-transparent focus:border-banana-400 outline-none text-gray-700 dark:text-foreground-secondary"
                          />
                          <button
                            onClick={() => {
                              removeExtraField(field.id);
                              // commit after state settles
                              setTimeout(commitDescription, 0);
                            }}
                            className="text-gray-400 hover:text-red-500 p-0.5"
                            aria-label={t('drawer.library.delete')}
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <MarkdownTextarea
                          value={field.value}
                          onChange={(v) => updateExtraField(field.id, { value: v })}
                          onBlur={commitDescription}
                          placeholder={t('drawer.extraFields.valuePlaceholder')}
                          rows={2}
                          showUploadButton={false}
                          showImagePreview={false}
                        />
                      </div>
                    ))
                  )}
                  <button
                    onClick={addExtraField}
                    className="w-full flex items-center justify-center gap-1.5 text-xs px-2 py-1.5 rounded border border-dashed border-gray-300 dark:border-border-primary text-gray-500 dark:text-foreground-tertiary hover:border-banana-400 hover:text-banana-600"
                  >
                    <Plus size={12} />
                    {t('drawer.extraFields.addButton')}
                  </button>
                </div>
              </section>

              {/* ---------------- Template Library (multi only) ---------------- */}
              {isMulti && (
                <section data-section="template-library" className="p-4">
                  <button
                    onClick={() => setIsLibraryOpen((v) => !v)}
                    className="w-full flex items-center justify-between group"
                  >
                    <SectionHeader
                      icon={<ImageIcon size={14} />}
                      title={`${t('drawer.sections.templateLibrary')} (${assets.length})`}
                    />
                    <ChevronDown
                      size={14}
                      className={`text-gray-400 transition-transform ${isLibraryOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {isLibraryOpen && (
                    <div className="mt-3">
                      {/* Upload */}
                      <label className="block border-2 border-dashed border-gray-300 dark:border-border-primary rounded-lg p-4 text-center cursor-pointer hover:border-banana-400 hover:bg-banana-50/40 dark:hover:bg-background-hover transition-colors">
                        <Upload size={18} className="mx-auto text-gray-400 mb-1.5" />
                        <div className="text-xs font-medium text-gray-700 dark:text-foreground-secondary">
                          {t('drawer.library.upload')}
                        </div>
                        <div className="text-[11px] text-gray-400 dark:text-foreground-tertiary mt-0.5">
                          {t('drawer.library.uploadHint')}
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => handleUploadFiles(e.target.files)}
                        />
                      </label>

                      {/* Grid */}
                      {assets.length === 0 ? (
                        <div className="mt-4 text-center text-xs text-gray-400 dark:text-foreground-tertiary py-4">
                          {t('drawer.library.empty')}
                        </div>
                      ) : (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {assets.map((asset) => {
                            const isCurrent = asset.id === currentAssetId;
                            return (
                              <div
                                key={asset.id}
                                className={`relative group rounded border overflow-hidden bg-white dark:bg-background-primary transition-all ${
                                  isCurrent
                                    ? 'border-banana-500 ring-2 ring-banana-200 dark:ring-banana-900/40'
                                    : 'border-gray-200 dark:border-border-primary hover:border-banana-300'
                                }`}
                              >
                                <button
                                  onClick={() => handlePickTemplate(asset.id)}
                                  className="block w-full aspect-video bg-gray-50 dark:bg-background-secondary"
                                  title={asset.user_label || ''}
                                >
                                  <img
                                    src={asset.thumb_url || asset.image_url}
                                    alt={asset.user_label || ''}
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                                <div className="px-1.5 py-1 flex items-center gap-1">
                                  <div className="flex-1 truncate text-[11px] text-gray-600 dark:text-foreground-tertiary">
                                    {asset.user_label || asset.id.slice(0, 6)}
                                  </div>
                                  {isCurrent && (
                                    <Check size={11} className="text-banana-600 flex-shrink-0" />
                                  )}
                                  <button
                                    onClick={() => handleDeleteAsset(asset.id)}
                                    className="text-gray-300 hover:text-red-500 p-0.5 flex-shrink-0"
                                    aria-label={t('drawer.library.delete')}
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
        </div>
      </aside>

      {/* Template picker modal (inline nested) */}
      {isPickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setIsPickerOpen(false)}
        >
          <div
            className="bg-white dark:bg-background-secondary rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-border-primary flex-shrink-0">
              <span className="font-semibold text-sm text-gray-900 dark:text-foreground-primary">
                {t('drawer.picker.title')}
              </span>
              <button
                onClick={() => setIsPickerOpen(false)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-background-hover"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {assets.length === 0 ? (
                <div className="text-center text-sm text-gray-500 dark:text-foreground-tertiary py-8">
                  {t('drawer.picker.emptyHint')}
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {/* None option */}
                  <button
                    onClick={() => handlePickTemplate(null)}
                    className={`aspect-video rounded border-2 border-dashed flex flex-col items-center justify-center text-xs transition-colors ${
                      !currentAssetId
                        ? 'border-banana-500 bg-banana-50 dark:bg-background-hover text-banana-700'
                        : 'border-gray-300 dark:border-border-primary text-gray-500 hover:border-banana-400'
                    }`}
                  >
                    <X size={18} />
                    <span className="mt-1">{t('drawer.picker.none')}</span>
                  </button>
                  {assets.map((asset) => (
                    <button
                      key={asset.id}
                      onClick={() => handlePickTemplate(asset.id)}
                      className={`relative aspect-video rounded border-2 overflow-hidden ${
                        asset.id === currentAssetId
                          ? 'border-banana-500 ring-2 ring-banana-200'
                          : 'border-gray-200 dark:border-border-primary hover:border-banana-400'
                      }`}
                      title={asset.user_label || ''}
                    >
                      <img
                        src={asset.thumb_url || asset.image_url}
                        alt={asset.user_label || ''}
                        className="w-full h-full object-cover"
                      />
                      {asset.id === currentAssetId && (
                        <div className="absolute top-1 right-1 bg-banana-500 text-white rounded-full p-0.5">
                          <Check size={10} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ---------- Section header subcomponent ----------

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string }> = ({ icon, title }) => (
  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-foreground-tertiary">
    {icon}
    <span>{title}</span>
  </div>
);
