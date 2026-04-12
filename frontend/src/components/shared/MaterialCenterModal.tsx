import React, { useReducer, useEffect, useCallback } from 'react';
import { ImageIcon, RefreshCw, Upload, Download, X, FolderOpen, Eye, ArrowUpDown } from 'lucide-react';
import { Button } from './Button';
import { useT } from '@/hooks/useT';
import { useToast } from './Toast';
import { Modal } from './Modal';
import { listMaterials, uploadMaterial, listProjects, deleteMaterial, downloadMaterialsZip, type Material } from '@/api/endpoints';
import type { Project } from '@/types';
import { getImageUrl } from '@/api/client';

// ---------------------------------------------------------------------------
// i18n
// ---------------------------------------------------------------------------
const i18nDict = {
  zh: {
    mc: {
      title: '素材中心',
      count: '共 {{count}} 个素材',
      empty: '暂无素材',
      selected: '已选 {{count}} 个',
      filterAll: '全部素材',
      filterNone: '未关联项目',
      moreProjects: '+ 更多项目…',
      preview: '预览',
      remove: '删除',
      closePreview: '关闭预览',
      emptyHint: '上传图片或通过素材生成功能创建素材',
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
      },
    },
  },
  en: {
    mc: {
      title: 'Material Center',
      count: '{{count}} materials',
      empty: 'No materials',
      selected: '{{count}} selected',
      filterAll: 'All Materials',
      filterNone: 'Unassociated',
      moreProjects: '+ More projects…',
      preview: 'Preview',
      remove: 'Delete',
      closePreview: 'Close Preview',
      emptyHint: 'Upload images or create materials via the generator',
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
      },
    },
  },
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
interface State {
  items: Material[];
  selected: Set<string>;
  deleting: Set<string>;
  loading: boolean;
  uploading: boolean;
  downloading: boolean;
  filter: string;
  sortBy: 'newest' | 'oldest' | 'name-asc' | 'name-desc';
  projects: Project[];
  projectsReady: boolean;
  preview: { url: string; label: string } | null;
}

type Action =
  | { type: 'SET_ITEMS'; items: Material[] }
  | { type: 'TOGGLE_SELECT'; key: string }
  | { type: 'SELECT_ALL'; keys: string[] }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_LOADING'; on: boolean }
  | { type: 'SET_UPLOADING'; on: boolean }
  | { type: 'SET_DOWNLOADING'; on: boolean }
  | { type: 'SET_FILTER'; value: string }
  | { type: 'SET_SORT'; value: State['sortBy'] }
  | { type: 'SET_PROJECTS'; list: Project[] }
  | { type: 'REMOVE_ITEM'; key: string }
  | { type: 'ADD_DELETING'; id: string }
  | { type: 'REMOVE_DELETING'; id: string }
  | { type: 'SET_PREVIEW'; preview: State['preview'] }
  | { type: 'RESET_EPHEMERAL' };

const initial: State = {
  items: [],
  selected: new Set(),
  deleting: new Set(),
  loading: false,
  uploading: false,
  downloading: false,
  filter: 'all',
  sortBy: 'newest',
  projects: [],
  projectsReady: false,
  preview: null,
};

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'SET_ITEMS':
      return { ...s, items: a.items, loading: false };
    case 'TOGGLE_SELECT': {
      const next = new Set(s.selected);
      next.has(a.key) ? next.delete(a.key) : next.add(a.key);
      return { ...s, selected: next };
    }
    case 'SELECT_ALL':
      return { ...s, selected: new Set(a.keys) };
    case 'CLEAR_SELECTION':
      return { ...s, selected: new Set() };
    case 'SET_LOADING':
      return { ...s, loading: a.on };
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

