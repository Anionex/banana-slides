import React, { useState, useEffect } from 'react';
import { ImageIcon, RefreshCw, Upload, Sparkles, X } from 'lucide-react';
import { Button, useToast, Modal } from '@/components/shared';
import { listMaterials, uploadMaterial, listProjects, deleteMaterial, type Material } from '@/api/endpoints';
import type { Project } from '@/types';
import { getImageUrl } from '@/api/client';
import { MaterialGeneratorModal } from './MaterialGeneratorModal';
import { isLocalMode } from '@/utils/mode';

interface MaterialSelectorProps {
  projectId?: string; // 可选，如果不提供则使用全局接口
  isOpen: boolean;
  onClose: () => void;
  onSelect: (materials: Material[], saveAsTemplate?: boolean) => void;
  multiple?: boolean; // 是否支持多选
  maxSelection?: number; // 最大选择数量
  showSaveAsTemplateOption?: boolean; // 是否显示"保存为模板"选项
}

/**
 * 素材选择器组件
 * - 浏览项目下的所有素材
 * - 支持单选/多选
 * - 可以将选中的素材转换为File对象或直接使用URL
 * - 支持上传图片作为素材
 * - 支持进入素材生成组件
 * - 支持按项目筛选素材
 */
export const MaterialSelector: React.FC<MaterialSelectorProps> = ({
  projectId,
  isOpen,
  onClose,
  onSelect,
  multiple = false,
  maxSelection,
  showSaveAsTemplateOption = false,
}) => {
  const { show } = useToast();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [filterProjectId, setFilterProjectId] = useState<string>('all'); // 始终默认显示所有素材
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState(true); // 默认勾选：保存为模板
  const [showAllProjects, setShowAllProjects] = useState(false); // 控制是否显示所有项目

  // 不再根据 projectId 自动改变筛选，用户可以自己选择

  useEffect(() => {
    if (isOpen) {
      // 本地模式：素材功能暂不支持
      if (isLocalMode()) {
        show({
          message: '本地模式暂不支持素材库功能',
          type: 'info',
        });
        return;
      }

      // 后端模式：正常加载
      if (!projectsLoaded) {
        loadProjects();
      }
      loadMaterials();
      // 每次打开时重置展开状态
      setShowAllProjects(false);
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
      // 如果 filterProjectId 是 'all'，传递 'all'；如果是 'none'，传递 'none'；否则传递实际的项目ID
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
    if (multiple) {
      const newSelected = new Set(selectedMaterials);
      if (newSelected.has(key)) {
        newSelected.delete(key);
      } else {
        if (maxSelection && newSelected.size >= maxSelection) {
          show({
            message: `最多只能选择 ${maxSelection} 个素材`,
            type: 'info',
          });
          return;
        }
        newSelected.add(key);
      }
      setSelectedMaterials(newSelected);
    } else {
      setSelectedMaterials(new Set([key]));
    }
  };

  const handleConfirm = () => {
    const selected = materials.filter((m) => selectedMaterials.has(getMaterialKey(m)));
    if (selected.length === 0) {
      show({ message: '请至少选择一个素材', type: 'info' });
      return;
    }
    // 如果启用了保存为模板选项，传递saveAsTemplate状态
    onSelect(selected, showSaveAsTemplateOption ? saveAsTemplate : undefined);
    onClose();
  };

  const handleClear = () => {
    setSelectedMaterials(new Set());
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      show({ message: '不支持的图片格式', type: 'error' });
      return;
    }

    setIsUploading(true);
    try {
      // 简化上传逻辑：在 'all' 或 'none' 筛选时上传为全局素材（不关联项目）
      const targetProjectId = (filterProjectId === 'all' || filterProjectId === 'none')
        ? null
        : filterProjectId;

      const response = await uploadMaterial(
        file,
        targetProjectId
      );
      
      if (response.data) {
        show({ message: '素材上传成功', type: 'success' });
        loadMaterials(); // 重新加载素材列表
      }
    } catch (error: any) {
      console.error('上传素材失败:', error);
      show({
        message: error?.response?.data?.error?.message || error.message || '上传素材失败',
        type: 'error',
      });
    } finally {
      setIsUploading(false);
      // 清空 input 值，以便可以重复选择同一文件
      e.target.value = '';
    }
  };

  const handleGeneratorClose = () => {
    setIsGeneratorOpen(false);
    loadMaterials(); // 重新加载素材列表
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

  const renderProjectLabel = (p: Project) => {
    const text = p.idea_prompt || p.outline_text || `项目 ${p.project_id.slice(0, 8)}`;
    return text.length > 20 ? `${text.slice(0, 20)}…` : text;
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="选择素材" size="lg">
        <div className="space-y-4">
          {/* 工具栏 */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>{materials.length > 0 ? `共 ${materials.length} 个素材` : '暂无素材'}</span>
              {selectedMaterials.size > 0 && (
                <span className="ml-2 text-banana-600">
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
                    // 点击"查看更多项目"时展开列表
                    setShowAllProjects(true);
                    return;
                  }
                  setFilterProjectId(value);
                }}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-banana-500 w-40 sm:w-48 max-w-[200px] truncate"
              >
                {/* 固定显示的前三个选项 */}
                <option value="all">所有素材</option>
                <option value="none">未关联项目</option>
                {projectId && (
                  <option value={projectId}>
                    当前项目{projects.find(p => p.project_id === projectId) ? `: ${renderProjectLabel(projects.find(p => p.project_id === projectId)!)}` : ''}
                  </option>
                )}
                
                {/* 展开后显示所有项目 */}
                {showAllProjects ? (
                  <>
                    <option disabled>───────────</option>
                    {projects.filter(p => p.project_id !== projectId).map((p) => (
                      <option key={p.project_id} value={p.project_id} title={p.idea_prompt || p.outline_text}>
                        {renderProjectLabel(p)}
                      </option>
                    ))}
                  </>
                ) : (
                  // 未展开时显示"查看更多项目"选项
                  projects.length > (projectId ? 1 : 0) && (
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
              
              {/* 素材生成按钮 */}
              {projectId && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Sparkles size={16} />}
                  onClick={() => setIsGeneratorOpen(true)}
                >
                  生成素材
                </Button>
              )}
              
              {selectedMaterials.size > 0 && (
                <Button variant="ghost" size="sm" onClick={handleClear}>
                  清空选择
                </Button>
              )}
            </div>
          </div>

          {/* 素材网格 */}
          {isLoading && materials.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-400">加载中...</div>
            </div>
          ) : materials.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 p-4">
              <ImageIcon size={48} className="mb-4 opacity-50" />
              <div className="text-sm">暂无素材</div>
              <div className="text-xs mt-1">
                {projectId ? '可以上传图片或使用素材生成功能创建素材' : '可以上传图片作为素材'}
              </div>
            </div>
          ) : (
          <div className="grid grid-cols-4 gap-4 max-h-96 overflow-y-auto  p-4">
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
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {/* 删除按钮：右上角，圆心在角上 */}
                  <button
                    type="button"
                    onClick={(e) => handleDeleteMaterial(e, material)}
                    disabled={isDeleting}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow z-10 disabled:opacity-60 disabled:cursor-not-allowed"
                    aria-label="删除素材"
                  >
                    {isDeleting ? <RefreshCw size={12} className="animate-spin" /> : <X size={12} />}
                  </button>
                  {isSelected && (
                    <div className="absolute inset-0 bg-banana-500 bg-opacity-20 flex items-center justify-center">
                      <div className="bg-banana-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                        ✓
                      </div>
                    </div>
                  )}
                  {/* 悬停时显示文件名 */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {getMaterialDisplayName(material)}
                  </div>
                </div>
              );
            })}
          </div>
          )}

          {/* 底部操作 */}
          <div className="pt-4 border-t">
            {/* 保存为模板选项 */}
            {showSaveAsTemplateOption && (
              <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAsTemplate}
                    onChange={(e) => setSaveAsTemplate(e.target.checked)}
                    className="w-4 h-4 text-banana-500 border-gray-300 rounded focus:ring-banana-500"
                  />
                  <span className="text-sm text-gray-700">
                    同时保存到我的模板库
                  </span>
                </label>
              </div>
            )}
            
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={onClose}>
                取消
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirm}
                disabled={selectedMaterials.size === 0}
              >
                确认选择 ({selectedMaterials.size})
              </Button>
            </div>
          </div>
        </div>
      </Modal>
      
      {/* 素材生成组件 */}
      {projectId && (
        <MaterialGeneratorModal
          projectId={projectId}
          isOpen={isGeneratorOpen}
          onClose={handleGeneratorClose}
        />
      )}
    </>
  );
};

/**
 * 将素材URL转换为File对象
 * 用于需要File对象的场景（如上传参考图）
 */
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

