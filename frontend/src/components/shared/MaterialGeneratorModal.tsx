import React, { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, ImagePlus, Upload, X, FolderOpen, Info } from 'lucide-react';
import { Modal } from './Modal';
import { useT } from '@/hooks/useT';
import { Textarea } from './Textarea';
import { Button } from './Button';
import { useToast } from './Toast';
import { MaterialSelector, materialUrlToFile } from './MaterialSelector';

// MaterialGeneratorModal 组件自包含翻译
const materialGeneratorI18n = {
  zh: {
    material: {
      title: "素材生成", saveToLibraryNote: "生成的素材会保存到素材库",
      generatedResult: "生成结果", generatedMaterial: "生成的素材", generatedPreview: "生成的素材会展示在这里",
      promptLabel: "提示词（原样发送给文生图模型）",
      promptPlaceholder: "例如：蓝紫色渐变背景，带几何图形和科技感线条，用于科技主题标题页...",
      referenceImages: "参考图片（可选）", mainReference: "主参考图（可选）", extraReference: "额外参考图（可选，多张）",
      clickToUpload: "点击上传", selectFromLibrary: "从素材库选择", generateMaterial: "生成素材",
      messages: {
        enterPrompt: "请输入提示词", materialAdded: "已添加 {{count}} 个素材",
        generateSuccess: "素材生成成功，已保存到历史素材库", generateSuccessGlobal: "素材生成成功，已保存到全局素材库",
        generateComplete: "素材生成完成，但未找到图片地址", generateFailed: "素材生成失败",
        generateTimeout: "素材生成超时，请稍后查看素材库", pollingFailed: "轮询任务状态失败，请稍后查看素材库",
        noTaskId: "素材生成失败：未返回任务ID"
      }
    }
  },
  en: {
    material: {
      title: "Generate Material", saveToLibraryNote: "Generated materials will be saved to the library",
      generatedResult: "Generated Result", generatedMaterial: "Generated Material", generatedPreview: "Generated materials will be displayed here",
      promptLabel: "Prompt (sent directly to text-to-image model)",
      promptPlaceholder: "e.g., Blue-purple gradient background with geometric shapes and tech-style lines for a tech-themed title page...",
      referenceImages: "Reference Images (Optional)", mainReference: "Main Reference (Optional)", extraReference: "Extra References (Optional, multiple)",
      clickToUpload: "Click to upload", selectFromLibrary: "Select from Library", generateMaterial: "Generate Material",
      messages: {
        enterPrompt: "Please enter a prompt", materialAdded: "Added {{count}} material(s)",
        generateSuccess: "Material generated successfully, saved to history library", generateSuccessGlobal: "Material generated successfully, saved to global library",
        generateComplete: "Material generation complete, but image URL not found", generateFailed: "Failed to generate material",
        generateTimeout: "Material generation timeout, please check the library later", pollingFailed: "Failed to poll task status, please check the library later",
        noTaskId: "Material generation failed: No task ID returned"
      }
    }
  }
};
import { Skeleton } from './Loading';
import { generateMaterialImage, getTaskStatus } from '@/api/endpoints';
import { getImageUrl } from '@/api/client';
import type { Material } from '@/api/endpoints';
import type { Task } from '@/types';

interface MaterialGeneratorModalProps {
  projectId?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const MaterialGeneratorModal: React.FC<MaterialGeneratorModalProps> = ({
  projectId,
  isOpen,
  onClose,
}) => {
  const t = useT(materialGeneratorI18n);
  const { show } = useToast();
  const [prompt, setPrompt] = useState('');
  const [refImage, setRefImage] = useState<File | null>(null);
  const [extraImages, setExtraImages] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isMaterialSelectorOpen, setIsMaterialSelectorOpen] = useState(false);

