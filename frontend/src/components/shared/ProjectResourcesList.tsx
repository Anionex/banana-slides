import React, { useState, useEffect, useCallback } from 'react';
import { Image as ImageIcon, RefreshCw, X, FileText } from 'lucide-react';
import { listMaterials, deleteMaterial, listProjectReferenceFiles, type Material, type ReferenceFile } from '@/api/endpoints';
import { getImageUrl } from '@/api/client';
import { useToast } from './Toast';
import { ReferenceFileCard } from './ReferenceFileCard';

interface ProjectResourcesListProps {
  projectId: string | null;
  className?: string;
  showFiles?: boolean; // 是否显示参考文件
  showImages?: boolean; // 是否显示图片素材
  onFileClick?: (fileId: string) => void;
  onImageClick?: (material: Material) => void;
}

/**
 * 项目资源列表组件
 * 统一展示项目的参考文件和图片素材
 */
export const ProjectResourcesList: React.FC<ProjectResourcesListProps> = ({
  projectId,
  className = 'mb-4',
  showFiles = true,
  showImages = true,
  onFileClick,
  onImageClick,
}) => {
  const { show } = useToast();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [files, setFiles] = useState<ReferenceFile[]>([]);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [deletingMaterialIds, setDeletingMaterialIds] = useState<Set<string>>(new Set());
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());

  // 加载素材列表
  const loadMaterials = useCallback(async () => {
    if (!projectId || !showImages) return;
    
    setIsLoadingMaterials(true);
    try {
      const response = await listMaterials(projectId);
      if (response.data?.materials) {
        setMaterials(response.data.materials);
      }
    } catch (error: any) {
      console.error('加载素材列表失败:', error);
      show({ message: `加载素材列表失败: ${error.message || '未知错误'}`, type: 'error' });
    } finally {
      setIsLoadingMaterials(false);
    }
  }, [projectId, showImages]);

  // 加载文件列表
  const loadFiles = useCallback(async () => {
    if (!projectId || !showFiles) return;
    
    setIsLoadingFiles(true);
    try {
      const response = await listProjectReferenceFiles(projectId);
      if (response.data?.files) {
        setFiles(response.data.files);
      }
    } catch (error: any) {
      console.error('加载文件列表失败:', error);
    } finally {
      setIsLoadingFiles(false);
    }
  }, [projectId, showFiles]);

  useEffect(() => {
    loadMaterials();
    loadFiles();
  }, [loadMaterials, loadFiles]);

  // 删除素材
  const handleDeleteMaterial = async (
    e: React.MouseEvent<HTMLButtonElement>,
    materialId: string
  ) => {
    e.stopPropagation();
    
    setDeletingMaterialIds(prev => new Set(prev).add(materialId));
    
    try {
      await deleteMaterial(materialId);
      setMaterials(prev => prev.filter(m => m.id !== materialId));
      show({ message: '素材已删除', type: 'success' });
    } catch (error: any) {
      console.error('删除素材失败:', error);
      show({
        message: error?.response?.data?.error?.message || error.message || '删除素材失败',
        type: 'error',
      });
    } finally {
      setDeletingMaterialIds(prev => {
        const next = new Set(prev);
        next.delete(materialId);
        return next;
      });
    }
  };

  const handleFileStatusChange = (updatedFile: ReferenceFile) => {
    setFiles(prev => prev.map(f => f.id === updatedFile.id ? updatedFile : f));
  };

  const handleFileDelete = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const getMaterialDisplayName = (m: Material) =>
    (m.prompt && m.prompt.trim()) ||
    (m.name && m.name.trim()) ||
    (m.original_filename && m.original_filename.trim()) ||
    (m.source_filename && m.source_filename.trim()) ||
    m.filename ||
    m.url;

  // 如果没有项目ID，不显示
  if (!projectId) {
    return null;
  }

  // 如果两个都不显示任何内容，则不渲染
  if ((!showFiles || files.length === 0) && (!showImages || materials.length === 0)) {
    return null;
  }

  return (
    <div className={className}>
      {/* 参考文件列表 */}
      {showFiles && files.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">
                已上传的文件 ({files.length})
              </span>
            </div>
            <button
              onClick={loadFiles}
              disabled={isLoadingFiles}
              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              title="刷新列表"
            >
              <RefreshCw size={14} className={isLoadingFiles ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="space-y-2">
            {files.map(file => (
              <ReferenceFileCard
                key={file.id}
                file={file}
                onDelete={handleFileDelete}
                onStatusChange={handleFileStatusChange}
                deleteMode="remove"
                onClick={() => onFileClick?.(file.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 图片素材列表 */}
      {showImages && materials.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ImageIcon size={16} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">
                已上传图片 ({materials.length})
              </span>
            </div>
            <button
              onClick={loadMaterials}
              disabled={isLoadingMaterials}
              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              title="刷新列表"
            >
              <RefreshCw size={14} className={isLoadingMaterials ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* 横向滚动的图片列表 */}
          <div className="flex gap-3 overflow-x-auto pb-2">
            {materials.map((material) => {
              const isDeleting = deletingMaterialIds.has(material.id);
              return (
                <div
                  key={material.id}
                  className="relative flex-shrink-0 group cursor-pointer"
                  onClick={() => onImageClick?.(material)}
                >
                  {/* 图片容器 */}
                  <div className="relative w-32 h-32 bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-banana-400 transition-colors">
                    {failedImageUrls.has(material.url) ? (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs text-center p-2">
                        图片加载失败
                      </div>
                    ) : (
                      <img
                        src={getImageUrl(material.url)}
                        alt={getMaterialDisplayName(material)}
                        className="w-full h-full object-cover"
                        onError={() => setFailedImageUrls(prev => new Set(prev).add(material.url))}
                      />
                    )}

                    {/* 删除按钮 */}
                    <button
                      onClick={(e) => handleDeleteMaterial(e, material.id)}
                      disabled={isDeleting}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 active:scale-95 disabled:opacity-60"
                      title="删除此素材"
                    >
                      {isDeleting ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <X size={14} />
                      )}
                    </button>

                    {/* 悬浮时显示文件名 */}
                    <div className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-xs p-1 opacity-0 group-hover:opacity-100 transition-opacity truncate">
                      {getMaterialDisplayName(material)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectResourcesList;

