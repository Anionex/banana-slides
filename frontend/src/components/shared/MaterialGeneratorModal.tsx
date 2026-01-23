import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Image as ImageIcon, ImagePlus, Upload, X, FolderOpen } from 'lucide-react';
import { Modal } from './Modal';
import { Textarea } from './Textarea';
import { Button } from './Button';
import { useToast } from './Toast';
import { MaterialSelector } from './MaterialSelector';
import { materialUrlToFile } from './materialUtils';
import { Skeleton } from './Loading';
import type { Material } from '@/api/endpoints';
import type { Task } from '@/types';

interface MaterialGeneratorModalProps {
  projectId?: string | null; // 可选，如果不提供则生成全局素材
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 素材生成模态卡片
 * - 输入提示词 + 上传参考图
 * - 提示词原样传给文生图模型（不做额外修饰）
 * - 生成结果展示在模态顶部
 * - 结果统一保存在项目下的历史素材库（backend /uploads/{projectId}/materials）
 */
export const MaterialGeneratorModal: React.FC<MaterialGeneratorModalProps> = ({
  projectId,
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
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

    // 如果还没有主参考图，优先把第一张作为主参考图，其余作为额外参考图
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
      // 将选中的素材转换为File对象
      const files = await Promise.all(
        materials.map((material) => materialUrlToFile(material))
      );

      if (files.length === 0) return;

      // 如果没有主图，优先把第一张设为主参考图
      if (!refImage) {
        const [first, ...rest] = files;
        setRefImage(first);
        if (rest.length > 0) {
          setExtraImages((prev) => [...prev, ...rest]);
        }
      } else {
        setExtraImages((prev) => [...prev, ...files]);
      }

      show({ message: t('preview.toast.materialsAdded', { count: files.length }), type: 'success' });
    } catch (error: any) {
      console.error('Failed to load materials:', error);
      show({
        message: t('preview.toast.loadMaterialsFailed', { error: error.message || t('common.unknownError') }),
        type: 'error',
      });
    }
  };

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 清理轮询
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const pollMaterialTask = async (taskId: string) => {
    const targetProjectId = projectId || 'global'; // 使用'global'作为Task的project_id
    const maxAttempts = 60; // 最多轮询60次（约2分钟）
    let attempts = 0;

    const poll = async () => {
      try {
        attempts++;
        const response = await getTaskStatus(targetProjectId, taskId);
        const task = response.data as Task;

        if (!task) return;

        if (task.status === 'COMPLETED') {
          // 任务完成，从progress中获取结果
          const progress = task.progress || {} as { image_url?: string };
          const imageUrl = progress.image_url;

          if (imageUrl) {
            setPreviewUrl(getImageUrl(imageUrl));
            const message = projectId
              ? t('components.materialGenerator.successProject', 'Material generated and saved to project library')
              : t('components.materialGenerator.successGlobal', 'Material generated and saved to global library');
            show({ message, type: 'success' });
            setIsCompleted(true);
          } else {
            show({ message: t('components.materialGenerator.noImageUrl', 'Generation completed but no image URL found'), type: 'error' });
          }

          setIsGenerating(false);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        } else if (task.status === 'FAILED') {
          show({
            message: task.error_message || t('components.materialGenerator.failed', 'Material generation failed'),
            type: 'error',
          });
          setIsGenerating(false);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        } else if (task.status === 'PENDING' || task.status === 'RUNNING') {
          // 继续轮询
          if (attempts >= maxAttempts) {
            show({ message: t('components.materialGenerator.timeout', 'Generation timeout, check library later'), type: 'info' });
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
          show({ message: t('components.materialGenerator.pollFailed', 'Failed to poll status, check library later'), type: 'error' });
          setIsGenerating(false);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
      }
    };

    // 立即执行一次，然后每2秒轮询一次
    poll();
    pollingIntervalRef.current = setInterval(poll, 2000);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      show({ message: t('components.materialGenerator.promptRequired', 'Please enter a prompt'), type: 'error' });
      return;
    }

    setIsGenerating(true);
    try {
      // 如果没有projectId，使用'none'表示生成全局素材（后端会转换为'global'用于Task）
      const targetProjectId = projectId || 'none';
      const resp = await generateMaterialImage(targetProjectId, prompt.trim(), refImage as File, extraImages);
      const taskId = resp.data?.task_id;

      if (taskId) {
        // 开始轮询任务状态
        await pollMaterialTask(taskId);
      } else {
        show({ message: t('components.materialGenerator.noTaskId', 'Generation failed: No task ID returned'), type: 'error' });
        setIsGenerating(false);
      }
    } catch (error: any) {
      show({
        message: error?.response?.data?.error?.message || error.message || t('components.materialGenerator.failed'),
        type: 'error',
      });
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('components.materialGenerator.title')} size="lg">
      <blockquote className="text-sm text-gray-500 mb-4">{t('components.materialGenerator.hint')}</blockquote>
      <div className="space-y-4">
        {/* 顶部：生成结果预览（始终显示最新一次生成） */}
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">{t('components.materialGenerator.result')}</h4>
          {isGenerating ? (
            <div className="aspect-video rounded-lg overflow-hidden border border-gray-200">
              <Skeleton className="w-full h-full" />
            </div>
          ) : previewUrl ? (
            <div className="aspect-video bg-white rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center">
              <img
                src={previewUrl}
                alt={t('components.materialGenerator.result')}
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="aspect-video bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-400 text-sm">
              <div className="text-3xl mb-2">🎨</div>
              <div>{t('components.materialGenerator.resultPlaceholder')}</div>
            </div>
          )}
        </div>

        {/* 提示词：原样传给模型 */}
        <Textarea
          label={t('components.materialGenerator.promptLabel')}
          placeholder={t('components.materialGenerator.promptPlaceholder')}
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            if (isCompleted) setIsCompleted(false);
          }}
          rows={3}
        />

