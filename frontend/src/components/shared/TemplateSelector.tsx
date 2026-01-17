import React, { useState, useEffect, useCallback } from 'react';
import { Button, useToast, MaterialSelector } from '@/components/shared';
import { getImageUrl } from '@/api/client';
import { listUserTemplates, uploadUserTemplate, deleteUserTemplate, type UserTemplate } from '@/api/endpoints';
import { materialUrlToFile } from '@/components/shared/MaterialSelector';
import type { Material } from '@/api/endpoints';
import { ImagePlus, X, Layers } from 'lucide-react';

const presetTemplates = [
  { id: '1', name: '复古卷轴', preview: '/templates/template_y.png' },
  { id: '2', name: '矢量插画', preview: '/templates/template_vector_illustration.png' },
  { id: '3', name: '拟物玻璃', preview: '/templates/template_glass.png' },

  { id: '4', name: '科技蓝', preview: '/templates/template_b.png' },
  { id: '5', name: '简约商务', preview: '/templates/template_s.png' },
  { id: '6', name: '学术报告', preview: '/templates/template_academic.jpg' },
];

// 多张模板文件类型
export interface MultiTemplateFile {
  id: string;
  file: File;
  previewUrl: string;
  orderIndex: number;
}

// 选择类型：单张预设/用户模板 或 多张页级模板
export type TemplateSelectionType = 'single' | 'multi';

