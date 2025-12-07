import React, { useState, useEffect } from 'react';
import { Button, useToast, MaterialSelector } from '@/components/shared';
import { getImageUrl } from '@/api/client';
import { listUserTemplates, uploadUserTemplate, deleteUserTemplate, type UserTemplate, getSystemTemplates } from '@/api/endpoints';
import { materialUrlToFile } from '@/components/shared/MaterialSelector';
import type { Material } from '@/api/endpoints';
import { ImagePlus, X } from 'lucide-react';

interface TemplateSelectorProps {
  onSelect: (templateFile: File | null, templateId?: string) => void;
  selectedTemplateId?: string | null;
  selectedPresetTemplateId?: string | null;
  showUpload?: boolean;
  projectId?: string | null;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  onSelect,
  selectedTemplateId,
  selectedPresetTemplateId,
  showUpload = true,
  projectId,
}) => {
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([]);
  const [systemTemplates, setSystemTemplates] = useState<UserTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isMaterialSelectorOpen, setIsMaterialSelectorOpen] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const { show, ToastContainer } = useToast();

  // 加载用户模板列表和系统模板
  useEffect(() => {
    loadUserTemplates();
    loadSystemTemplates();
  }, []);

  const loadSystemTemplates = async () => {
    try {
      const response = await getSystemTemplates();
      if (response.data?.templates) {
        setSystemTemplates(response.data.templates);
      }
    } catch (error: any) {
      console.error('加载系统模板失败:', error);
    }
  };

  const loadUserTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const response = await listUserTemplates();
      if (response.data?.templates) {
        setUserTemplates(response.data.templates);
      }
    } catch (error: any) {
      console.error('加载用户模板失败:', error);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const response = await uploadUserTemplate(file);
        if (response.data) {
          const template = response.data;
          setUserTemplates(prev => [template, ...prev]);
          onSelect(null, template.template_id);
          show({ message: '模板上传成功', type: 'success' });
        }
      } catch (error: any) {
        console.error('上传模板失败:', error);
        show({ message: '模板上传失败: ' + (error.message || '未知错误'), type: 'error' });
      }
    }
    e.target.value = '';
  };

  const handleSelectUserTemplate = (template: UserTemplate) => {
    onSelect(null, template.template_id);
  };

  const handleSelectPresetTemplate = (template: UserTemplate) => {
    onSelect(null, template.id);
  };

  const handleSelectMaterials = async (materials: Material[]) => {
    if (materials.length === 0) return;

    try {
      const file = await materialUrlToFile(materials[0]);
      const response = await uploadUserTemplate(file);
      if (response.data) {
        const template = response.data;
        setUserTemplates(prev => [template, ...prev]);
        onSelect(file, template.template_id);
        show({ message: '素材已保存到模板库', type: 'success' });
      }
    } catch (error: any) {
      console.error('加载素材失败:', error);
      show({ message: '加载素材失败: ' + (error.message || '未知错误'), type: 'error' });
    }
  };

  const handleDeleteUserTemplate = async (template: UserTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedTemplateId === template.template_id) {
      show({ message: '当前使用中的模板不能删除，请先取消选择或切换', type: 'info' });
      return;
    }
    setDeletingTemplateId(template.template_id);
    try {
      await deleteUserTemplate(template.template_id);
      setUserTemplates((prev) => prev.filter((t) => t.template_id !== template.template_id));
      show({ message: '模板已删除', type: 'success' });
    } catch (error: any) {
      console.error('删除模板失败:', error);
      show({ message: '删除模板失败: ' + (error.message || '未知错误'), type: 'error' });
    } finally {
      setDeletingTemplateId(null);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* 系统预设模板 */}
        {systemTemplates.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">预设模板</h4>
            <div className="grid grid-cols-4 gap-4 mb-4">
              {systemTemplates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => handleSelectPresetTemplate(template)}
                  className={`aspect-[4/3] rounded-lg border-2 cursor-pointer transition-all relative ${
                    selectedPresetTemplateId === template.id
                      ? 'border-banana-500 ring-2 ring-banana-200'
                      : 'border-gray-200 hover:border-banana-500'
                  }`}
                >
                  <img
                    src={getImageUrl(template.template_image_url)}
                    alt={template.name || 'Template'}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {selectedPresetTemplateId === template.id && (
                    <div className="absolute inset-0 bg-banana-500 bg-opacity-20 flex items-center justify-center pointer-events-none">
                      <span className="text-white font-semibold text-sm">已选择</span>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-2">
                    <span className="text-white text-xs font-medium">{template.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 用户自定义模板 */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            {systemTemplates.length > 0 ? '自定义模板' : '预设模板'}
          </h4>
          <div className="grid grid-cols-4 gap-4">
            {/* 用户已保存的模板 */}
            {userTemplates.map((template) => (
              <div
                key={template.template_id}
                onClick={() => handleSelectUserTemplate(template)}
                className={`aspect-[4/3] rounded-lg border-2 cursor-pointer transition-all relative group ${
                  selectedTemplateId === template.template_id
                    ? 'border-banana-500 ring-2 ring-banana-200'
                    : 'border-gray-200 hover:border-banana-300'
                }`}
              >
                <img
                  src={getImageUrl(template.template_image_url)}
                  alt={template.name || 'Template'}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {selectedTemplateId !== template.template_id && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteUserTemplate(template, e)}
                    disabled={deletingTemplateId === template.template_id}
                    className={`absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow z-20 opacity-0 group-hover:opacity-100 transition-opacity ${
                      deletingTemplateId === template.template_id ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                    aria-label="删除模板"
                  >
                    <X size={12} />
                  </button>
                )}
                {selectedTemplateId === template.template_id && (
                  <div className="absolute inset-0 bg-banana-500 bg-opacity-20 flex items-center justify-center pointer-events-none">
                    <span className="text-white font-semibold text-sm">已选择</span>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-2">
                  <span className="text-white text-xs font-medium">{template.name}</span>
                </div>
              </div>
            ))}

            {/* 上传新模板 */}
            <label className="aspect-[4/3] rounded-lg border-2 border-dashed border-gray-300 hover:border-banana-500 cursor-pointer transition-all flex flex-col items-center justify-center gap-2 relative overflow-hidden">
              <span className="text-2xl">+</span>
              <span className="text-sm text-gray-500">上传模板</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleTemplateUpload}
                className="hidden"
                disabled={isLoadingTemplates}
              />
            </label>
          </div>
        </div>

        {/* 从素材库选择作为模板 */}
        {projectId && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">从素材库选择</h4>
            <Button
              variant="secondary"
              size="sm"
              icon={<ImagePlus size={16} />}
              onClick={() => setIsMaterialSelectorOpen(true)}
              className="w-full"
            >
              从素材库选择作为模板
            </Button>
          </div>
        )}
      </div>
      <ToastContainer />

      {/* 素材选择器 */}
      {projectId && (
        <MaterialSelector
          projectId={projectId}
          isOpen={isMaterialSelectorOpen}
          onClose={() => setIsMaterialSelectorOpen(false)}
          onSelect={handleSelectMaterials}
          multiple={false}
          showSaveAsTemplateOption={true}
        />
      )}
    </>
  );
};

/**
 * 根据模板ID获取模板File对象（按需加载）
 */
export const getTemplateFile = async (
  templateId: string,
  userTemplates: UserTemplate[],
  systemTemplates: UserTemplate[] = []
): Promise<File | null> => {
  // 首先检查是否是系统模板
  const systemTemplate = systemTemplates.find(t => t.id === templateId);
  if (systemTemplate) {
    try {
      const imageUrl = getImageUrl(systemTemplate.template_image_url);
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      return new File([blob], 'template.png', { type: blob.type });
    } catch (error) {
      console.error('加载系统模板失败:', error);
      return null;
    }
  }

  // 检查是否是用户模板
  const userTemplate = userTemplates.find(t => t.template_id === templateId);
  if (userTemplate) {
    try {
      const imageUrl = getImageUrl(userTemplate.template_image_url);
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      return new File([blob], 'template.png', { type: blob.type });
    } catch (error) {
      console.error('加载用户模板失败:', error);
      return null;
    }
  }

  return null;
};