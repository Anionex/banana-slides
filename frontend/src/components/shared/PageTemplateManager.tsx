import React, { useState, useEffect, useCallback } from 'react';
import { X, Upload, AlertCircle, Loader2, Check, Image as ImageIcon, GripVertical } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { useToast } from './Toast';
import { getImageUrl } from '@/api/client';
import { uploadBatchTemplates, getPageTemplates, deletePageTemplate, type PageTemplateBinding } from '@/api/endpoints';
import type { Page } from '@/types';

interface PageTemplateManagerProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  pages: Page[];
  onTemplatesUpdated?: () => void;
}

interface TemplateFile {
  id: string;
  file: File;
  previewUrl: string;
}

export const PageTemplateManager: React.FC<PageTemplateManagerProps> = ({
  isOpen,
  onClose,
  projectId,
  pages,
  onTemplatesUpdated,
}) => {
  const [bindings, setBindings] = useState<PageTemplateBinding[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingTemplates, setPendingTemplates] = useState<TemplateFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const { show, ToastContainer } = useToast();

  // Load current bindings when modal opens
  useEffect(() => {
    if (isOpen && projectId) {
      loadBindings();
    }
  }, [isOpen, projectId]);

  const loadBindings = async () => {
    setIsLoading(true);
    try {
      const response = await getPageTemplates(projectId);
      if (response.data?.bindings) {
        setBindings(response.data.bindings);
      }
    } catch (error) {
      console.error('Failed to load page templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateId = () => `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const imageFiles = fileArray.filter(file =>
      file.type.startsWith('image/') ||
      /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file.name)
    );

    if (imageFiles.length === 0) {
      show({ message: '请选择图片文件', type: 'error' });
      return;
    }

    const newTemplates: TemplateFile[] = imageFiles.map(file => ({
      id: generateId(),
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setPendingTemplates(prev => [...prev, ...newTemplates]);
  }, [show]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleRemovePending = (id: string) => {
    setPendingTemplates(prev => {
      const template = prev.find(t => t.id === id);
      if (template) {
        URL.revokeObjectURL(template.previewUrl);
      }
      return prev.filter(t => t.id !== id);
    });
  };

  const handleUpload = async () => {
    if (pendingTemplates.length === 0) {
      show({ message: '请先选择模板图片', type: 'warning' });
      return;
    }

    setIsUploading(true);
    try {
      const files = pendingTemplates.map(t => t.file);
      const response = await uploadBatchTemplates(projectId, files);

      if (response.data) {
        show({
          message: `成功绑定 ${response.data.templates_bound} 张模板到 ${response.data.total_pages} 个页面`,
          type: 'success'
        });

        // Clear pending templates
        pendingTemplates.forEach(t => URL.revokeObjectURL(t.previewUrl));
        setPendingTemplates([]);

        // Reload bindings
        await loadBindings();

        // Notify parent
        onTemplatesUpdated?.();
      }
    } catch (error: any) {
      console.error('Failed to upload templates:', error);
      show({
        message: error?.response?.data?.error?.message || '上传失败',
        type: 'error'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteTemplate = async (pageId: string) => {
    try {
      await deletePageTemplate(projectId, pageId);
      show({ message: '模板已删除', type: 'success' });
      await loadBindings();
      onTemplatesUpdated?.();
    } catch (error: any) {
      console.error('Failed to delete template:', error);
      show({
        message: error?.response?.data?.error?.message || '删除失败',
        type: 'error'
      });
    }
  };

  const handleClearAll = () => {
    pendingTemplates.forEach(t => URL.revokeObjectURL(t.previewUrl));
    setPendingTemplates([]);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pendingTemplates.forEach(t => URL.revokeObjectURL(t.previewUrl));
    };
  }, []);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="页面模板管理" size="lg">
      <ToastContainer />
      <div className="space-y-6">
        {/* Upload section */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">批量上传模板</h4>

          {/* Drop zone */}
          <div
            className={`
              relative border-2 border-dashed rounded-xl p-6 transition-all duration-200 cursor-pointer
              ${isDragging
                ? 'border-yellow-400 bg-yellow-50'
                : 'border-gray-300 hover:border-gray-400 bg-gray-50'
              }
            `}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.multiple = true;
              input.accept = 'image/*';
              input.onchange = (e) => {
                const files = (e.target as HTMLInputElement).files;
                if (files) handleFiles(files);
              };
              input.click();
            }}
          >
            <div className="flex flex-col items-center justify-center text-center">
              <Upload className={`w-8 h-8 mb-2 ${isDragging ? 'text-yellow-500' : 'text-gray-400'}`} />
              <p className="text-sm font-medium text-gray-700">
                拖拽或点击上传多张模板图片
              </p>
              <p className="text-xs text-gray-500 mt-1">
                按上传顺序与页面一一对应（第1张→第1页）
              </p>
            </div>
          </div>

          {/* Pending templates preview */}
          {pendingTemplates.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  待上传: {pendingTemplates.length} 张模板
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleClearAll}
                    disabled={isUploading}
                  >
                    清空
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleUpload}
                    loading={isUploading}
                    disabled={isUploading}
                  >
                    上传并绑定
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-6 gap-2">
                {pendingTemplates.map((template, index) => (
                  <div
                    key={template.id}
                    className="relative group aspect-[4/3] rounded-lg overflow-hidden border border-gray-200"
                  >
                    <img
                      src={template.previewUrl}
                      alt={`模板 ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemovePending(template.id);
                        }}
                        className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="absolute top-1 right-1">
                      <span className="text-xs font-bold text-white bg-yellow-500 px-1.5 py-0.5 rounded shadow">
                        {index + 1}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Current bindings section */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            当前模板绑定状态
            {!isLoading && bindings.length > 0 && (
              <span className="text-gray-500 font-normal ml-2">
                ({bindings.filter(b => b.template_image_url).length}/{bindings.length} 页已绑定模板)
              </span>
            )}
          </h4>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : bindings.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              暂无页面数据
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {bindings.map((binding) => (
                <div
                  key={binding.page_id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  {/* Page info */}
                  <div className="flex-shrink-0 w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <span className="text-sm font-bold text-yellow-700">
                      {binding.order_index + 1}
                    </span>
                  </div>

                  {/* Page title */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {binding.part || `第 ${binding.order_index + 1} 页`}
                    </p>
                  </div>

                  {/* Template preview or placeholder */}
                  <div className="flex-shrink-0">
                    {binding.template_image_url ? (
                      <div className="relative group">
                        <img
                          src={getImageUrl(binding.template_image_url)}
                          alt={`Page ${binding.order_index + 1} template`}
                          className="w-16 h-12 object-cover rounded border border-gray-200"
                        />
                        <button
                          onClick={() => handleDeleteTemplate(binding.page_id)}
                          className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-green-500 text-white text-xs text-center py-0.5 rounded-b">
                          <Check className="w-3 h-3 inline" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-16 h-12 bg-gray-200 rounded border border-dashed border-gray-300 flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-gray-400" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
          <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-700 space-y-1">
            <p>
              <strong>页级模板说明：</strong>每个页面可以绑定一张独立的模板图片。
            </p>
            <p>
              在生成描述时，AI会分析该页模板中的固定元素与可变区域，确保生成内容与模板风格一致。
            </p>
            <p>
              在生成图片时，会使用对应的页级模板作为参考，优先于项目级模板。
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t">
          <Button variant="secondary" onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default PageTemplateManager;
