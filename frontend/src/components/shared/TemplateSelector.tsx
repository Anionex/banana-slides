import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, useToast, MaterialSelector } from '@/components/shared';
import { getImageUrl } from '@/api/client';
import { listUserTemplates, uploadUserTemplate, deleteUserTemplate, type UserTemplate } from '@/api/endpoints';
import { materialUrlToFile } from './materialUtils';
import { presetTemplates } from './templateUtils';
import type { Material } from '@/api/endpoints';
import { ImagePlus, X } from 'lucide-react';

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
  const { t } = useTranslation();
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isMaterialSelectorOpen, setIsMaterialSelectorOpen] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [saveToLibrary, setSaveToLibrary] = useState(true); // 上传模板时是否保存到模板库（默认勾选）
  const { show } = useToast();

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
            show({ message: t('components.template.toast.uploadSuccess'), type: 'success' });
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
              show({ message: t('components.template.toast.savedToLibrary'), type: 'success' });
            }
          } else {
            // 仅应用到项目
            onSelect(file);
          }
        }
      } catch (error: any) {
        console.error('上传模板失败:', error);
        show({ message: t('components.template.toast.uploadFailed') + ': ' + (error.message || t('components.template.toast.unknownError')), type: 'error' });
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
          show({ message: t('components.template.toast.materialSavedToLibrary'), type: 'success' });
        }
      } else {
        // 仅作为模板使用
        onSelect(file);
        show({ message: t('components.template.toast.selectedFromMaterial'), type: 'success' });
      }
    } catch (error: any) {
      console.error('加载素材失败:', error);
      show({ message: t('components.template.toast.loadMaterialFailed') + ': ' + (error.message || t('components.template.toast.unknownError')), type: 'error' });
    }
  };

  const handleDeleteUserTemplate = async (template: UserTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedTemplateId === template.template_id) {
      show({ message: t('components.template.toast.cannotDeleteActive'), type: 'info' });
      return;
    }
    setDeletingTemplateId(template.template_id);
    try {
      await deleteUserTemplate(template.template_id);
      setUserTemplates((prev) => prev.filter((t) => t.template_id !== template.template_id));
      show({ message: t('components.template.toast.deleteSuccess'), type: 'success' });
    } catch (error: any) {
      console.error('删除模板失败:', error);
      show({ message: t('components.template.toast.deleteFailed') + ': ' + (error.message || t('components.template.toast.unknownError')), type: 'error' });
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
            <h4 className="text-sm font-medium text-gray-700 mb-2">{t('components.template.myTemplates')}</h4>
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
                    src={getImageUrl(template.thumb_url || template.template_image_url)}
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
                      aria-label={t('components.template.deleteTemplate')}
                    >
                      <X size={12} />
                    </button>
                  )}
                  {selectedTemplateId === template.template_id && (
                    <div className="absolute inset-0 bg-banana-500 bg-opacity-20 flex items-center justify-center pointer-events-none">
                      <span className="text-white font-semibold text-sm">{t('components.template.selected')}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">{t('components.template.presets')}</h4>
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
                      src={template.thumb || template.preview}
                      alt={template.name}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    {selectedPresetTemplateId === template.id && (
                      <div className="absolute inset-0 bg-banana-500 bg-opacity-20 flex items-center justify-center pointer-events-none">
                        <span className="text-white font-semibold text-sm">{t('components.template.selected')}</span>
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
              <span className="text-sm text-gray-500">{t('components.template.upload')}</span>
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
                  {t('components.template.saveToLibrary')}
                </span>
              </label>
            </div>
          )}
        </div>

        {/* 从素材库选择作为模板 */}
        {projectId && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">{t('components.template.fromMaterial')}</h4>
            <Button
              variant="secondary"
              size="sm"
              icon={<ImagePlus size={16} />}
              onClick={() => setIsMaterialSelectorOpen(true)}
              className="w-full"
            >
              {t('components.template.fromMaterialButton')}
            </Button>
          </div>
        )}
      </div>
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


