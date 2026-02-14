import React, { useState, useEffect } from 'react';
import { ImageIcon, RefreshCw, Upload, Sparkles, X } from 'lucide-react';
import { Button, useToast, Modal } from '@/components/shared';
import { useT } from '@/hooks/useT';
import { listMaterials, uploadMaterial, listProjects, deleteMaterial, type Material } from '@/api/endpoints';

// MaterialSelector 组件自包含翻译
const materialSelectorI18n = {
  zh: {
    material: {
      selectTitle: "选择素材", totalMaterials: "共 {{count}} 个素材", noMaterials: "暂无素材",
      selectedCount: "已选择 {{count}} 个", allMaterials: "所有素材", unassociated: "未关联项目",
      currentProject: "当前项目", viewMoreProjects: "+ 查看更多项目...", uploadFile: "上传文件",
      previewMaterial: "预览素材", deleteMaterial: "删除素材", closePreview: "关闭预览",
      canUploadOrGenerate: "可以上传图片或通过素材生成功能创建素材",
      canUploadImages: "可以上传图片作为素材",
      generateMaterial: "生成素材",
      messages: {
        loadMaterialFailed: "加载素材失败", unsupportedFormat: "不支持的图片格式",
        uploadSuccess: "素材上传成功", uploadFailed: "上传素材失败",
        cannotDelete: "无法删除：缺少素材ID", deleteSuccess: "素材已删除", deleteFailed: "删除素材失败",
        selectAtLeastOne: "请至少选择一个素材", maxSelection: "最多只能选择 {{count}} 个素材"
      }
    }
  },
  en: {
    material: {
      selectTitle: "Select Material", totalMaterials: "{{count}} materials", noMaterials: "No materials",
      selectedCount: "{{count}} selected", allMaterials: "All Materials", unassociated: "Unassociated",
      currentProject: "Current Project", viewMoreProjects: "+ View more projects...", uploadFile: "Upload File",
      previewMaterial: "Preview Material", deleteMaterial: "Delete Material", closePreview: "Close Preview",
      canUploadOrGenerate: "You can upload images or create materials through the material generator",
      canUploadImages: "You can upload images as materials",
      generateMaterial: "Generate Material",
      messages: {
        loadMaterialFailed: "Failed to load materials", unsupportedFormat: "Unsupported image format",
        uploadSuccess: "Material uploaded successfully", uploadFailed: "Failed to upload material",
        cannotDelete: "Cannot delete: Missing material ID", deleteSuccess: "Material deleted", deleteFailed: "Failed to delete material",
        selectAtLeastOne: "Please select at least one material", maxSelection: "Maximum {{count}} materials can be selected"
      }
    }
  }
};
import type { Project } from '@/types';
import { getImageUrl } from '@/api/client';
import { MaterialGeneratorModal } from './MaterialGeneratorModal';

interface MaterialSelectorProps {
  projectId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (materials: Material[], saveAsTemplate?: boolean) => void;
  multiple?: boolean;
  maxSelection?: number;
  showSaveAsTemplateOption?: boolean;
}

