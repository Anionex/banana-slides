import React, { useReducer, useEffect, useCallback, useState } from 'react';
import { ImageIcon, Upload, Download, X, FolderOpen, Eye, ArrowUpDown, Sparkles } from 'lucide-react';
import { Button } from './Button';
import { useT } from '@/hooks/useT';
import { useToast } from './Toast';
import { Modal } from './Modal';
import { listMaterials, uploadMaterial, listProjects, deleteMaterial, downloadMaterialsZip, type Material } from '@/api/endpoints';
import type { Project } from '@/types';
import { getImageUrl } from '@/api/client';
import { getProjectTitleTruncated } from '@/utils/projectUtils';
import { MaterialGeneratorModal } from './MaterialGeneratorModal';

// ---------------------------------------------------------------------------
// i18n - 合并两个组件的翻译
// ---------------------------------------------------------------------------
const i18nDict = {
  zh: {
    title: { select: '选择素材', manage: '素材中心' },
    count: '共 {{count}} 个素材',
    empty: '暂无素材',
    selected: '已选 {{count}} 个',
    filterAll: '全部素材',
    filterNone: '未关联项目',
    currentProject: '当前项目',
    moreProjects: '+ 更多项目…',
    preview: '预览',
    remove: '删除',
    closePreview: '关闭预览',
    emptyHint: { select: '可以上传图片或通过素材生成功能创建素材', manage: '上传图片或通过素材生成功能创建素材' },
    emptyHintNoProject: '可以上传图片作为素材',
    generateMaterial: '生成素材',
    saveToLibrary: '保存到素材库',
    msg: {
      loadErr: '加载素材失败',
      badFormat: '不支持的图片格式',
      uploaded: '素材上传成功',
      uploadErr: '上传素材失败',
      noId: '无法删除：缺少素材ID',
      deleted: '素材已删除',
      deleteErr: '删除素材失败',
      downloaded: '下载成功',
      downloadErr: '下载失败',
      zipped: '已打包 {{count}} 个素材',
      zipErr: '批量下载失败',
      pickFirst: '请先选择要下载的素材',
      selectAtLeastOne: '请至少选择一个素材',
      maxSelection: '最多只能选择 {{count}} 个素材',
    },
  },
  en: {
    title: { select: 'Select Material', manage: 'Material Center' },
    count: '{{count}} materials',
    empty: 'No materials',
    selected: '{{count}} selected',
    filterAll: 'All Materials',
    filterNone: 'Unassociated',
    currentProject: 'Current Project',
    moreProjects: '+ More projects…',
    preview: 'Preview',
    remove: 'Delete',
    closePreview: 'Close Preview',
    emptyHint: { select: 'You can upload images or create materials through the material generator', manage: 'Upload images or create materials via the generator' },
    emptyHintNoProject: 'You can upload images as materials',
    generateMaterial: 'Generate Material',
    saveToLibrary: 'Save to library',
    msg: {
      loadErr: 'Failed to load materials',
      badFormat: 'Unsupported image format',
      uploaded: 'Material uploaded',
      uploadErr: 'Failed to upload material',
      noId: 'Cannot delete: missing material ID',
      deleted: 'Material deleted',
      deleteErr: 'Failed to delete material',
      downloaded: 'Download complete',
      downloadErr: 'Download failed',
      zipped: 'Packaged {{count}} materials',
      zipErr: 'Batch download failed',
      pickFirst: 'Select materials to download first',
      selectAtLeastOne: 'Please select at least one material',
      maxSelection: 'Maximum {{count}} materials can be selected',
    },
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface MaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'select' | 'manage';
  projectId?: string;
  // 选择模式专用
  onSelect?: (materials: Material[], saveAsTemplate?: boolean) => void;
  multiple?: boolean;
  maxSelection?: number;
  showSaveAsTemplateOption?: boolean;
}

interface State {
  items: Material[];
  selected: Set<string>;
  deleting: Set<string>;
  uploading: boolean;
  downloading: boolean;
  filter: string;
  sortBy: 'newest' | 'oldest' | 'name-asc' | 'name-desc';
  projects: Project[];
  projectsReady: boolean;
  preview: { url: string; label: string } | null;
  showAllProjects: boolean;
}

type Action =
  | { type: 'SET_ITEMS'; items: Material[] }
  | { type: 'TOGGLE_SELECT'; key: string }
  | { type: 'SELECT_ALL'; keys: string[] }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_UPLOADING'; on: boolean }
  | { type: 'SET_DOWNLOADING'; on: boolean }
  | { type: 'SET_FILTER'; value: string }
  | { type: 'SET_SORT'; value: State['sortBy'] }
  | { type: 'SET_PROJECTS'; list: Project[] }
  | { type: 'REMOVE_ITEM'; key: string }
  | { type: 'ADD_DELETING'; id: string }
  | { type: 'REMOVE_DELETING'; id: string }
  | { type: 'SET_PREVIEW'; preview: State['preview'] }
  | { type: 'SET_SHOW_ALL_PROJECTS'; show: boolean }
  | { type: 'RESET_EPHEMERAL' };

const initial: State = {
  items: [],
  selected: new Set(),
  deleting: new Set(),
  uploading: false,
  downloading: false,
  filter: 'all',
  sortBy: 'newest',
  projects: [],
  projectsReady: false,
  preview: null,
  showAllProjects: false,
};

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'SET_ITEMS':
      return { ...s, items: a.items };
    case 'TOGGLE_SELECT': {
      const next = new Set(s.selected);
      next.has(a.key) ? next.delete(a.key) : next.add(a.key);
      return { ...s, selected: next };
    }
    case 'SELECT_ALL':
      return { ...s, selected: new Set(a.keys) };
    case 'CLEAR_SELECTION':
      return { ...s, selected: new Set() };
    case 'SET_UPLOADING':
      return { ...s, uploading: a.on };
    case 'SET_DOWNLOADING':
      return { ...s, downloading: a.on };
    case 'SET_FILTER':
      return { ...s, filter: a.value };
    case 'SET_SORT':
      return { ...s, sortBy: a.value };
    case 'SET_PROJECTS':
      return { ...s, projects: a.list, projectsReady: true };
    case 'REMOVE_ITEM': {
      const items = s.items.filter((m) => m.id !== a.key);
      const selected = new Set(s.selected);
      selected.delete(a.key);
      return { ...s, items, selected };
    }
    case 'ADD_DELETING': {
      const d = new Set(s.deleting);
      d.add(a.id);
      return { ...s, deleting: d };
    }
    case 'REMOVE_DELETING': {
      const d = new Set(s.deleting);
      d.delete(a.id);
      return { ...s, deleting: d };
    }
    case 'SET_PREVIEW':
      return { ...s, preview: a.preview };
    case 'SET_SHOW_ALL_PROJECTS':
      return { ...s, showAllProjects: a.show };
    case 'RESET_EPHEMERAL':
      return { ...s, selected: new Set(), showAllProjects: false, preview: null };
    default:
      return s;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const displayName = (m: Material) =>
  m.prompt?.trim() ||
  m.name?.trim() ||
  m.original_filename?.trim() ||
  m.source_filename?.trim() ||
  m.filename ||
  m.url;

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export const MaterialModal: React.FC<MaterialModalProps> = ({
  isOpen,
  onClose,
  mode = 'manage',
  projectId,
  onSelect,
  multiple = false,
  maxSelection,
  showSaveAsTemplateOption = false,
}) => {
  const t = useT(i18nDict);
  const { show } = useToast();
  const [s, dispatch] = useReducer(reducer, initial);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState(true);

  const fetchItems = useCallback(async () => {
    try {
      const target = s.filter === 'all' ? 'all' : s.filter === 'none' ? 'none' : s.filter;
      const res = await listMaterials(target);
      dispatch({ type: 'SET_ITEMS', items: res.data?.materials ?? [] });
    } catch (err: any) {
      show({ message: err?.response?.data?.error?.message || err.message || t('msg.loadErr'), type: 'error' });
    }
  }, [s.filter, show, t]);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await listProjects(100, 0);
      if (res.data?.projects) dispatch({ type: 'SET_PROJECTS', list: res.data.projects });
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (!s.projectsReady) fetchProjects();
    fetchItems();
    dispatch({ type: 'RESET_EPHEMERAL' });
  }, [isOpen, s.filter]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      show({ message: t('msg.badFormat'), type: 'error' });
      return;
    }
    dispatch({ type: 'SET_UPLOADING', on: true });
    try {
      const pid = s.filter === 'all' || s.filter === 'none' ? null : s.filter;
      await uploadMaterial(file, pid);
      show({ message: t('msg.uploaded'), type: 'success' });
      fetchItems();
    } catch (err: any) {
      show({ message: err?.response?.data?.error?.message || err.message || t('msg.uploadErr'), type: 'error' });
    } finally {
      dispatch({ type: 'SET_UPLOADING', on: false });
      e.target.value = '';
    }
  };

  const handleDelete = async (e: React.MouseEvent<HTMLButtonElement>, m: Material) => {
    e.stopPropagation();
    if (!m.id) {
      show({ message: t('msg.noId'), type: 'error' });
      return;
    }
    dispatch({ type: 'ADD_DELETING', id: m.id });
    try {
      await deleteMaterial(m.id);
      dispatch({ type: 'REMOVE_ITEM', key: m.id });
      show({ message: t('msg.deleted'), type: 'success' });
    } catch (err: any) {
      show({ message: err?.response?.data?.error?.message || err.message || t('msg.deleteErr'), type: 'error' });
    } finally {
      dispatch({ type: 'REMOVE_DELETING', id: m.id });
    }
  };

  const handleDownload = async () => {
    if (s.selected.size === 0) {
      show({ message: t('msg.pickFirst'), type: 'info' });
      return;
    }
    const chosen = s.items.filter((m) => s.selected.has(m.id));

    if (chosen.length === 1) {
      try {
        const blob = await fetch(getImageUrl(chosen[0].url)).then((r) => r.blob());
        const href = URL.createObjectURL(blob);
        const link = Object.assign(document.createElement('a'), {
          href,
          download: chosen[0].filename || 'material.png',
        });
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(href);
        show({ message: t('msg.downloaded'), type: 'success' });
      } catch (err) {
        console.error('Download failed:', err);
        show({ message: t('msg.downloadErr'), type: 'error' });
      }
      return;
    }

    dispatch({ type: 'SET_DOWNLOADING', on: true });
    try {
      await downloadMaterialsZip(chosen.map((m) => m.id));
      show({ message: t('msg.zipped', { count: chosen.length }), type: 'success' });
    } catch (err: any) {
      show({ message: err?.response?.data?.error?.message || err.message || t('msg.zipErr'), type: 'error' });
    } finally {
      dispatch({ type: 'SET_DOWNLOADING', on: false });
    }
  };

  const handlePreview = (e: React.MouseEvent, m: Material) => {
    e.stopPropagation();
    dispatch({ type: 'SET_PREVIEW', preview: { url: getImageUrl(m.url), label: displayName(m) } });
  };

  const handleSelectMaterial = (material: Material) => {
    const key = material.id;
    if (multiple) {
      const newSelected = new Set(s.selected);
      if (newSelected.has(key)) {
        newSelected.delete(key);
      } else {
        if (maxSelection && newSelected.size >= maxSelection) {
          show({ message: t('msg.maxSelection', { count: maxSelection }), type: 'info' });
          return;
        }
        newSelected.add(key);
      }
      dispatch({ type: 'TOGGLE_SELECT', key });
    } else {
      dispatch({ type: 'CLEAR_SELECTION' });
      dispatch({ type: 'TOGGLE_SELECT', key });
    }
  };

  const handleConfirm = () => {
    const selected = s.items.filter((m) => s.selected.has(m.id));
    if (selected.length === 0) {
      show({ message: t('msg.selectAtLeastOne'), type: 'info' });
      return;
    }
    onSelect?.(selected, showSaveAsTemplateOption ? saveAsTemplate : undefined);
    onClose();
  };

  const sortedItems = [...s.items].sort((a, b) => {
    switch (s.sortBy) {
      case 'newest':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case 'oldest':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case 'name-asc':
        return displayName(a).localeCompare(displayName(b));
      case 'name-desc':
        return displayName(b).localeCompare(displayName(a));
      default:
        return 0;
    }
  });

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={t(`title.${mode}`)} size="lg">
        <div className="space-y-4">
          {/* 工具栏 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-foreground-tertiary">
                <FolderOpen size={16} className="text-banana-500" />
                <span>
                  {s.items.length > 0 ? t('count', { count: s.items.length }) : t('empty')}
                </span>
                {s.selected.size > 0 && (
                  <span className="ml-2 text-banana-600 font-medium">
                    {t('selected', { count: s.selected.size })}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* 项目筛选 */}
                <select
                  value={s.filter}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'show_more') {
                      dispatch({ type: 'SET_SHOW_ALL_PROJECTS', show: true });
                      return;
                    }
                    dispatch({ type: 'SET_FILTER', value });
                  }}
                  className="px-3 py-1.5 text-sm text-gray-700 dark:text-foreground-secondary bg-transparent hover:bg-gray-100 dark:hover:bg-background-hover rounded-md focus:outline-none transition-colors cursor-pointer"
                >
                  <option value="all">{t('filterAll')}</option>
                  <option value="none">{t('filterNone')}</option>
                  {projectId && (
                    <option value={projectId}>
                      {t('currentProject')}{s.projects.find(p => p.project_id === projectId) ? `: ${getProjectTitleTruncated(s.projects.find(p => p.project_id === projectId)!, 30)}` : ''}
                    </option>
                  )}
                  {s.showAllProjects ? (
                    <>
                      <option disabled>───────────</option>
                      {s.projects.filter(p => p.project_id !== projectId).map((p) => (
                        <option key={p.project_id} value={p.project_id} title={p.idea_prompt || p.outline_text}>
                          {getProjectTitleTruncated(p, 30)}
                        </option>
                      ))}
                    </>
                  ) : (
                    s.projects.length > (projectId ? 1 : 0) && (
                      <option value="show_more">{t('moreProjects')}</option>
                    )
                  )}
                </select>

                {/* 排序 */}
                <button
                  onClick={() => {
                    const order: Array<State['sortBy']> = ['newest', 'oldest', 'name-asc', 'name-desc'];
                    const currentIndex = order.indexOf(s.sortBy);
                    const nextIndex = (currentIndex + 1) % order.length;
                    dispatch({ type: 'SET_SORT', value: order[nextIndex] });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-foreground-secondary hover:bg-gray-100 dark:hover:bg-background-hover rounded-md transition-colors"
                >
                  <ArrowUpDown size={14} />
                  <span>
                    {s.sortBy === 'newest' && '从新到旧'}
                    {s.sortBy === 'oldest' && '从旧到新'}
                    {s.sortBy === 'name-asc' && 'A-Z'}
                    {s.sortBy === 'name-desc' && 'Z-A'}
                  </span>
                </button>

                {/* 上传 */}
                <label className="inline-block cursor-pointer">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-foreground-secondary bg-white dark:bg-background-secondary border border-gray-300 dark:border-border-primary rounded-md hover:bg-gray-50 dark:hover:bg-background-hover disabled:opacity-50 disabled:cursor-not-allowed">
                    <Upload size={16} />
                    <span>{s.uploading ? t('common.uploading') : t('common.upload')}</span>
                  </div>
                  <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={s.uploading} />
                </label>

                {/* 生成素材（仅选择模式且有projectId） */}
                {mode === 'select' && projectId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Sparkles size={16} />}
                    onClick={() => setIsGeneratorOpen(true)}
                  >
                    {t('generateMaterial')}
                  </Button>
                )}
              </div>
            </div>

            {/* 批量操作 */}
            {s.items.length > 0 && (mode === 'manage' || s.selected.size > 0) && (
              <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-background-primary rounded-lg">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    s.selected.size === s.items.length
                      ? dispatch({ type: 'CLEAR_SELECTION' })
                      : dispatch({ type: 'SELECT_ALL', keys: s.items.map((m) => m.id) })
                  }
                >
                  {s.selected.size === s.items.length ? t('common.deselectAll') : t('common.selectAll')}
                </Button>
                {s.selected.size > 0 && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'CLEAR_SELECTION' })}>
                      {t('common.clearSelection')}
                    </Button>
                    {mode === 'manage' && (
                      <>
                        <div className="flex-1" />
                        <Button
                          variant="primary"
                          size="sm"
                          icon={<Download size={16} />}
                          onClick={handleDownload}
                          disabled={s.downloading}
                        >
                          {s.downloading ? t('common.downloading') : `${t('common.download')} (${s.selected.size})`}
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* 素材网格 */}
          {s.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 p-4">
              <ImageIcon size={48} className="mb-4 opacity-50" />
              <div className="text-sm">{t('empty')}</div>
              <div className="text-xs mt-1">
                {projectId ? t(`emptyHint.${mode}`) : t('emptyHintNoProject')}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4 max-h-96 overflow-y-auto p-4">
              {sortedItems.map((material) => {
                const isSelected = s.selected.has(material.id);
                const isDeleting = s.deleting.has(material.id);
                return (
                  <div
                    key={material.id}
                    onClick={() => handleSelectMaterial(material)}
                    className={`aspect-video rounded-lg border-2 cursor-pointer transition-all relative group ${
                      isSelected
                        ? 'border-banana-500 ring-2 ring-banana-200'
                        : 'border-gray-200 dark:border-border-primary hover:border-banana-300'
                    }`}
                  >
                    <img
                      src={getImageUrl(material.url)}
                      alt={displayName(material)}
                      className="absolute inset-0 w-full h-full object-cover rounded-md"
                    />

                    {/* 预览按钮 */}
                    <button
                      type="button"
                      onClick={(e) => handlePreview(e, material)}
                      className="absolute top-1 left-1 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow z-10 hover:bg-black/80"
                      aria-label={t('preview')}
                    >
                      <Eye size={12} />
                    </button>

                    {/* 删除按钮 */}
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, material)}
                      disabled={isDeleting}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow z-10 disabled:opacity-60 disabled:cursor-not-allowed"
                      aria-label={t('remove')}
                    >
                      <X size={12} />
                    </button>

                    {/* 选中标记 */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-banana-500 bg-opacity-20 flex items-center justify-center rounded-md">
                        <div className="bg-banana-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                          ✓
                        </div>
                      </div>
                    )}

                    {/* 名称 */}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity rounded-b-md">
                      {displayName(material)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 底部按钮 */}
          <div className="pt-4 border-t">
            {mode === 'select' && showSaveAsTemplateOption && (
              <div className="mb-3 p-3 bg-gray-50 dark:bg-background-primary rounded-lg border border-gray-200 dark:border-border-primary">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAsTemplate}
                    onChange={(e) => setSaveAsTemplate(e.target.checked)}
                    className="w-4 h-4 text-banana-500 border-gray-300 dark:border-border-primary rounded focus:ring-banana-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-foreground-secondary">
                    {t('saveToLibrary')}
                  </span>
                </label>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={onClose}>
                {t('common.close')}
              </Button>
              {mode === 'select' && (
                <Button
                  variant="primary"
                  onClick={handleConfirm}
                  disabled={s.selected.size === 0}
                >
                  {t('common.confirm')} ({s.selected.size})
                </Button>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* 预览覆盖层 */}
      {s.preview && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]" onClick={() => dispatch({ type: 'SET_PREVIEW', preview: null })}>
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_PREVIEW', preview: null })}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
              aria-label={t('closePreview')}
            >
              <X size={24} />
            </button>
            <img src={s.preview.url} alt={s.preview.label} className="max-w-full max-h-[85vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
            <div className="text-center text-white text-sm mt-2 truncate max-w-[90vw]">{s.preview.label}</div>
          </div>
        </div>
      )}

      {/* 素材生成器 */}
      {projectId && (
        <MaterialGeneratorModal
          projectId={projectId}
          isOpen={isGeneratorOpen}
          onClose={() => {
            setIsGeneratorOpen(false);
            fetchItems();
          }}
        />
      )}
    </>
  );
};

// 工具函数：将素材转换为 File 对象
export const materialUrlToFile = async (
  material: Material,
  filename?: string
): Promise<File> => {
  const imageUrl = getImageUrl(material.url);
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  const file = new File(
    [blob],
    filename || material.filename,
    { type: blob.type || 'image/png' }
  );
  return file;
};