        {/* 参考图上传区 */}
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <ImagePlus size={16} className="text-gray-500" />
              <span className="font-medium">{t('components.materialGenerator.referenceImages')}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={<FolderOpen size={16} />}
              onClick={() => setIsMaterialSelectorOpen(true)}
            >
              {t('components.materialGenerator.selectFromLibrary')}
            </Button>
          </div>
          <div className="flex flex-wrap gap-4">
            {/* 主参考图（可选） */}
            <div className="space-y-2">
              <div className="text-xs text-gray-600">{t('components.materialGenerator.mainReference')}</div>
              <label className="w-40 h-28 border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center cursor-pointer hover:border-banana-500 transition-colors bg-white relative group">
                {refImage ? (
                  <>
                    <img
                      src={URL.createObjectURL(refImage)}
                      alt={t('components.materialGenerator.mainReference')}
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
                    <span className="text-xs text-gray-500">{t('components.materialGenerator.clickToUpload')}</span>
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

            {/* 额外参考图（可选） */}
            <div className="flex-1 space-y-2 min-w-[180px]">
              <div className="text-xs text-gray-600">{t('components.materialGenerator.extraReference')}</div>
              <div className="flex flex-wrap gap-2">
                {extraImages.map((file, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`extra-${idx + 1}`}
                      className="w-20 h-20 object-cover rounded border border-gray-300"
                    />
                    <button
                      onClick={() => removeExtraImage(idx)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center cursor-pointer hover:border-banana-500 transition-colors bg-white">
                  <Upload size={18} className="text-gray-400 mb-1" />
                  <span className="text-[11px] text-gray-500">{t('components.materialGenerator.add')}</span>
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
            {isGenerating ? t('components.materialGenerator.generating') : isCompleted ? t('components.materialGenerator.completed', 'Completed') : t('components.materialGenerator.generateButton')}
          </Button>
        </div>
      </div>
      {/* 素材选择器 */}
      <MaterialSelector
        projectId={projectId ?? undefined}
        isOpen={isMaterialSelectorOpen}
        onClose={() => setIsMaterialSelectorOpen(false)}
        onSelect={handleSelectMaterials}
        multiple={true}
      />
    </Modal>
  );
};