  const handleRefImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = (e.target.files && e.target.files[0]) || null;
    if (file) {
      setRefImage(file);
    }
  };

  const handleExtraImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (!refImage) {
      const [first, ...rest] = files;
      setRefImage(first);
      if (rest.length > 0) {
        setExtraImages((prev) => [...prev, ...rest]);
      }
    } else {
      setExtraImages((prev) => [...prev, ...files]);
    }
  };

  const removeExtraImage = (index: number) => {
    setExtraImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSelectMaterials = async (materials: Material[]) => {
    try {
      const files = await Promise.all(
        materials.map((material) => materialUrlToFile(material))
      );

      if (files.length === 0) return;

      if (!refImage) {
        const [first, ...rest] = files;
        setRefImage(first);
        if (rest.length > 0) {
          setExtraImages((prev) => [...prev, ...rest]);
        }
      } else {
        setExtraImages((prev) => [...prev, ...files]);
      }

      show({ message: t('material.messages.materialAdded', { count: files.length }), type: 'success' });
    } catch (error: any) {
      console.error('Failed to load materials:', error);
      show({
        message: t('material.messages.loadMaterialFailed') + ': ' + (error.message || t('common.unknownError')),
        type: 'error',
      });
    }
  };

  // Manage object URLs to prevent memory leaks
  const refImageUrl = useRef<string | null>(null);
  const extraImageUrls = useRef<string[]>([]);

  useEffect(() => {
    // Revoke previous URL
    if (refImageUrl.current) URL.revokeObjectURL(refImageUrl.current);
    refImageUrl.current = refImage ? URL.createObjectURL(refImage) : null;
  }, [refImage]);

  useEffect(() => {
    // Revoke all previous URLs
    extraImageUrls.current.forEach(url => URL.revokeObjectURL(url));
    extraImageUrls.current = extraImages.map(file => URL.createObjectURL(file));
  }, [extraImages]);

  useEffect(() => {
    return () => {
      if (refImageUrl.current) URL.revokeObjectURL(refImageUrl.current);
      extraImageUrls.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const pollMaterialTask = async (taskId: string) => {
    const targetProjectId = projectId || 'global';
    const maxAttempts = 60;
    let attempts = 0;

    const poll = async () => {
      try {
        attempts++;
        const response = await getTaskStatus(targetProjectId, taskId);
        const task: Task = response.data;

        if (task.status === 'COMPLETED') {
          const progress = task.progress || {};
          const imageUrl = progress.image_url;
          
          if (imageUrl) {
            setPreviewUrl(getImageUrl(imageUrl));
            const message = projectId
              ? t('material.messages.generateSuccess')
              : t('material.messages.generateSuccessGlobal');
            show({ message, type: 'success' });
            setIsCompleted(true);
          } else {
            show({ message: t('material.messages.generateComplete'), type: 'error' });
          }

          setIsGenerating(false);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        } else if (task.status === 'FAILED') {
          show({
            message: task.error_message || t('material.messages.generateFailed'),
            type: 'error',
          });
          setIsGenerating(false);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        } else if (task.status === 'PENDING' || task.status === 'PROCESSING') {
          if (attempts >= maxAttempts) {
            show({ message: t('material.messages.generateTimeout'), type: 'warning' });
            setIsGenerating(false);
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
          }
        }
      } catch (error: any) {
        console.error('Failed to poll task status:', error);
        if (attempts >= maxAttempts) {
          show({ message: t('material.messages.pollingFailed'), type: 'error' });
          setIsGenerating(false);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
      }
    };

    poll();
    pollingIntervalRef.current = setInterval(poll, 2000);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      show({ message: t('material.messages.enterPrompt'), type: 'error' });
      return;
    }

    setIsGenerating(true);
    try {
      const targetProjectId = projectId || 'none';
      const resp = await generateMaterialImage(targetProjectId, prompt.trim(), refImage as File, extraImages);
      const taskId = resp.data?.task_id;
      
      if (taskId) {
        await pollMaterialTask(taskId);
      } else {
        show({ message: t('material.messages.noTaskId'), type: 'error' });
        setIsGenerating(false);
      }
    } catch (error: any) {
      show({
        message: error?.response?.data?.error?.message || error.message || t('material.messages.generateFailed'),
        type: 'error',
      });
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('material.title')} size="lg">
      {/* 顶部提示信息 */}
      <div className="mb-5 px-4 py-3 rounded-xl bg-gradient-to-r from-banana-50/80 to-amber-50/80 dark:from-banana-900/20 dark:to-amber-900/20 border border-banana-200/50 dark:border-banana-700/30 backdrop-blur-sm">
        <p className="text-sm text-banana-800 dark:text-banana-200 flex items-center gap-2">
          <Info size={16} className="flex-shrink-0" />
          {t('material.saveToLibraryNote')}
        </p>
      </div>
      <div className="space-y-5">
        {/* 生成结果预览卡片 - 使用现代渐变和光晕效果 */}
        <div className="relative rounded-2xl overflow-hidden border border-gray-200/50 dark:border-white/10 p-5 bg-gradient-to-br from-gray-50/80 via-white/80 to-gray-50/80 dark:from-gray-900/40 dark:via-gray-800/40 dark:to-gray-900/40 backdrop-blur-xl shadow-lg">
          {/* 内部光晕 */}
          <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
            <div className="absolute -top-20 -left-20 w-40 h-40 bg-banana-400/10 dark:bg-banana-400/5 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-purple-400/10 dark:bg-purple-400/5 rounded-full blur-3xl" />
          </div>

          <div className="relative">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-gradient-to-b from-banana-400 to-banana-500 rounded-full" />
              {t('material.generatedResult')}
            </h4>
            {isGenerating ? (
              <div className="aspect-video rounded-xl overflow-hidden border border-gray-200/50 dark:border-white/10 shadow-inner">
                <Skeleton className="w-full h-full" />
              </div>
            ) : previewUrl ? (
              <div className="aspect-video bg-white/50 dark:bg-gray-900/50 rounded-xl overflow-hidden border border-gray-200/50 dark:border-white/10 flex items-center justify-center shadow-inner backdrop-blur-sm">
                <img
                  src={previewUrl}
                  alt={t('material.generatedMaterial')}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="aspect-video bg-gradient-to-br from-gray-100/50 via-gray-50/50 to-gray-100/50 dark:from-gray-800/30 dark:via-gray-900/30 dark:to-gray-800/30 rounded-xl flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 text-sm border border-dashed border-gray-300/50 dark:border-gray-600/50 backdrop-blur-sm">
                <ImageIcon size={48} className="mb-3 animate-pulse opacity-50" />
                <div className="font-medium">{t('material.generatedPreview')}</div>
              </div>
            )}
          </div>
        </div>

        <Textarea
          label={t('material.promptLabel')}
          placeholder={t('material.promptPlaceholder')}
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            if (isCompleted) setIsCompleted(false);
          }}
          rows={3}
        />

        {/* 参考图片上传区域 - 现代渐变设计 */}
        <div className="relative rounded-2xl overflow-hidden border border-gray-200/50 dark:border-white/10 p-5 bg-gradient-to-br from-indigo-50/30 via-white/80 to-purple-50/30 dark:from-indigo-950/20 dark:via-gray-800/40 dark:to-purple-950/20 backdrop-blur-xl shadow-lg">
          {/* 内部光晕 */}
          <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/4 w-32 h-32 bg-indigo-400/10 dark:bg-indigo-400/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-32 h-32 bg-purple-400/10 dark:bg-purple-400/5 rounded-full blur-3xl" />
          </div>

          <div className="relative space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200 font-medium">
                <ImagePlus size={18} className="text-indigo-500 dark:text-indigo-400" />
                <span>{t('material.referenceImages')}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={<FolderOpen size={16} />}
                onClick={() => setIsMaterialSelectorOpen(true)}
                className="hover:bg-indigo-100/50 dark:hover:bg-indigo-900/30"
              >
                {t('material.selectFromLibrary')}
              </Button>
            </div>

            <div className="flex flex-wrap gap-4">
              {/* 主参考图 */}
              <div className="space-y-2">
                <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">{t('material.mainReference')}</div>
                <label className="w-40 h-28 border-2 border-dashed border-indigo-300/50 dark:border-indigo-500/30 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-all duration-200 bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm relative group shadow-sm hover:shadow-md">
                  {refImage ? (
                    <>
                      <img
                        src={refImageUrl.current || ''}
                        alt={t('material.mainReference')}
                        className="w-full h-full object-cover rounded-xl"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setRefImage(null);
                        }}
                        className="absolute -top-2 -right-2 w-7 h-7 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg hover:scale-110 active:scale-95 z-10"
                      >
                        <X size={14} strokeWidth={2.5} />
                      </button>
                    </>
                  ) : (
                    <>
                      <ImageIcon size={28} className="text-indigo-400 dark:text-indigo-500 mb-1.5 group-hover:scale-110 transition-transform duration-200" />
                      <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">{t('material.clickToUpload')}</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleRefImageChange}
                  />
                </label>
              </div>

              {/* 额外参考图 */}
              <div className="flex-1 space-y-2 min-w-[180px]">
                <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">{t('material.extraReference')}</div>
                <div className="flex flex-wrap gap-2">
                  {extraImages.map((file, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={extraImageUrls.current[idx] || ''}
                        alt={`extra-${idx + 1}`}
                        className="w-20 h-20 object-cover rounded-lg border-2 border-indigo-200/50 dark:border-indigo-500/30 shadow-sm group-hover:shadow-md transition-all duration-200"
                      />
                      <button
                        onClick={() => removeExtraImage(idx)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg hover:scale-110 active:scale-95"
                      >
                        <X size={12} strokeWidth={2.5} />
                      </button>
                    </div>
                  ))}
                  <label className="w-20 h-20 border-2 border-dashed border-indigo-300/50 dark:border-indigo-500/30 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-all duration-200 bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm group shadow-sm hover:shadow-md">
                    <Upload size={20} className="text-indigo-400 dark:text-indigo-500 mb-1 group-hover:scale-110 transition-transform duration-200" />
                    <span className="text-[10px] text-gray-600 dark:text-gray-400 font-medium">{t('common.add')}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleExtraImagesChange}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 底部按钮区域 */}
        <div className="flex justify-end gap-3 pt-3">
          <Button variant="ghost" onClick={handleClose} disabled={isGenerating}>
            {t('common.close')}
          </Button>
          <Button
            variant="primary"
            onClick={handleGenerate}
            disabled={isGenerating || isCompleted || !prompt.trim()}
            className="shadow-lg shadow-banana-500/20 hover:shadow-xl hover:shadow-banana-500/30 transition-all duration-200"
          >
            {isGenerating ? t('common.generating') : isCompleted ? t('common.completed') : t('material.generateMaterial')}
          </Button>
        </div>
      </div>
      <MaterialSelector
        projectId={projectId}
        isOpen={isMaterialSelectorOpen}
        onClose={() => setIsMaterialSelectorOpen(false)}
        onSelect={handleSelectMaterials}
        multiple={true}
      />
    </Modal>
  );
};
