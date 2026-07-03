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
} from 'lucide-react';
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
      emptyLibrary: '模板库为空，上传图片或 PDF 开始',
      emptyPages: '暂无页面，先在大纲或描述编辑器生成页面',
      labelPlaceholder: '模板标记（可选）',
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
      deletedCleared: '已删除模板，{{count}} 个页面被重置为未确认',
      saved: '已保存',
      matchDone: '自动匹配完成',
      matchFailed: '自动匹配失败',
      loading: '加载中…',
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
      emptyLibrary: 'Library is empty, upload an image or PDF to start',
      emptyPages: 'No pages yet — generate them in the outline or description editor',
      labelPlaceholder: 'Template label (optional)',
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
      deletedCleared: 'Template deleted, {{count}} page(s) reset to unconfirmed',
      saved: 'Saved',
      matchDone: 'Auto-match completed',
      matchFailed: 'Auto-match failed',
      loading: 'Loading…',
    },
  },
};

const statusClass: Record<TemplateAsset['analysis_status'], string> = {
  pending: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
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
  const [switchOpen, setSwitchOpen] = useState(false);

  // 加载项目 + 模板库
  useEffect(() => {
    if (!projectId) return;
    if (!currentProject || currentProject.id !== projectId) {
      syncProject(projectId);
    }
    loadTemplateAssets(projectId);
  }, [projectId, currentProject?.id]);

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
    try {
      const taskId = await autoMatchPage(projectId, pageId);
      await pollTemplateTask(taskId, projectId);
      await syncProject(projectId);
    } catch {
      show({ message: t('ts.matchFailed'), type: 'error' });
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
              <span className="text-xl md:text-2xl">🍌</span>
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
            <Button
              variant="secondary"
              size="sm"
              icon={<Sparkles size={16} />}
              loading={matchingAll}
              onClick={handleAutoMatchAll}
            >
              <span className="hidden sm:inline">
                {matchingAll ? t('ts.matching') : t('ts.autoMatchAll')}
              </span>
            </Button>
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

      {matchTask && (
        <div className="px-3 md:px-6 pt-3">
          <TemplateMatchProgress task={matchTask} />
        </div>
      )}

      <main className="flex-1 p-3 md:p-6 overflow-y-auto min-h-0">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 lg:grid-cols-2">
          {/* 左栏：模板库 */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-foreground-secondary">
                {t('ts.library')}
              </h2>
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
              <p className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                {t('ts.emptyLibrary')}
              </p>
            ) : (
              <div className="space-y-3">
                {templateAssets.map((asset) => {
                  const expanded = expandedAssetId === asset.id;
                  return (
                    <div
                      key={asset.id}
                      className={cn(
                        'rounded-xl border p-3',
                        asset.analysis_status === 'failed'
                          ? 'border-red-300 dark:border-red-700'
                          : 'border-gray-200 dark:border-gray-700'
                      )}
                    >
                      <div className="flex gap-3">
                        <img
                          src={getImageUrl(asset.thumb_url || asset.image_url)}
                          alt={asset.user_label || asset.id}
                          className="h-20 w-28 flex-shrink-0 rounded-lg object-cover"
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <input
                              className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-xs font-medium text-gray-800 outline-none transition-colors hover:border-gray-200 hover:bg-white focus:border-banana-500 focus:bg-white dark:text-gray-100 dark:hover:border-gray-700 dark:hover:bg-gray-800 dark:focus:bg-gray-800"
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
                            <span
                              className={cn(
                                'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                                statusClass[asset.analysis_status]
                              )}
                            >
                              {t(`ts.status${asset.analysis_status.charAt(0).toUpperCase()}${asset.analysis_status.slice(1)}`)}
                            </span>
                          </div>
                          <div className="mt-auto flex items-center gap-0.5">
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
                              className="ml-auto"
                              onClick={() => handleDeleteAsset(asset.id)}
                            />
                          </div>
                        </div>
                      </div>

                      {expanded && (
                        <div className="mt-3">
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
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-foreground-secondary">
              {t('ts.pages')}
            </h2>
            {pages.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                {t('ts.emptyPages')}
              </p>
            ) : (
            <div className="space-y-2">
              {pages.map((page, idx) => {
                const pageId = page.id || page.page_id;
                const asset = assetById(page.template_asset_id);
                const hasDesc = !!page.description_content;
                const editingStyle = styleDraftPageId === pageId;
                const title =
                  page.outline_content?.title || t('ts.page', { num: String(idx + 1) });
                return (
                  <div
                    key={pageId}
                    className="rounded-xl border border-gray-200 p-3 dark:border-gray-700"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                        {idx + 1}
                      </span>
                      {asset ? (
                        <img
                          src={getImageUrl(asset.thumb_url || asset.image_url)}
                          alt={asset.user_label || asset.id}
                          className="h-12 w-16 shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md border border-dashed border-gray-300 text-[10px] text-gray-400 dark:border-gray-600">
                          {t('ts.unconfirmed')}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-800 dark:text-foreground-secondary">
                          {title}
                        </p>
                        {page.template_style_text && (
                          <p className="truncate text-xs text-gray-400">
                            {t('ts.currentStyle')}: {page.template_style_text}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
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
                          label={hasDesc ? t('ts.autoMatchPage') : t('ts.noDescHint')}
                          disabled={!hasDesc}
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
