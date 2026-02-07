import React, { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, ImagePlus, Upload, X, FolderOpen } from 'lucide-react';
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
      <blockquote className="text-sm text-gray-500 dark:text-foreground-tertiary mb-4">{t('material.saveToLibraryNote')}</blockquote>
      <div className="space-y-4">
        <div className="bg-gray-50 dark:bg-background-primary rounded-lg border border-gray-200 dark:border-border-primary p-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-foreground-secondary mb-2">{t('material.generatedResult')}</h4>
          {isGenerating ? (
            <div className="aspect-video rounded-lg overflow-hidden border border-gray-200 dark:border-border-primary">
              <Skeleton className="w-full h-full" />
            </div>
          ) : previewUrl ? (
            <div className="aspect-video bg-white dark:bg-background-secondary rounded-lg overflow-hidden border border-gray-200 dark:border-border-primary flex items-center justify-center">
              <img
                src={previewUrl}
                alt={t('material.generatedMaterial')}
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="aspect-video bg-gray-100 dark:bg-background-secondary rounded-lg flex flex-col items-center justify-center text-gray-400 text-sm">
              <div className="text-3xl mb-2">🎨</div>
              <div>{t('material.generatedPreview')}</div>
            </div>
          )}
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

        <div className="bg-gray-50 dark:bg-background-primary rounded-lg border border-gray-200 dark:border-border-primary p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-foreground-secondary">
              <ImagePlus size={16} className="text-gray-500 dark:text-foreground-tertiary" />
              <span className="font-medium">{t('material.referenceImages')}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={<FolderOpen size={16} />}
              onClick={() => setIsMaterialSelectorOpen(true)}
            >
              {t('material.selectFromLibrary')}
            </Button>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <div className="text-xs text-gray-600 dark:text-foreground-tertiary">{t('material.mainReference')}</div>
              <label className="w-40 h-28 border-2 border-dashed border-gray-300 dark:border-border-primary rounded flex flex-col items-center justify-center cursor-pointer hover:border-banana-500 transition-colors bg-white dark:bg-background-secondary relative group">
                {refImage ? (
                  <>
                    <img
                      src={refImageUrl.current || ''}
                      alt={t('material.mainReference')}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setRefImage(null);
                      }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow z-10"
                    >
                      <X size={12} />
                    </button>
                  </>
                ) : (
                  <>
                    <ImageIcon size={24} className="text-gray-400 mb-1" />
                    <span className="text-xs text-gray-500 dark:text-foreground-tertiary">{t('material.clickToUpload')}</span>
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

            <div className="flex-1 space-y-2 min-w-[180px]">
              <div className="text-xs text-gray-600 dark:text-foreground-tertiary">{t('material.extraReference')}</div>
              <div className="flex flex-wrap gap-2">
                {extraImages.map((file, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={extraImageUrls.current[idx] || ''}
                      alt={`extra-${idx + 1}`}
                      className="w-20 h-20 object-cover rounded border border-gray-300 dark:border-border-primary"
                    />
                    <button
                      onClick={() => removeExtraImage(idx)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <label className="w-20 h-20 border-2 border-dashed border-gray-300 dark:border-border-primary rounded flex flex-col items-center justify-center cursor-pointer hover:border-banana-500 transition-colors bg-white dark:bg-background-secondary">
                  <Upload size={18} className="text-gray-400 mb-1" />
                  <span className="text-[11px] text-gray-500 dark:text-foreground-tertiary">{t('common.add')}</span>
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

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={handleClose} disabled={isGenerating}>
            {t('common.close')}
          </Button>
          <Button
            variant="primary"
            onClick={handleGenerate}
            disabled={isGenerating || isCompleted || !prompt.trim()}
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