interface TemplateSelectorProps {
  onSelect: (templateFile: File | null, templateId?: string) => void;
  selectedTemplateId?: string | null;
  selectedPresetTemplateId?: string | null;
  showUpload?: boolean;
  projectId?: string | null;
  // 多模板相关
  multiTemplates?: MultiTemplateFile[];
  onMultiTemplatesChange?: (templates: MultiTemplateFile[]) => void;
  selectionType?: TemplateSelectionType;
  onSelectionTypeChange?: (type: TemplateSelectionType) => void;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  onSelect,
  selectedTemplateId,
  selectedPresetTemplateId,
  showUpload = true,
  projectId,
  multiTemplates = [],
  onMultiTemplatesChange,
  selectionType = 'single',
  onSelectionTypeChange,
}) => {
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isMaterialSelectorOpen, setIsMaterialSelectorOpen] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [saveToLibrary, setSaveToLibrary] = useState(true);
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

  const generateId = () => `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // 处理多张模板上传
  const handleMultiFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const imageFiles = fileArray.filter(file =>
      file.type.startsWith('image/') ||
      /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file.name)
    );

    if (imageFiles.length === 0) {
      show({ message: '请选择图片文件', type: 'error' });
      return;
    }

    const maxTemplates = 50;
    const availableSlots = maxTemplates - multiTemplates.length;
    if (imageFiles.length > availableSlots) {
      show({
        message: `最多可上传 ${maxTemplates} 张模板，已选择前 ${availableSlots} 张`,
        type: 'info'
      });
    }

    const filesToAdd = imageFiles.slice(0, availableSlots);
    const newTemplates: MultiTemplateFile[] = filesToAdd.map((file, index) => ({
      id: generateId(),
      file,
      previewUrl: URL.createObjectURL(file),
      orderIndex: multiTemplates.length + index,
    }));

    const updatedTemplates = [...multiTemplates, ...newTemplates];
    onMultiTemplatesChange?.(updatedTemplates);

    // 自动切换到多模板模式
    if (updatedTemplates.length > 0) {
      onSelectionTypeChange?.('multi');
      // 清除单张选择
      onSelect(null, undefined);
    }
  }, [multiTemplates, onMultiTemplatesChange, onSelectionTypeChange, onSelect, show]);

  const handleRemoveMultiTemplate = (id: string) => {
    const template = multiTemplates.find(t => t.id === id);
    if (template) {
      URL.revokeObjectURL(template.previewUrl);
    }
    const updated = multiTemplates
      .filter(t => t.id !== id)
      .map((t, index) => ({ ...t, orderIndex: index }));
    onMultiTemplatesChange?.(updated);

    // 如果全部删除，切换回单张模式
    if (updated.length === 0) {
      onSelectionTypeChange?.('single');
    }
  };

  const handleClearAllMulti = () => {
    multiTemplates.forEach(t => URL.revokeObjectURL(t.previewUrl));
    onMultiTemplatesChange?.([]);
    onSelectionTypeChange?.('single');
  };

  // 选择多模板卡片（切换到多模板模式）
  const handleSelectMultiTemplates = () => {
    if (multiTemplates.length > 0) {
      onSelectionTypeChange?.('multi');
      onSelect(null, undefined); // 清除单张选择
    }
  };

  // 统一处理模板上传（支持单张和多张）
  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      e.target.value = '';
      return;
    }

    // 过滤出图片文件
    const imageFiles = Array.from(files).filter(file =>
      file.type.startsWith('image/') ||
      /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file.name)
    );

    if (imageFiles.length === 0) {
      show({ message: '请选择图片文件', type: 'error' });
      e.target.value = '';
      return;
    }

    // 根据文件数量决定模式
    if (imageFiles.length === 1) {
      // 单张模式：上传到模板库
      const file = imageFiles[0];
      try {
        if (showUpload) {
          const response = await uploadUserTemplate(file);
          if (response.data) {
            const template = response.data;
            setUserTemplates(prev => [template, ...prev]);
            onSelect(null, template.template_id);
            onSelectionTypeChange?.('single');
            show({ message: '模板上传成功', type: 'success' });
          }
        } else {
          if (saveToLibrary) {
            const response = await uploadUserTemplate(file);
            if (response.data) {
              const template = response.data;
              setUserTemplates(prev => [template, ...prev]);
              onSelect(file, template.template_id);
              onSelectionTypeChange?.('single');
              show({ message: '模板已保存到模板库', type: 'success' });
            }
          } else {
            onSelect(file);
            onSelectionTypeChange?.('single');
          }
        }
      } catch (error: any) {
        console.error('上传模板失败:', error);
        show({ message: '模板上传失败: ' + (error.message || '未知错误'), type: 'error' });
      }
    } else {
      // 多张模式：添加到多模板列表
      handleMultiFiles(imageFiles);
      show({ message: `已添加 ${imageFiles.length} 张参考模板`, type: 'success' });
    }

    e.target.value = '';
  };

  const handleSelectUserTemplate = (template: UserTemplate) => {
    onSelect(null, template.template_id);
    onSelectionTypeChange?.('single');
  };

  const handleSelectPresetTemplate = (templateId: string, preview: string) => {
    if (!preview) return;
    onSelect(null, templateId);
    onSelectionTypeChange?.('single');
  };

  const handleSelectMaterials = async (materials: Material[], saveAsTemplate?: boolean) => {
    if (materials.length === 0) return;

    try {
      const file = await materialUrlToFile(materials[0]);

      if (saveAsTemplate) {
        const response = await uploadUserTemplate(file);
        if (response.data) {
          const template = response.data;
          setUserTemplates(prev => [template, ...prev]);
          onSelect(file, template.template_id);
          onSelectionTypeChange?.('single');
          show({ message: '素材已保存到模板库', type: 'success' });
        }
      } else {
        onSelect(file);
        onSelectionTypeChange?.('single');
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

  // 判断是否选中了单张模板
  const hasSingleSelection = !!(selectedTemplateId || selectedPresetTemplateId);
  // 判断是否有多模板
  const hasMultiTemplates = multiTemplates.length > 0;
  // 是否处于多模板模式
  const isMultiMode = selectionType === 'multi' && hasMultiTemplates;

  return (
    <>
      <div className="space-y-4">
        {/* 多张参考模板卡片 - 堆叠显示 */}
        {hasMultiTemplates && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Layers size={14} />
              多页模板
              <span className="text-xs text-gray-500 font-normal">({multiTemplates.length}张)</span>
            </h4>
            <div className="flex gap-4 items-start">
              {/* 堆叠卡片显示 */}
              <div
                onClick={handleSelectMultiTemplates}
                className={`relative w-32 h-24 cursor-pointer transition-all ${
                  isMultiMode
                    ? 'ring-2 ring-banana-500 ring-offset-2'
                    : 'hover:ring-2 hover:ring-banana-300 hover:ring-offset-1'
                }`}
              >
                {/* 堆叠效果：显示前3张 */}
                {multiTemplates.slice(0, 3).map((template, index) => (
                  <div
                    key={template.id}
                    className="absolute rounded-lg border-2 border-white shadow-md overflow-hidden bg-white"
                    style={{
                      width: '100%',
                      height: '100%',
                      transform: `rotate(${(index - 1) * 5}deg) translateX(${index * 4}px)`,
                      zIndex: 3 - index,
                    }}
                  >
                    <img
                      src={template.previewUrl}
                      alt={`模板 ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
                {/* 数量标签 */}
                <div className="absolute -top-2 -right-2 bg-banana-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow z-10">
                  {multiTemplates.length}
                </div>
                {/* 选中状态遮罩 */}
                {isMultiMode && (
                  <div className="absolute inset-0 bg-banana-500 bg-opacity-20 rounded-lg flex items-center justify-center z-10">
                    <span className="text-white font-semibold text-xs bg-banana-500 px-2 py-1 rounded">已选择</span>
                  </div>
                )}
              </div>

              {/* 操作按钮 */}
              <div className="flex flex-col gap-2">
                <label className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors">
                  添加更多
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleTemplateUpload}
                    className="hidden"
                  />
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAllMulti}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  清空全部
                </Button>
              </div>
            </div>

            {/* 模板预览网格 */}
            {isMultiMode && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">按顺序与页面一一对应（拖拽可调整顺序）</p>
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                  {multiTemplates.map((template, index) => (
                    <div
                      key={template.id}
                      className="relative aspect-[4/3] rounded border border-gray-200 overflow-hidden group"
                    >
                      <img
                        src={template.previewUrl}
                        alt={`模板 ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-0.5 right-0.5">
                        <span className="text-xs font-bold text-white bg-banana-500 px-1 rounded">
                          {index + 1}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveMultiTemplate(template.id);
                        }}
                        className="absolute top-0.5 left-0.5 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

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
                    selectedTemplateId === template.template_id && !isMultiMode
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
                  {selectedTemplateId === template.template_id && !isMultiMode && (
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
                  selectedPresetTemplateId === template.id && !isMultiMode
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
                    {selectedPresetTemplateId === template.id && !isMultiMode && (
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

            {/* 上传模板（支持单张或多张） */}
            <label className="aspect-[4/3] rounded-lg border-2 border-dashed border-gray-300 hover:border-banana-500 cursor-pointer transition-all flex flex-col items-center justify-center gap-1 relative overflow-hidden">
              <span className="text-2xl">+</span>
              <span className="text-sm text-gray-500">上传模板</span>
              <span className="text-xs text-gray-400">支持多选</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleTemplateUpload}
                className="hidden"
                disabled={isLoadingTemplates}
              />
            </label>
          </div>

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
  userTemplates: UserTemplate[]
): Promise<File | null> => {
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
