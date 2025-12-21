import React, { useState, useEffect } from 'react';
import { ImageIcon, RefreshCw, Upload, Download, X, FolderOpen, Eye } from 'lucide-react';
import { Button } from './Button';
import { useToast } from './Toast';
import { Modal } from './Modal';
import { listMaterials, uploadMaterial, listProjects, deleteMaterial, downloadMaterialsZip, type Material } from '@/api/endpoints';
import type { Project } from '@/types';
import { getImageUrl } from '@/api/client';

interface MaterialCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 素材中心组件
 * - 浏览所有素材
 * - 支持批量选择
 * - 支持单个或批量下载（多个打包为zip）
 * - 支持按项目筛选
 * - 支持上传和删除素材
 * - 支持预览图片
 */
export const MaterialCenterModal: React.FC<MaterialCenterModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { show } = useToast();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [filterProjectId, setFilterProjectId] = useState<string>('all');
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (!projectsLoaded) {
        loadProjects();
      }
      loadMaterials();
      setShowAllProjects(false);
      setSelectedMaterials(new Set());
    }
  }, [isOpen, filterProjectId, projectsLoaded]);

  const loadProjects = async () => {
    try {
      const response = await listProjects(100, 0);
      if (response.data?.projects) {
        setProjects(response.data.projects);
        setProjectsLoaded(true);
      }
    } catch (error: any) {
      console.error('加载项目列表失败:', error);
    }
  };

  const getMaterialKey = (m: Material): string => m.id;
  const getMaterialDisplayName = (m: Material) =>
    (m.prompt && m.prompt.trim()) ||
    (m.name && m.name.trim()) ||
    (m.original_filename && m.original_filename.trim()) ||
    (m.source_filename && m.source_filename.trim()) ||
    m.filename ||
    m.url;

  const loadMaterials = async () => {
    setIsLoading(true);
    try {
      const targetProjectId = filterProjectId === 'all' ? 'all' : filterProjectId === 'none' ? 'none' : filterProjectId;
      const response = await listMaterials(targetProjectId);
      if (response.data?.materials) {
        setMaterials(response.data.materials);
      }
    } catch (error: any) {
      console.error('加载素材列表失败:', error);
      show({
        message: error?.response?.data?.error?.message || error.message || '加载素材列表失败',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectMaterial = (material: Material) => {
    const key = getMaterialKey(material);
    const newSelected = new Set(selectedMaterials);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedMaterials(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedMaterials.size === materials.length) {
      // 全部取消选择
      setSelectedMaterials(new Set());
    } else {
      // 全选
      setSelectedMaterials(new Set(materials.map(m => getMaterialKey(m))));
    }
  };

  const handleClear = () => {
    setSelectedMaterials(new Set());
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      show({ message: '不支持的图片格式', type: 'error' });
      return;
    }

    setIsUploading(true);
    try {
      const targetProjectId = (filterProjectId === 'all' || filterProjectId === 'none')
        ? null
        : filterProjectId;

      const response = await uploadMaterial(file, targetProjectId);

      if (response.data) {
        show({ message: '素材上传成功', type: 'success' });
        loadMaterials();
      }
    } catch (error: any) {
      console.error('上传素材失败:', error);
      show({
        message: error?.response?.data?.error?.message || error.message || '上传素材失败',
        type: 'error',
      });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteMaterial = async (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    material: Material
  ) => {
    e.stopPropagation();
    const materialId = material.id;
    const key = getMaterialKey(material);

    if (!materialId) {
      show({ message: '无法删除：缺少素材ID', type: 'error' });
      return;
    }

    setDeletingIds((prev) => {
      const next = new Set(prev);
      next.add(materialId);
      return next;
    });

    try {
      await deleteMaterial(materialId);
      setMaterials((prev) => prev.filter((m) => getMaterialKey(m) !== key));
      setSelectedMaterials((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      show({ message: '素材已删除', type: 'success' });
    } catch (error: any) {
      console.error('删除素材失败:', error);
      show({
        message: error?.response?.data?.error?.message || error.message || '删除素材失败',
        type: 'error',
      });
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(materialId);
        return next;
      });
    }
  };

  // 下载选中的素材
  const handleDownload = async () => {
    if (selectedMaterials.size === 0) {
      show({ message: '请先选择要下载的素材', type: 'info' });
      return;
    }

    const selectedList = materials.filter(m => selectedMaterials.has(getMaterialKey(m)));

    if (selectedList.length === 1) {
      // 单个素材直接下载
      const material = selectedList[0];
      const imageUrl = getImageUrl(material.url);

      try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = material.filename || 'material.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        show({ message: '下载成功', type: 'success' });
      } catch (error: any) {
        console.error('下载失败:', error);
        show({ message: '下载失败', type: 'error' });
      }
    } else {
      // 多个素材打包下载
      setIsDownloading(true);
      try {
        const materialIds = selectedList.map(m => m.id);
        await downloadMaterialsZip(materialIds);
        show({ message: `已打包 ${selectedList.length} 个素材`, type: 'success' });
      } catch (error: any) {
        console.error('批量下载失败:', error);
        show({
          message: error?.response?.data?.error?.message || error.message || '批量下载失败',
          type: 'error',
        });
      } finally {
        setIsDownloading(false);
      }
    }
  };

  // 预览图片
  const handlePreview = (e: React.MouseEvent, material: Material) => {
    e.stopPropagation();
    setPreviewImage({
      url: getImageUrl(material.url),
      name: getMaterialDisplayName(material)
    });
  };

  const renderProjectLabel = (p: Project) => {
    const text = p.idea_prompt || p.outline_text || `项目 ${p.project_id.slice(0, 8)}`;
    return text.length > 20 ? `${text.slice(0, 20)}…` : text;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="素材中心" size="lg">
      <div className="space-y-4">
        {/* 工具栏 */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FolderOpen size={16} className="text-banana-500" />
            <span>{materials.length > 0 ? `共 ${materials.length} 个素材` : '暂无素材'}</span>
            {selectedMaterials.size > 0 && (
              <span className="ml-2 text-banana-600 font-medium">
                已选择 {selectedMaterials.size} 个
              </span>
            )}
            {isLoading && materials.length > 0 && (
              <RefreshCw size={14} className="animate-spin text-gray-400" />
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* 项目筛选下拉菜单 */}
            <select
              value={filterProjectId}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'show_more') {
                  setShowAllProjects(true);
                  return;
                }
                setFilterProjectId(value);
              }}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-banana-500 w-40 sm:w-48 max-w-[200px] truncate"
            >
              <option value="all">所有素材</option>
              <option value="none">未关联项目</option>

              {showAllProjects ? (
                <>
                  <option disabled>───────────</option>
                  {projects.map((p) => (
                    <option key={p.project_id} value={p.project_id} title={p.idea_prompt || p.outline_text}>
                      {renderProjectLabel(p)}
                    </option>
                  ))}
                </>
              ) : (
                projects.length > 0 && (
                  <option value="show_more">+ 查看更多项目...</option>
                )
              )}
            </select>

            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw size={16} />}
              onClick={loadMaterials}
              disabled={isLoading}
            >
              刷新
            </Button>

            {/* 上传按钮 */}
            <label className="inline-block cursor-pointer">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                <Upload size={16} />
                <span>{isUploading ? '上传中...' : '上传'}</span>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleUpload}
                className="hidden"
                disabled={isUploading}
              />
            </label>
          </div>
        </div>

        {/* 批量操作栏 */}
        {materials.length > 0 && (
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
            >
              {selectedMaterials.size === materials.length ? '取消全选' : '全选'}
            </Button>
            {selectedMaterials.size > 0 && (
              <>
                <Button variant="ghost" size="sm" onClick={handleClear}>
                  清空选择
                </Button>
                <div className="flex-1" />
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Download size={16} />}
                  onClick={handleDownload}
                  disabled={isDownloading}
                >
                  {isDownloading ? '打包中...' : `下载 (${selectedMaterials.size})`}
                </Button>
              </>
            )}
          </div>
        )}

        {/* 素材网格 */}
        {isLoading && materials.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-400">加载中...</div>
          </div>
        ) : materials.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 p-4">
            <ImageIcon size={48} className="mb-4 opacity-50" />
            <div className="text-sm">暂无素材</div>
            <div className="text-xs mt-1">可以上传图片或通过素材生成功能创建素材</div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4 max-h-96 overflow-y-auto p-4">
            {materials.map((material) => {
              const key = getMaterialKey(material);
              const isSelected = selectedMaterials.has(key);
              const isDeleting = deletingIds.has(material.id);
              return (
                <div
                  key={key}
                  onClick={() => handleSelectMaterial(material)}
                  className={`aspect-video rounded-lg border-2 cursor-pointer transition-all relative group ${
                    isSelected
                      ? 'border-banana-500 ring-2 ring-banana-200'
                      : 'border-gray-200 hover:border-banana-300'
                  }`}
                >
                  <img
                    src={getImageUrl(material.url)}
                    alt={getMaterialDisplayName(material)}
                    className="absolute inset-0 w-full h-full object-cover rounded-md"
                  />
                  {/* 预览按钮 */}
                  <button
                    type="button"
                    onClick={(e) => handlePreview(e, material)}
                    className="absolute top-1 left-1 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow z-10 hover:bg-black/80"
                    aria-label="预览素材"
                  >
                    <Eye size={12} />
                  </button>
                  {/* 删除按钮 */}
                  <button
                    type="button"
                    onClick={(e) => handleDeleteMaterial(e, material)}
                    disabled={isDeleting}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow z-10 disabled:opacity-60 disabled:cursor-not-allowed"
                    aria-label="删除素材"
                  >
                    {isDeleting ? <RefreshCw size={12} className="animate-spin" /> : <X size={12} />}
                  </button>
                  {/* 选中标记 */}
                  {isSelected && (
                    <div className="absolute inset-0 bg-banana-500 bg-opacity-20 flex items-center justify-center rounded-md">
                      <div className="bg-banana-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                        ✓
                      </div>
                    </div>
                  )}
                  {/* 悬停时显示文件名 */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity rounded-b-md">
                    {getMaterialDisplayName(material)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 底部操作 */}
        <div className="pt-4 border-t flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>

      {/* 图片预览模态框 */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
              aria-label="关闭预览"
            >
              <X size={24} />
            </button>
            <img
              src={previewImage.url}
              alt={previewImage.name}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="text-center text-white text-sm mt-2 truncate max-w-[90vw]">
              {previewImage.name}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