const projectLabel = (p: Project) => {
  const raw = p.idea_prompt || p.outline_text || `Project ${p.project_id.slice(0, 8)}`;
  return raw.length > 20 ? `${raw.slice(0, 20)}…` : raw;
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
const ToolbarSection: React.FC<{
  t: ReturnType<typeof useT>;
  state: State;
  dispatch: React.Dispatch<Action>;
  onRefresh: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDownload: () => void;
}> = ({ t, state, dispatch, onRefresh, onUpload, onDownload }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-foreground-tertiary">
        <FolderOpen size={16} className="text-banana-500" />
        <span>
          {state.items.length > 0
            ? t('mc.count', { count: state.items.length })
            : t('mc.empty')}
        </span>
        {state.selected.size > 0 && (
          <span className="ml-2 text-banana-600 font-medium">
            {t('mc.selected', { count: state.selected.size })}
          </span>
        )}
        {state.loading && state.items.length > 0 && (
          <RefreshCw size={14} className="animate-spin text-gray-400" />
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* 项目筛选下拉框 */}
        <select
          value={state.filter}
          onChange={(e) => dispatch({ type: 'SET_FILTER', value: e.target.value })}
          className="px-3 py-1.5 text-sm text-gray-700 dark:text-foreground-secondary bg-transparent hover:bg-gray-100 dark:hover:bg-background-hover rounded-md focus:outline-none transition-colors cursor-pointer"
        >
          <option value="all">{t('mc.filterAll')}</option>
          <option value="none">{t('mc.filterNone')}</option>
          {state.projects.map((p) => (
            <option key={p.project_id} value={p.project_id} title={p.idea_prompt || p.outline_text}>
              {projectLabel(p)}
            </option>
          ))}
        </select>

        {/* 排序循环按钮 */}
        <button
          onClick={() => {
            const order: Array<State['sortBy']> = ['newest', 'oldest', 'name-asc', 'name-desc'];
            const currentIndex = order.indexOf(state.sortBy);
            const nextIndex = (currentIndex + 1) % order.length;
            dispatch({ type: 'SET_SORT', value: order[nextIndex] });
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-foreground-secondary hover:bg-gray-100 dark:hover:bg-background-hover rounded-md transition-colors"
        >
          <ArrowUpDown size={14} />
          <span>
            {state.sortBy === 'newest' && '从新到旧'}
            {state.sortBy === 'oldest' && '从旧到新'}
            {state.sortBy === 'name-asc' && 'A-Z'}
            {state.sortBy === 'name-desc' && 'Z-A'}
          </span>
        </button>

        <Button variant="ghost" size="sm" icon={<RefreshCw size={16} />} onClick={onRefresh} disabled={state.loading}>
          {t('common.refresh')}
        </Button>

        <label className="inline-block cursor-pointer">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-foreground-secondary bg-white dark:bg-background-secondary border border-gray-300 dark:border-border-primary rounded-md hover:bg-gray-50 dark:hover:bg-background-hover disabled:opacity-50 disabled:cursor-not-allowed">
            <Upload size={16} />
            <span>{state.uploading ? t('common.uploading') : t('common.upload')}</span>
          </div>
          <input type="file" accept="image/*" onChange={onUpload} className="hidden" disabled={state.uploading} />
        </label>
      </div>
    </div>

    {state.items.length > 0 && (
      <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-background-primary rounded-lg">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            state.selected.size === state.items.length
              ? dispatch({ type: 'CLEAR_SELECTION' })
              : dispatch({ type: 'SELECT_ALL', keys: state.items.map((m) => m.id) })
          }
        >
          {state.selected.size === state.items.length ? t('common.deselectAll') : t('common.selectAll')}
        </Button>
        {state.selected.size > 0 && (
          <>
            <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'CLEAR_SELECTION' })}>
              {t('common.clearSelection')}
            </Button>
            <div className="flex-1" />
            <Button
              variant="primary"
              size="sm"
              icon={<Download size={16} />}
              onClick={onDownload}
              disabled={state.downloading}
            >
              {state.downloading ? t('common.downloading') : `${t('common.download')} (${state.selected.size})`}
            </Button>
          </>
        )}
      </div>
    )}
  </div>
);

