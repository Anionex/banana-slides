import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  FileUp,
  Sparkles,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  RectangleHorizontal,
  LayoutTemplate,
  PenLine,
  Wand2,
} from 'lucide-react';
import logoUrl from '@/assets/logo.png';
import { useT } from '@/hooks/useT';
import { cn } from '@/utils';
import { getImageUrl } from '@/api/client';
import { Button, IconButton, Loading, useToast, useConfirm } from '@/components/shared';
import { useProjectStore } from '@/store/useProjectStore';
import { TemplatePickerModal } from '@/components/template/TemplatePickerModal';
import { TemplateAnalysisEditor } from '@/components/template/TemplateAnalysisEditor';
import { SwitchToSingleModeDialog } from '@/components/template/SwitchToSingleModeDialog';
import { TemplateMatchProgress } from '@/components/template/TemplateMatchProgress';
import type { Task, TemplateAsset } from '@/types';

const i18n = {
  zh: {
    home: { title: '蕉幻' },
    ts: {
      title: '模板配置',
      back: '返回',
      next: '前往预览',
      toSingle: '转为单模板',
      autoMatchAll: '一键自动匹配',
      matching: '匹配中…',
      library: '项目模板库',
      pages: '页面列表',
      uploadImage: '上传图片',
      uploadPdf: '上传 PDF',
      uploading: '上传中…',
      pdfProcessing: 'PDF 解析中…',
      emptyLibrary: '模板库为空',
      emptyLibraryHint: '上传模板图片或整份 PDF，解析后即可为每一页分配模板',
      emptyPages: '暂无页面，先在大纲或描述编辑器生成页面',
      labelPlaceholder: '添加标记（可选）',
      delete: '删除',
      reanalyze: '重新解析',
      expand: '展开解析',
      collapse: '收起',
      statusPending: '解析中',
      statusProcessing: '解析中',
      statusCompleted: '已解析',
      statusFailed: '解析失败',
      pickTemplate: '选择模板',
      autoMatchPage: '单页自动匹配',
      editStyle: '编辑文字模板',
      stylePlaceholder: '为该页输入文字风格描述…',
      saveStyle: '保存',
      unconfirmed: '未确认',
      noDescHint: '该页缺少描述，无法自动匹配',
      page: '第 {{num}} 页',
      currentStyle: '文字模板',
      confirmDelete: '删除该模板后，引用它的页面将被清空。确定删除吗？',
      confirmDeleteTitle: '确认删除模板',
      deletedCleared: '已删除模板，{{count}} 个页面被重置',
      saved: '已保存',
      matchDone: '自动匹配完成',
      pageMatchDone: '本页匹配完成',
      matchFailed: '自动匹配失败',
      waitForPages: '页面仍在生成，请等待页面描述完成后再自动匹配',
      waitForDescriptions: '请先完成所有页面描述，再进行自动匹配',
      waitForTemplates: '模板仍在解析，请等待全部解析完成',
      needAnalyzedTemplate: '至少需要一个解析成功的模板才能自动匹配',
      loading: '加载中…',
      matchedOfTotal: '已匹配 {{matched}}/{{total}}',
      usedByPages: '{{count}} 页使用',
      autoMatched: '自动匹配',
      manualPicked: '手动指定',
      templateRef: '模板 #{{num}}',
    },
  },
  en: {
    home: { title: 'Banana Slides' },
    ts: {
      title: 'Template Setup',
      back: 'Back',
      next: 'Go to Preview',
      toSingle: 'Switch to single',
      autoMatchAll: 'Auto-match all',
      matching: 'Matching…',
      library: 'Project template library',
      pages: 'Pages',
      uploadImage: 'Upload image',
      uploadPdf: 'Upload PDF',
      uploading: 'Uploading…',
      pdfProcessing: 'Splitting PDF…',
      emptyLibrary: 'Library is empty',
      emptyLibraryHint: 'Upload template images or a whole PDF; once analyzed you can assign one per page',
      emptyPages: 'No pages yet — generate them in the outline or description editor',
      labelPlaceholder: 'Add a label (optional)',
      delete: 'Delete',
      reanalyze: 'Re-analyze',
      expand: 'Expand analysis',
      collapse: 'Collapse',
      statusPending: 'Analyzing',
      statusProcessing: 'Analyzing',
      statusCompleted: 'Analyzed',
      statusFailed: 'Analysis failed',
      pickTemplate: 'Pick template',
      autoMatchPage: 'Auto-match page',
      editStyle: 'Edit text template',
      stylePlaceholder: 'Enter a text-style note for this page…',
      saveStyle: 'Save',
      unconfirmed: 'Unconfirmed',
      noDescHint: 'This page has no description, cannot auto-match',
      page: 'Page {{num}}',
      currentStyle: 'Text template',
      confirmDelete: 'Deleting this template will clear pages that reference it. Continue?',
      confirmDeleteTitle: 'Confirm delete template',
      deletedCleared: 'Template deleted, {{count}} page(s) reset',
      saved: 'Saved',
      matchDone: 'Auto-match completed',
      pageMatchDone: 'Page matched',
      matchFailed: 'Auto-match failed',
      waitForPages: 'Pages are still being generated. Wait for page descriptions before auto-matching',
      waitForDescriptions: 'Complete every page description before auto-matching',
      waitForTemplates: 'Templates are still being analyzed. Wait for all analyses to finish',
      needAnalyzedTemplate: 'At least one successfully analyzed template is required for auto-match',
      loading: 'Loading…',
      matchedOfTotal: '{{matched}}/{{total}} matched',
      usedByPages: 'Used by {{count}} page(s)',
      autoMatched: 'Auto-matched',
      manualPicked: 'Manually picked',
      templateRef: 'Template #{{num}}',
    },
  },
};