export const MaterialSelector: React.FC<MaterialSelectorProps> = ({
  projectId,
  isOpen,
  onClose,
  onSelect,
  multiple = false,
  maxSelection,
  showSaveAsTemplateOption = false,
}) => {
  const t = useT(materialSelectorI18n);
  const { show } = useToast();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [filterProjectId, setFilterProjectId] = useState<string>('all');
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState(true);
  const [showAllProjects, setShowAllProjects] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (!projectsLoaded) {
        loadProjects();
      }
      loadMaterials();
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
      console.error('Failed to load projects:', error);
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
      console.error('Failed to load materials:', error);
      show({
        message: error?.response?.data?.error?.message || error.message || t('material.messages.loadMaterialFailed'),
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
            message: t('material.messages.maxSelection', { count: maxSelection }),
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
      show({ message: t('material.messages.selectAtLeastOne'), type: 'info' });
      return;
    }
    onSelect(selected, showSaveAsTemplateOption ? saveAsTemplate : undefined);
    onClose();
  };

  const handleClear = () => {
    setSelectedMaterials(new Set());
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      show({ message: t('material.messages.unsupportedFormat'), type: 'error' });
      return;
    }

    setIsUploading(true);
    try {
      const targetProjectId = (filterProjectId === 'all' || filterProjectId === 'none')
        ? null
        : filterProjectId;

      const response = await uploadMaterial(
        file,
        targetProjectId
      );
      
      if (response.data) {
        show({ message: t('material.messages.uploadSuccess'), type: 'success' });
        loadMaterials();
      }
    } catch (error: any) {
      console.error('Failed to upload material:', error);
      show({
        message: error?.response?.data?.error?.message || error.message || t('material.messages.uploadFailed'),
        type: 'error',
      });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleGeneratorClose = () => {
    setIsGeneratorOpen(false);
    loadMaterials();
  };

  const handleDeleteMaterial = async (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    material: Material
  ) => {
    e.stopPropagation();
    const materialId = material.id;
    const key = getMaterialKey(material);

    if (!materialId) {
      show({ message: t('material.messages.cannotDelete'), type: 'error' });
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
      show({ message: t('material.messages.deleteSuccess'), type: 'success' });
    } catch (error: any) {
      console.error('Failed to delete material:', error);
      show({
        message: error?.response?.data?.error?.message || error.message || t('material.messages.deleteFailed'),
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
    const text = p.idea_prompt || p.outline_text || `Project ${p.project_id.slice(0, 8)}`;
    return text.length > 20 ? `${text.slice(0, 20)}…` : text;
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={t('material.selectTitle')} size="lg">
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-foreground-tertiary">
              <span>{materials.length > 0 ? t('material.totalMaterials', { count: materials.length }) : t('material.noMaterials')}</span>
              {selectedMaterials.size > 0 && (
                <span className="ml-2 text-banana-600">
                  {t('material.selectedCount', { count: selectedMaterials.size })}
                </span>
              )}
              {isLoading && materials.length > 0 && (
                <RefreshCw size={14} className="animate-spin text-gray-400" />
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
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
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-border-primary rounded-md bg-white dark:bg-background-secondary focus:outline-none focus:ring-2 focus:ring-banana-500 w-40 sm:w-48 max-w-[200px] truncate"
              >
                <option value="all">{t('material.allMaterials')}</option>
                <option value="none">{t('material.unassociated')}</option>
                {projectId && (
                  <option value={projectId}>
                    {t('material.currentProject')}{projects.find(p => p.project_id === projectId) ? `: ${renderProjectLabel(projects.find(p => p.project_id === projectId)!)}` : ''}
                  </option>
                )}
                
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
                  projects.length > (projectId ? 1 : 0) && (
                    <option value="show_more">{t('material.viewMoreProjects')}</option>
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
                {t('common.refresh')}
              </Button>
              
              <label className="inline-block cursor-pointer">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-foreground-secondary bg-white dark:bg-background-secondary border border-gray-300 dark:border-border-primary rounded-md hover:bg-gray-50 dark:hover:bg-background-hover disabled:opacity-50 disabled:cursor-not-allowed">
                  <Upload size={16} />
                  <span>{isUploading ? t('common.uploading') : t('common.upload')}</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUpload}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>
              
              {projectId && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Sparkles size={16} />}
                  onClick={() => setIsGeneratorOpen(true)}
                >
                  {t('material.generateMaterial')}
                </Button>
              )}
              
              {selectedMaterials.size > 0 && (
                <Button variant="ghost" size="sm" onClick={handleClear}>
                  {t('common.clearSelection')}
                </Button>
              )}
            </div>
          </div>

          {isLoading && materials.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-400">{t('common.loading')}</div>
            </div>
          ) : materials.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 p-4">
              <ImageIcon size={48} className="mb-4 opacity-50" />
              <div className="text-sm">{t('material.noMaterials')}</div>
              <div className="text-xs mt-1">
                {projectId ? t('material.canUploadOrGenerate') : t('material.canUploadImages')}
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
                      : 'border-gray-200 dark:border-border-primary hover:border-banana-300'
                  }`}
                >
                  <img
                    src={getImageUrl(material.url)}
                    alt={getMaterialDisplayName(material)}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={(e) => handleDeleteMaterial(e, material)}
                    disabled={isDeleting}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow z-10 disabled:opacity-60 disabled:cursor-not-allowed"
                    aria-label={t('material.deleteMaterial')}
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
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {getMaterialDisplayName(material)}
                  </div>
                </div>
              );
            })}
          </div>
          )}

          <div className="pt-4 border-t">
            {showSaveAsTemplateOption && (
              <div className="mb-3 p-3 bg-gray-50 dark:bg-background-primary rounded-lg border border-gray-200 dark:border-border-primary">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAsTemplate}
                    onChange={(e) => setSaveAsTemplate(e.target.checked)}
                    className="w-4 h-4 text-banana-500 border-gray-300 dark:border-border-primary rounded focus:ring-banana-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-foreground-secondary">
                    {t('template.saveToLibraryOnUpload')}
                  </span>
                </label>
              </div>
            )}
            
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirm}
                disabled={selectedMaterials.size === 0}
              >
                {t('common.confirm')} ({selectedMaterials.size})
              </Button>
            </div>
          </div>
        </div>
      </Modal>
      
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