const MaterialGrid: React.FC<{
  items: Material[];
  selected: Set<string>;
  deleting: Set<string>;
  t: ReturnType<typeof useT>;
  onToggle: (id: string) => void;
  onPreview: (e: React.MouseEvent, m: Material) => void;
  onDelete: (e: React.MouseEvent<HTMLButtonElement>, m: Material) => void;
}> = ({ items, selected, deleting, t, onToggle, onPreview, onDelete }) => (
  <div className="grid grid-cols-4 gap-4 max-h-96 overflow-y-auto p-4">
    {items.map((m) => {
      const sel = selected.has(m.id);
      const busy = deleting.has(m.id);
      return (
        <div
          key={m.id}
          onClick={() => onToggle(m.id)}
          className={`aspect-video rounded-lg border-2 cursor-pointer transition-all relative group ${
            sel ? 'border-banana-500 ring-2 ring-banana-200' : 'border-gray-200 dark:border-border-primary hover:border-banana-300'
          }`}
        >
          <img src={getImageUrl(m.url)} alt={displayName(m)} className="absolute inset-0 w-full h-full object-cover rounded-md" />

          <button
            type="button"
            onClick={(e) => onPreview(e, m)}
            className="absolute top-1 left-1 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow z-10 hover:bg-black/80"
            aria-label={t('mc.preview')}
          >
            <Eye size={12} />
          </button>

          <button
            type="button"
            onClick={(e) => onDelete(e, m)}
            disabled={busy}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow z-10 disabled:opacity-60 disabled:cursor-not-allowed"
            aria-label={t('mc.remove')}
          >
            {busy ? <RefreshCw size={12} className="animate-spin" /> : <X size={12} />}
          </button>

          {sel && (
            <div className="absolute inset-0 bg-banana-500 bg-opacity-20 flex items-center justify-center rounded-md">
              <div className="bg-banana-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">✓</div>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity rounded-b-md">
            {displayName(m)}
          </div>
        </div>
      );
    })}
  </div>
);

const PreviewOverlay: React.FC<{ url: string; label: string; t: ReturnType<typeof useT>; onClose: () => void }> = ({
  url,
  label,
  t,
  onClose,
}) => (
  <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]" onClick={onClose}>
    <div className="relative max-w-[90vw] max-h-[90vh]">
      <button
        type="button"
        onClick={onClose}
        className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
        aria-label={t('mc.closePreview')}
      >
        <X size={24} />
      </button>
      <img src={url} alt={label} className="max-w-full max-h-[85vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
      <div className="text-center text-white text-sm mt-2 truncate max-w-[90vw]">{label}</div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
interface MaterialCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MaterialCenterModal: React.FC<MaterialCenterModalProps> = ({ isOpen, onClose }) => {
  const t = useT(i18nDict);
  const { show } = useToast();
  const [s, dispatch] = useReducer(reducer, initial);

  const fetchItems = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', on: true });
    try {
      const target = s.filter === 'all' ? 'all' : s.filter === 'none' ? 'none' : s.filter;
      const res = await listMaterials(target);
      dispatch({ type: 'SET_ITEMS', items: res.data?.materials ?? [] });
    } catch (err: any) {
      dispatch({ type: 'SET_LOADING', on: false });
      show({ message: err?.response?.data?.error?.message || err.message || t('mc.msg.loadErr'), type: 'error' });
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
      show({ message: t('mc.msg.badFormat'), type: 'error' });
      return;
    }
    dispatch({ type: 'SET_UPLOADING', on: true });
    try {
      const pid = s.filter === 'all' || s.filter === 'none' ? null : s.filter;
      await uploadMaterial(file, pid, true);
      show({ message: t('mc.msg.uploaded'), type: 'success' });
      fetchItems();
    } catch (err: any) {
      show({ message: err?.response?.data?.error?.message || err.message || t('mc.msg.uploadErr'), type: 'error' });
    } finally {
      dispatch({ type: 'SET_UPLOADING', on: false });
      e.target.value = '';
    }
  };

  const handleDelete = async (e: React.MouseEvent<HTMLButtonElement>, m: Material) => {
    e.stopPropagation();
    if (!m.id) {
      show({ message: t('mc.msg.noId'), type: 'error' });
      return;
    }
    dispatch({ type: 'ADD_DELETING', id: m.id });
    try {
      await deleteMaterial(m.id);
      dispatch({ type: 'REMOVE_ITEM', key: m.id });
      show({ message: t('mc.msg.deleted'), type: 'success' });
    } catch (err: any) {
      show({ message: err?.response?.data?.error?.message || err.message || t('mc.msg.deleteErr'), type: 'error' });
    } finally {
      dispatch({ type: 'REMOVE_DELETING', id: m.id });
    }
  };

  const handleDownload = async () => {
    if (s.selected.size === 0) {
      show({ message: t('mc.msg.pickFirst'), type: 'info' });
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
        show({ message: t('mc.msg.downloaded'), type: 'success' });
      } catch (err) {
        console.error('Download failed:', err);
        show({ message: t('mc.msg.downloadErr'), type: 'error' });
      }
      return;
    }

    dispatch({ type: 'SET_DOWNLOADING', on: true });
    try {
      await downloadMaterialsZip(chosen.map((m) => m.id));
      show({ message: t('mc.msg.zipped', { count: chosen.length }), type: 'success' });
    } catch (err: any) {
      show({ message: err?.response?.data?.error?.message || err.message || t('mc.msg.zipErr'), type: 'error' });
    } finally {
      dispatch({ type: 'SET_DOWNLOADING', on: false });
    }
  };

  const handlePreview = (e: React.MouseEvent, m: Material) => {
    e.stopPropagation();
    dispatch({ type: 'SET_PREVIEW', preview: { url: getImageUrl(m.url), label: displayName(m) } });
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
      <Modal isOpen={isOpen} onClose={onClose} title={t('mc.title')} size="lg">
        <div className="space-y-4">
          <ToolbarSection t={t} state={s} dispatch={dispatch} onRefresh={fetchItems} onUpload={handleUpload} onDownload={handleDownload} />

          {s.loading && s.items.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-400">{t('common.loading')}</div>
            </div>
          ) : s.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 p-4">
              <ImageIcon size={48} className="mb-4 opacity-50" />
              <div className="text-sm">{t('mc.empty')}</div>
              <div className="text-xs mt-1">{t('mc.emptyHint')}</div>
            </div>
          ) : (
            <MaterialGrid
              items={sortedItems}
              selected={s.selected}
              deleting={s.deleting}
              t={t}
              onToggle={(id) => dispatch({ type: 'TOGGLE_SELECT', key: id })}
              onPreview={handlePreview}
              onDelete={handleDelete}
            />
          )}

          <div className="pt-4 border-t flex justify-end">
            <Button variant="ghost" onClick={onClose}>
              {t('common.close')}
            </Button>
          </div>
        </div>
      </Modal>

      {s.preview && (
        <PreviewOverlay
          url={s.preview.url}
          label={s.preview.label}
          t={t}
          onClose={() => dispatch({ type: 'SET_PREVIEW', preview: null })}
        />
      )}
    </>
  );
};