const statusDotClass: Record<TemplateAsset['analysis_status'], string> = {
  pending: 'bg-blue-400 animate-pulse',
  processing: 'bg-blue-400 animate-pulse',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
};

const statusTextClass: Record<TemplateAsset['analysis_status'], string> = {
  pending: 'text-blue-100',
  processing: 'text-blue-100',
  completed: 'text-green-100',
  failed: 'text-red-100',
};

export const TemplateSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const t = useT(i18n);
  const { projectId } = useParams<{ projectId: string }>();
  const { show, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const {
    currentProject,
    syncProject,
    templateAssets,
    loadTemplateAssets,
    uploadTemplateAsset,
    uploadTemplatePdf,
    updateTemplateAsset,
    deleteTemplateAsset,
    reanalyzeTemplateAsset,
    updatePageTemplate,
    switchTemplateMode,
    switchTemplateModeWithUpload,
    autoMatchAll,
    autoMatchPage,
    pollTemplateTask,
  } = useProjectStore();

  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pdfProcessing, setPdfProcessing] = useState(false);
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
  const [pickerPageId, setPickerPageId] = useState<string | null>(null);
  const [styleDraftPageId, setStyleDraftPageId] = useState<string | null>(null);
  const [styleDraft, setStyleDraft] = useState('');
  const [matchTask, setMatchTask] = useState<Task | null>(null);
  const [matchingAll, setMatchingAll] = useState(false);
  const [matchingPageId, setMatchingPageId] = useState<string | null>(null);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [hoveredAssetId, setHoveredAssetId] = useState<string | null>(null);

  // 加载项目 + 模板库
  useEffect(() => {
    if (!projectId) return;
    if (!currentProject || currentProject.id !== projectId) {
      syncProject(projectId);
    }
    loadTemplateAssets(projectId);
  }, [projectId, currentProject?.id]);

  const hasAnalyzingAssets = templateAssets.some(
    (asset) => asset.analysis_status === 'pending' || asset.analysis_status === 'processing'
  );

  // PDF splitting starts per-page analysis tasks without returning their IDs.
  // Refresh the library while those tasks run so readiness and badges recover
  // automatically instead of staying stale until the user reloads the page.
  useEffect(() => {
    if (!projectId || currentProject?.id !== projectId || !hasAnalyzingAssets) return;
    let active = true;
    let timer: number | undefined;
    const poll = async () => {
      if (!active || currentProject?.id !== projectId) return;
      try {
        await loadTemplateAssets(projectId);
      } catch {
        // A later poll can recover from a transient refresh failure.
      } finally {
        if (active) timer = window.setTimeout(poll, 2000);
      }
    };
    timer = window.setTimeout(poll, 2000);
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [projectId, currentProject?.id, hasAnalyzingAssets, loadTemplateAssets]);

  // 路由守卫：单模板模式直接跳预览（决策 6）
  useEffect(() => {
    if (currentProject && currentProject.id === projectId && currentProject.template_mode === 'single') {
      navigate(`/project/${projectId}/preview`, { replace: true });
    }
  }, [currentProject?.template_mode, currentProject?.id, projectId, navigate]);

  if (!currentProject) {
    return <Loading fullscreen message={t('ts.loading')} />;
  }

  const pages = currentProject.pages;
  const assetById = (id?: string | null) => templateAssets.find((a) => a.id === id) || null;
  const assetIndexById = (id?: string | null) =>
    templateAssets.findIndex((a) => a.id === id);
  const usageByAsset = pages.reduce<Record<string, number>>((acc, p) => {
    if (p.template_asset_id) {
      acc[p.template_asset_id] = (acc[p.template_asset_id] || 0) + 1;
    }
    return acc;
  }, {});
  const matchedCount = pages.filter((p) => p.template_asset_id).length;
  const hasCompletedAsset = templateAssets.some((asset) => asset.analysis_status === 'completed');
  const hasMissingDescriptions = pages.some((page) => !page.description_content);
  const autoMatchBlockReason = pages.length === 0
    ? t('ts.waitForPages')
    : hasMissingDescriptions
      ? t('ts.waitForDescriptions')
      : hasAnalyzingAssets
        ? t('ts.waitForTemplates')
        : !hasCompletedAsset
          ? t('ts.needAnalyzedTemplate')
          : null;

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !projectId) return;
    setUploading(true);
    try {
      await uploadTemplateAsset(projectId, file);
    } finally {
      setUploading(false);
    }
  };

  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !projectId) return;
    setPdfProcessing(true);
    try {
      const taskId = await uploadTemplatePdf(projectId, file);
      await pollTemplateTask(taskId, projectId);
      await loadTemplateAssets(projectId);
    } catch {
      show({ message: t('ts.matchFailed'), type: 'error' });
    } finally {
      setPdfProcessing(false);
    }
  };

  const handleDeleteAsset = (assetId: string) => {
    if (!projectId) return;
    confirm(
      t('ts.confirmDelete'),
      async () => {
        const clearedPageIds = await deleteTemplateAsset(projectId, assetId);
        await syncProject(projectId);
        show({
          message: t('ts.deletedCleared', { count: String(clearedPageIds.length) }),
          type: 'success',
        });
      },
      { title: t('ts.confirmDeleteTitle'), variant: 'warning' }
    );
  };

  const handleReanalyze = async (assetId: string) => {
    if (!projectId) return;
    const taskId = await reanalyzeTemplateAsset(projectId, assetId);
    await pollTemplateTask(taskId, projectId);
    await loadTemplateAssets(projectId);
  };

  const handleAutoMatchAll = async () => {
    if (!projectId) return;
    setMatchingAll(true);
    setMatchTask(null);
    try {
      const taskId = await autoMatchAll(projectId, { overwrite_existing: false, preserve_non_empty: true });
      await pollTemplateTask(taskId, projectId, (task) => setMatchTask(task));
      await syncProject(projectId);
      show({ message: t('ts.matchDone'), type: 'success' });
    } catch {
      show({ message: t('ts.matchFailed'), type: 'error' });
    } finally {
      setMatchingAll(false);
    }
  };

  const handleAutoMatchPage = async (pageId: string) => {
    if (!projectId) return;
    setMatchingPageId(pageId);
    try {
      const taskId = await autoMatchPage(projectId, pageId);
      await pollTemplateTask(taskId, projectId);
      await syncProject(projectId);
      show({ message: t('ts.pageMatchDone'), type: 'success' });
    } catch {
      show({ message: t('ts.matchFailed'), type: 'error' });
    } finally {
      setMatchingPageId(null);
    }
  };

  const handlePickTemplate = async (pageId: string, assetId: string | null) => {
    if (!projectId) return;
    await updatePageTemplate(projectId, pageId, {
      template_asset_id: assetId,
      selection_source: 'manual',
    });
  };

  const handleSaveStyle = async (pageId: string) => {
    if (!projectId) return;
    await updatePageTemplate(projectId, pageId, {
      template_style_text: styleDraft.trim() || null,
      selection_source: 'manual',
    });
    setStyleDraftPageId(null);
    show({ message: t('ts.saved'), type: 'success' });
  };

  const handleSwitchExisting = async (assetId: string, unifiedStyleText?: string) => {
    if (!projectId) return;
    await switchTemplateMode(projectId, {
      mode: 'single',
      unified_asset_id: assetId,
      unified_style_text: unifiedStyleText ?? null,
    });
    navigate(`/project/${projectId}/preview`, { replace: true });
  };

  const handleSwitchUpload = async (file: File, unifiedStyleText?: string) => {
    if (!projectId) return;
    await switchTemplateModeWithUpload(projectId, file, unifiedStyleText);
    navigate(`/project/${projectId}/preview`, { replace: true });
  };

  const pickerPage = pages.find((p) => (p.id || p.page_id) === pickerPageId) || null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background-primary flex flex-col">
      {/* 顶栏 */}
      <header className="bg-white dark:bg-background-secondary shadow-sm border-b border-gray-200 dark:border-border-primary px-3 md:px-6 py-2 md:py-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-2 md:gap-4">
          <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft size={16} />}
              onClick={() => navigate(`/project/${projectId}/detail`)}
            >
              <span className="hidden sm:inline">{t('ts.back')}</span>
            </Button>
            <div className="flex items-center gap-1.5 md:gap-2">
              <img src={logoUrl} alt="" className="w-6 h-6 md:w-8 md:h-8 object-contain flex-shrink-0" />
              <span className="text-base md:text-xl font-bold">{t('home.title')}</span>
            </div>
            <span className="text-gray-400 hidden lg:inline">|</span>
            <span className="text-sm md:text-lg font-semibold hidden lg:inline">{t('ts.title')}</span>
          </div>

          <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
            <IconButton
              icon={<RectangleHorizontal size={16} />}
              label={t('ts.toSingle')}
              tooltipSide="bottom"
              onClick={() => setSwitchOpen(true)}
            />
            <span className="inline-flex" title={autoMatchBlockReason || undefined}>
              <Button
                variant="secondary"
                size="sm"
                icon={<Sparkles size={16} />}
                loading={matchingAll}
                disabled={!!autoMatchBlockReason}
                aria-label={autoMatchBlockReason
                  ? `${t('ts.autoMatchAll')}: ${autoMatchBlockReason}`
                  : t('ts.autoMatchAll')}
                onClick={handleAutoMatchAll}
              >
                <span className="hidden sm:inline">
                  {matchingAll ? t('ts.matching') : t('ts.autoMatchAll')}
                </span>
              </Button>
            </span>
            <Button
              variant="primary"
              size="sm"
              icon={<ArrowRight size={16} />}
              onClick={() => navigate(`/project/${projectId}/preview`)}
            >
              <span className="hidden sm:inline">{t('ts.next')}</span>
            </Button>
          </div>
        </div>
      </header>

      {autoMatchBlockReason && (
        <div
          role="status"
          data-testid="auto-match-readiness"
          className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 md:px-6"
        >
          {autoMatchBlockReason}
        </div>
      )}

      {matchTask && (
        <div className="mx-auto w-full max-w-7xl px-3 md:px-6 pt-3">
          <TemplateMatchProgress task={matchTask} />
        </div>
      )}

      <main className="flex-1 p-3 md:p-6 overflow-y-auto min-h-0">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-5 lg:grid-cols-12">
          {/* 左栏：模板库 */}
          <section className="space-y-3 lg:col-span-5">
            <div className="flex min-h-[32px] flex-wrap items-center justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-foreground-primary">
                  {t('ts.library')}
                </h2>
                {templateAssets.length > 0 && (
                  <span className="rounded-full bg-gray-200/70 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    {templateAssets.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Upload size={14} />}
                  loading={uploading}
                  onClick={() => imageInputRef.current?.click()}
                >
                  {uploading ? t('ts.uploading') : t('ts.uploadImage')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<FileUp size={14} />}
                  loading={pdfProcessing}
                  onClick={() => pdfInputRef.current?.click()}
                >
                  {pdfProcessing ? t('ts.pdfProcessing') : t('ts.uploadPdf')}
                </Button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                  className="hidden"
                  onChange={handleUploadImage}
                />
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleUploadPdf}
                />
              </div>
            </div>

            {templateAssets.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-panel border-2 border-dashed border-gray-200 px-6 py-14 text-center dark:border-gray-700">
                <LayoutTemplate size={28} className="text-gray-300 dark:text-gray-600" />
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  {t('ts.emptyLibrary')}
                </p>
                <p className="max-w-[260px] text-xs leading-relaxed text-gray-400 dark:text-gray-500">
                  {t('ts.emptyLibraryHint')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {templateAssets.map((asset, assetIdx) => {
                  const expanded = expandedAssetId === asset.id;
                  const usedCount = usageByAsset[asset.id] || 0;
                  return (
                    <div
                      key={asset.id}
                      className={cn(
                        'rounded-card border bg-white transition-all duration-200 dark:bg-background-secondary',
                        expanded && 'sm:col-span-2',
                        asset.analysis_status === 'failed'
                          ? 'border-red-300 dark:border-red-700'
                          : 'border-gray-200 dark:border-gray-700',
                        hoveredAssetId === asset.id
                          ? 'shadow-md ring-2 ring-banana-500 ring-offset-1 dark:ring-offset-gray-900'
                          : 'hover:shadow-md'
                      )}
                    >
                      <div className="relative overflow-hidden rounded-t-card">
                        <img
                          src={getImageUrl(asset.thumb_url || asset.image_url)}
                          alt={asset.user_label || asset.id}
                          className="aspect-video w-full object-cover"
                        />
                        <span className="absolute left-2 top-2 rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                          #{assetIdx + 1}
                        </span>
                        <span
                          className={cn(
                            'absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-medium backdrop-blur-sm',
                            statusTextClass[asset.analysis_status]
                          )}
                        >
                          <span className={cn('h-1.5 w-1.5 rounded-full', statusDotClass[asset.analysis_status])} />
                          {t(`ts.status${asset.analysis_status.charAt(0).toUpperCase()}${asset.analysis_status.slice(1)}`)}
                        </span>
                        {usedCount > 0 && (
                          <span className="absolute bottom-2 right-2 rounded-md bg-banana-500/95 px-1.5 py-0.5 text-[10px] font-semibold text-black">
                            {t('ts.usedByPages', { count: String(usedCount) })}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-0.5 px-2 py-1.5">
                        <input
                          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-xs font-medium text-gray-800 outline-none transition-colors hover:border-gray-200 hover:bg-gray-50 focus:border-banana-500 focus:bg-white dark:text-gray-100 dark:hover:border-gray-700 dark:hover:bg-gray-800 dark:focus:bg-gray-800"
                          placeholder={t('ts.labelPlaceholder')}
                          defaultValue={asset.user_label || ''}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v !== (asset.user_label || '') && projectId) {
                              updateTemplateAsset(projectId, asset.id, { user_label: v || null });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                        />
                        <IconButton
                          size="sm"
                          icon={expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          label={expanded ? t('ts.collapse') : t('ts.expand')}
                          active={expanded}
                          onClick={() => setExpandedAssetId(expanded ? null : asset.id)}
                        />
                        <IconButton
                          size="sm"
                          icon={<RefreshCw size={14} />}
                          label={t('ts.reanalyze')}
                          onClick={() => handleReanalyze(asset.id)}
                        />
                        <IconButton
                          size="sm"
                          variant="danger"
                          icon={<Trash2 size={14} />}
                          label={t('ts.delete')}
                          onClick={() => handleDeleteAsset(asset.id)}
                        />
                      </div>

                      {expanded && (
                        <div className="border-t border-gray-100 px-3 py-3 dark:border-gray-700">
                          <TemplateAnalysisEditor
                            asset={asset}
                            onSave={async (analysis, notes) => {
                              if (!projectId) return;
                              await updateTemplateAsset(projectId, asset.id, {
                                analysis_json: analysis,
                                analysis_notes: notes,
                              });
                              show({ message: t('ts.saved'), type: 'success' });
                            }}
                            onReanalyze={() => handleReanalyze(asset.id)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 右栏：页面列表 */}
          <section className="space-y-3 lg:col-span-7">
            <div className="flex min-h-[32px] flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-foreground-primary">
                {t('ts.pages')}
              </h2>
              {pages.length > 0 && (
                <>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-medium',
                      matchedCount === pages.length
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                    )}
                  >
                    {t('ts.matchedOfTotal', {
                      matched: String(matchedCount),
                      total: String(pages.length),
                    })}
                  </span>
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        matchedCount === pages.length ? 'bg-green-500' : 'bg-banana-500'
                      )}
                      style={{ width: `${pages.length ? (matchedCount / pages.length) * 100 : 0}%` }}
                    />
                  </div>
                </>
              )}
            </div>

            {pages.length === 0 ? (
              <p className="rounded-panel border-2 border-dashed border-gray-200 py-14 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                {t('ts.emptyPages')}
              </p>
            ) : (
            <div className="space-y-2">
              {pages.map((page, idx) => {
                const pageId = page.id || page.page_id;
                const asset = assetById(page.template_asset_id);
                const assetIdx = assetIndexById(page.template_asset_id);
                const hasDesc = !!page.description_content;
                const pageAutoMatchBlockReason = !hasDesc
                  ? t('ts.noDescHint')
                  : hasAnalyzingAssets
                    ? t('ts.waitForTemplates')
                    : !hasCompletedAsset
                      ? t('ts.needAnalyzedTemplate')
                      : null;
                const editingStyle = styleDraftPageId === pageId;
                const isAuto = page.template_selection_source === 'auto';
                const isManual = page.template_selection_source === 'manual';
                const confidencePct =
                  typeof page.template_match_confidence === 'number'
                    ? Math.round(page.template_match_confidence * 100)
                    : null;
                const title =
                  page.outline_content?.title || t('ts.page', { num: String(idx + 1) });
                return (
                  <div
                    key={pageId}
                    className={cn(
                      'rounded-card border bg-white p-3 transition-shadow duration-200 hover:shadow-sm dark:bg-background-secondary',
                      asset
                        ? 'border-gray-200 dark:border-gray-700'
                        : 'border-dashed border-amber-300/80 dark:border-amber-700/60'
                    )}
                    onMouseEnter={() => asset && setHoveredAssetId(asset.id)}
                    onMouseLeave={() => setHoveredAssetId(null)}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-100 text-xs font-semibold text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                        {idx + 1}
                      </span>
                      {asset ? (
                        <span className="relative shrink-0">
                          <img
                            src={getImageUrl(asset.thumb_url || asset.image_url)}
                            alt={asset.user_label || asset.id}
                            className="h-14 w-[88px] rounded-md object-cover ring-1 ring-black/5 dark:ring-white/10"
                          />
                          {assetIdx >= 0 && (
                            <span className="absolute left-1 top-1 rounded bg-black/65 px-1 text-[10px] font-semibold text-white backdrop-blur-sm">
                              #{assetIdx + 1}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="flex h-14 w-[88px] shrink-0 items-center justify-center rounded-md border border-dashed border-amber-300 bg-amber-50/50 text-[10px] font-medium text-amber-600 dark:border-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
                          {t('ts.unconfirmed')}
                        </span>
                      )}
                      <div className="min-w-0 flex-1 self-center">
                        <p className="truncate text-sm font-medium text-gray-800 dark:text-foreground-primary">
                          {title}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                          {isAuto && (
                            <span
                              className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400"
                              title={page.template_match_reason || undefined}
                            >
                              <Wand2 size={11} className="text-banana-600 dark:text-banana-400" />
                              {t('ts.autoMatched')}
                              {confidencePct !== null && (
                                <span className="font-medium">{confidencePct}%</span>
                              )}
                            </span>
                          )}
                          {isManual && asset && (
                            <span className="text-gray-500 dark:text-gray-400">
                              {t('ts.manualPicked')}
                            </span>
                          )}
                          {page.template_style_text && (
                            <span className="min-w-0 max-w-full truncate">
                              {t('ts.currentStyle')}: {page.template_style_text}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5 self-center">
                        <IconButton
                          size="sm"
                          variant="primary"
                          icon={<LayoutTemplate size={15} />}
                          label={t('ts.pickTemplate')}
                          onClick={() => setPickerPageId(pageId)}
                        />
                        <IconButton
                          size="sm"
                          icon={<Sparkles size={15} />}
                          label={pageAutoMatchBlockReason || t('ts.autoMatchPage')}
                          disabled={!!pageAutoMatchBlockReason}
                          loading={matchingPageId === pageId}
                          onClick={() => handleAutoMatchPage(pageId)}
                        />
                        <IconButton
                          size="sm"
                          icon={<PenLine size={15} />}
                          label={t('ts.editStyle')}
                          active={editingStyle}
                          onClick={() => {
                            setStyleDraftPageId(editingStyle ? null : pageId);
                            setStyleDraft(page.template_style_text || '');
                          }}
                        />
                      </div>
                    </div>
                    {editingStyle && (
                      <div className="mt-3 flex items-start gap-2">
                        <textarea
                          className="min-h-[44px] flex-1 resize-y rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-800 outline-none focus:border-banana-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                          placeholder={t('ts.stylePlaceholder')}
                          value={styleDraft}
                          onChange={(e) => setStyleDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveStyle(pageId);
                            }
                          }}
                          autoFocus
                        />
                        <Button variant="primary" size="sm" onClick={() => handleSaveStyle(pageId)}>
                          {t('ts.saveStyle')}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </section>
        </div>
      </main>

      <TemplatePickerModal
        isOpen={!!pickerPageId}
        onClose={() => setPickerPageId(null)}
        assets={templateAssets}
        currentAssetId={pickerPage?.template_asset_id}
        onSelect={(assetId) => (pickerPageId ? handlePickTemplate(pickerPageId, assetId) : undefined)}
        onUpload={projectId ? (file) => uploadTemplateAsset(projectId, file) : undefined}
      />

      <SwitchToSingleModeDialog
        isOpen={switchOpen}
        onClose={() => setSwitchOpen(false)}
        assets={templateAssets}
        onConfirmExisting={handleSwitchExisting}
        onConfirmUpload={handleSwitchUpload}
      />

      <ToastContainer />
      {ConfirmDialog}
    </div>
  );
};

export default TemplateSetupPage;
