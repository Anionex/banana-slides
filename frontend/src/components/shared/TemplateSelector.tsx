import React, { useState, useEffect } from 'react';
import { Button, useToast, MaterialSelector } from '@/components/shared';
import { getImageUrl } from '@/api/client';
import { listUserTemplates, uploadUserTemplate, deleteUserTemplate, type UserTemplate } from '@/api/endpoints';
import { materialUrlToFile } from '@/components/shared/MaterialSelector';
import type { Material } from '@/api/endpoints';
import { ImagePlus, X } from 'lucide-react';

const presetTemplates = [
  { id: '1', name: '复古卷轴', preview: '/templates/template_y.png' },
  { id: '2', name: '矢量插画', preview: '/templates/template_vector_illustration.png' },
  { id: '3', name: '拟物玻璃', preview: '/templates/template_glass.png' },
  
  { id: '4', name: '科技蓝', preview: '/templates/template_b.png' },
  { id: '5', name: '简约商务', preview: '/templates/template_s.png' },
  { id: '6', name: '学术报告', preview: '/templates/template_academic.jpg' },
];

interface TemplateSelectorProps {
  onSelect: (templateFile: File | null, templateId?: string) => void;
  selectedTemplateId?: string | null;
  selectedPresetTemplateId?: string | null;
  showUpload?: boolean; // 是否显示上传到用户模板库的选项
  projectId?: string | null; // 项目ID，用于素材选择器
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  onSelect,
  selectedTemplateId,
  selectedPresetTemplateId,
  showUpload = true,
  projectId,
}) => {
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isMaterialSelectorOpen, setIsMaterialSelectorOpen] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [saveToLibrary, setSaveToLibrary] = useState(true); // 上传模板时是否保存到模板库（默认勾选）
  const { show, ToastContainer } = useToast();

  // 加载用户模板列表
  useEffect(() => {
    loadUserTemplates();
  }, []);

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
        if (showUpload) {
          // 主页模式：直接上传到用户模板库
          const response = await uploadUserTemplate(file);
          if (response.data) {
            const template = response.data;
            setUserTemplates(prev => [template, ...prev]);
            onSelect(null, template.template_id);
            show({ message: '模板上传成功', type: 'success' });
          }
        } else {
          // 预览页模式：根据 saveToLibrary 状态决定是否保存到模板库
          if (saveToLibrary) {
            // 保存到模板库并应用
            const response = await uploadUserTemplate(file);
            if (response.data) {
              const template = response.data;
              setUserTemplates(prev => [template, ...prev]);
              onSelect(file, template.template_id);
              show({ message: '模板已保存到模板库', type: 'success' });
            }
          } else {
            // 仅应用到项目
            onSelect(file);
          }
        }
      } catch (error: any) {
        console.error('上传模板失败:', error);
        show({ message: '模板上传失败: ' + (error.message || '未知错误'), type: 'error' });
      }
    }
    // 清空 input，允许重复选择同一文件
    e.target.value = '';
  };

  const handleSelectUserTemplate = (template: UserTemplate) => {
    // 立即更新选择状态（不加载File，提升响应速度）
    onSelect(null, template.template_id);
  };

  const handleSelectPresetTemplate = (templateId: string, preview: string) => {
    if (!preview) return;
    // 立即更新选择状态（不加载File，提升响应速度）
    onSelect(null, templateId);
  };

  const handleSelectMaterials = async (materials: Material[], saveAsTemplate?: boolean) => {
    if (materials.length === 0) return;
    
    try {
      // 将第一个素材转换为File对象
      const file = await materialUrlToFile(materials[0]);
      
      // 根据 saveAsTemplate 参数决定是否保存到模板库
      if (saveAsTemplate) {
        // 保存到用户模板库
        const response = await uploadUserTemplate(file);
        if (response.data) {
          const template = response.data;
          setUserTemplates(prev => [template, ...prev]);
          // 传递文件和模板ID，适配不同的使用场景
          onSelect(file, template.template_id);
          show({ message: '素材已保存到模板库', type: 'success' });
        }
      } else {
        // 仅作为模板使用
        onSelect(file);
        show({ message: '已从素材库选择作为模板', type: 'success' });
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
        {/* 用户已保存的模板 */}
        {userTemplates.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">我的模板</h4>
            <div className="grid grid-cols-4 gap-4 mb-4">
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
                  {/* 删除按钮：仅用户模板，且未被选中时显示（常显） */}
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
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">预设模板</h4>
          <div className="grid grid-cols-4 gap-4">
            {/* 预设模板 */}
            {presetTemplates.map((template) => (
              <div
                key={template.id}
                onClick={() => template.preview && handleSelectPresetTemplate(template.id, template.preview)}
                className={`aspect-[4/3] rounded-lg border-2 cursor-pointer transition-all bg-gray-100 flex items-center justify-center relative ${
                  selectedPresetTemplateId === template.id
                    ? 'border-banana-500 ring-2 ring-banana-200'
                    : 'border-gray-200 hover:border-banana-500'
                }`}
              >
                {template.preview ? (
                  <>
                    <img
                      src={template.preview}
                      alt={template.name}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    {selectedPresetTemplateId === template.id && (
                      <div className="absolute inset-0 bg-banana-500 bg-opacity-20 flex items-center justify-center pointer-events-none">
                        <span className="text-white font-semibold text-sm">已选择</span>
                      </div>
                    )}
                  </>
                ) : (
                  <span className="text-sm text-gray-500">{template.name}</span>
                )}
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
          
          {/* 在预览页显示：上传模板时是否保存到模板库的选项 */}
          {!showUpload && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveToLibrary}
                  onChange={(e) => setSaveToLibrary(e.target.checked)}
                  className="w-4 h-4 text-banana-500 border-gray-300 rounded focus:ring-banana-500"
                />
                <span className="text-sm text-gray-700">
                  上传模板时同时保存到我的模板库
                </span>
              </label>
            </div>
          )}
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
 * @param templateId 模板ID
 * @param userTemplates 用户模板列表
 * @returns Promise<File | null>
 */
export const getTemplateFile = async (
  templateId: string,
  userTemplates: UserTemplate[]
): Promise<File | null> => {
  // 检查是否是预设模板
  const presetTemplate = presetTemplates.find(t => t.id === templateId);
  if (presetTemplate && presetTemplate.preview) {
    try {
      const response = await fetch(presetTemplate.preview);
      const blob = await response.blob();
      return new File([blob], presetTemplate.preview.split('/').pop() || 'template.png', { type: blob.type });
    } catch (error) {
      console.error('加载预设模板失败:', error);
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

