import React, { useState, useEffect } from 'react';
import { Button, useToast, MaterialSelector } from '@/components/shared';
import { getImageUrl } from '@/api/client';
import { listUserTemplates, uploadUserTemplate, deleteUserTemplate, type UserTemplate, getSystemTemplates } from '@/api/endpoints';
import { materialUrlToFile } from '@/components/shared/MaterialSelector';
import type { Material } from '@/api/endpoints';
import { ImagePlus, X } from 'lucide-react';
import { isLocalMode } from '@/utils/mode';

// 硬编码的预设模板（导出供其他组件使用）
export const PRESET_TEMPLATES: UserTemplate[] = [
  {
    id: 'simple-business',
    name: '简约商务风格',
    template_image_url: '/templates/13f7b8f1f5858efaf6d91c09cf0f98dd.jpg',
    source: 'static',
    template_id: 'simple-business',
  },
  {
    id: 'modern-tech',
    name: '现代科技风格',
    template_image_url: '/templates/22aabcfcfa8a0dcb152376cc749baa4f.jpg',
    source: 'static',
    template_id: 'modern-tech',
  },
  {
    id: 'creative-design',
    name: '创意设计风格',
    template_image_url: '/templates/d2138e0b6e15d2f0261be6772c13f7d5.jpg',
    source: 'static',
    template_id: 'creative-design',
  },
  {
    id: 'template-b',
    name: '科技蓝',
    template_image_url: '/templates/template_b.png',
    source: 'static',
    template_id: 'template-b',
  },
  {
    id: 'template-g',
    name: '活力色彩',
    template_image_url: '/templates/template_g.png',
    source: 'static',
    template_id: 'template-g',
  },
  {
    id: 'template-s',
    name: '简约商务',
    template_image_url: '/templates/template_s.png',
    source: 'static',
    template_id: 'template-s',
  },
  {
    id: 'template-y',
    name: '复古卷轴',
    template_image_url: '/templates/template_y.png',
    source: 'static',
    template_id: 'template-y',
  },
];

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
    // 本地模式：直接使用硬编码的预设模板
    if (isLocalMode()) {
      setSystemTemplates(PRESET_TEMPLATES);
      return;
    }

    // 后端模式：尝试从后端加载
    try {
      const response = await getSystemTemplates();
      if (response.data?.templates && response.data.templates.length > 0) {
        setSystemTemplates(response.data.templates);
      } else {
        // 如果后端没有返回模板，使用硬编码的预设模板
        setSystemTemplates(PRESET_TEMPLATES);
      }
    } catch (error: any) {
      console.error('加载系统模板失败，使用硬编码的预设模板:', error);
      // API 失败时使用硬编码的预设模板
      setSystemTemplates(PRESET_TEMPLATES);
    }
  };

  const loadUserTemplates = async () => {
    // 本地模式：用户模板功能暂不支持（需要后端存储）
    if (isLocalMode()) {
      setUserTemplates([]);
      return;
    }

    // 后端模式：从后端加载
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
      // 本地模式：不支持上传用户模板（需要后端存储）
      if (isLocalMode()) {
        show({ message: '本地模式暂不支持上传自定义模板，请使用预设模板', type: 'info' });
        e.target.value = '';
        return;
      }

      // 后端模式：上传到后端
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
    onSelect(null, template.template_id);
  };

  const handleSelectMaterials = async (materials: Material[]) => {
    if (materials.length === 0) return;

    // 本地模式：不支持保存到模板库（需要后端存储）
    if (isLocalMode()) {
      show({ message: '本地模式暂不支持保存到模板库，请使用预设模板', type: 'info' });
      return;
    }

    // 后端模式：保存到模板库
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
    
    // 本地模式：不支持删除（因为没有用户模板）
    if (isLocalMode()) {
      show({ message: '本地模式不支持此操作', type: 'info' });
      return;
    }

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
                    selectedPresetTemplateId === template.template_id
                      ? 'border-banana-500 ring-2 ring-banana-200'
                      : 'border-gray-200 hover:border-banana-500'
                  }`}
                >
                  <img
                    src={template.source === 'static' ? template.template_image_url : getImageUrl(template.template_image_url)}
                    alt={template.name || 'Template'}
                    className="absolute inset-0 w-full h-full object-cover rounded-lg"
                  />
                  {selectedPresetTemplateId === template.template_id && (
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
  // 首先检查硬编码的预设模板
  const presetTemplate = PRESET_TEMPLATES.find(t => t.template_id === templateId || t.id === templateId);
  if (presetTemplate) {
    try {
      // 对于数据库源的模板，使用getImageUrl处理路径；对于静态模板直接使用路径
      const imageUrl = presetTemplate.source === 'database'
        ? getImageUrl(presetTemplate.template_image_url)
        : presetTemplate.template_image_url;
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const fileName = `${presetTemplate.name}.jpg`;
      return new File([blob], fileName, { type: blob.type });
    } catch (error) {
      console.error('加载预设模板失败:', error);
      return null;
    }
  }

  // 然后检查是否是系统模板
  const systemTemplate = systemTemplates.find(t => t.id === templateId);
  if (systemTemplate) {
    try {
      const imageUrl = systemTemplate.source === 'static'
        ? systemTemplate.template_image_url
        : getImageUrl(systemTemplate.template_image_url);
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      // 根据模板ID设置文件名
      const fileName = systemTemplate.source === 'static'
        ? `${templateId}.jpg`
        : 'template.png';
      return new File([blob], fileName, { type: blob.type });
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