import React, { useState, useRef } from 'react';
import { Edit2, FileText, RefreshCw } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { Card, ContextualStatusBadge, Button, Modal, Textarea, Skeleton, Markdown } from '@/components/shared';
import { useDescriptionGeneratingState } from '@/hooks/useGeneratingState';
import { uploadMaterial } from '@/api/endpoints';
import type { Page, DescriptionContent } from '@/types';

// DescriptionCard 组件自包含翻译
const descriptionCardI18n = {
  zh: {
    descriptionCard: {
      page: "第 {{num}} 页", regenerate: "重新生成",
      descriptionTitle: "编辑页面描述", description: "描述",
      noDescription: "还没有生成描述",
      uploadingImage: "正在上传图片...",
      imageUploadSuccess: "图片已插入",
      imageUploadFailed: "图片上传失败",
      pasteImageHint: "支持粘贴图片"
    }
  },
  en: {
    descriptionCard: {
      page: "Page {{num}}", regenerate: "Regenerate",
      descriptionTitle: "Edit Descriptions", description: "Description",
      noDescription: "No description generated yet",
      uploadingImage: "Uploading image...",
      imageUploadSuccess: "Image inserted",
      imageUploadFailed: "Image upload failed",
      pasteImageHint: "Paste images supported"
    }
  }
};

export interface DescriptionCardProps {
  page: Page;
  index: number;
  projectId?: string;
  onUpdate: (data: Partial<Page>) => void;
  onRegenerate: () => void;
  isGenerating?: boolean;
  isAiRefining?: boolean;
}

export const DescriptionCard: React.FC<DescriptionCardProps> = ({
  page,
  index,
  projectId,
  onUpdate,
  onRegenerate,
  isGenerating = false,
  isAiRefining = false,
}) => {
  const t = useT(descriptionCardI18n);
  // 从 description_content 提取文本内容
  const getDescriptionText = (descContent: DescriptionContent | undefined): string => {
    if (!descContent) return '';
    if ('text' in descContent) {
      return descContent.text;
    } else if ('text_content' in descContent && Array.isArray(descContent.text_content)) {
      return descContent.text_content.join('\n');
    }
    return '';
  };

  const text = getDescriptionText(page.description_content);

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  // 使用专门的描述生成状态 hook，不受图片生成状态影响
  const generating = useDescriptionGeneratingState(isGenerating, isAiRefining);

  const handleEdit = () => {
    // 在打开编辑对话框时，从当前的 page 获取最新值
    const currentText = getDescriptionText(page.description_content);
    setEditContent(currentText);
    setIsEditing(true);
  };

  const handleSave = () => {
    // 保存时使用 text 格式（后端期望的格式）
    onUpdate({
      description_content: {
        text: editContent,
      } as DescriptionContent,
    });
    setIsEditing(false);
  };

  // 处理编辑框中的图片粘贴
  const handleEditPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (!file || isUploadingImage) return;

        e.preventDefault();
        setIsUploadingImage(true);

        try {
          // 保存光标位置
          const cursorPos = editTextareaRef.current?.selectionStart || editContent.length;

          // 上传图片到素材库，并请求 AI 生成描述
          const response = await uploadMaterial(file, projectId || null, true);

          if (response?.data?.url) {
            const caption = response.data.caption || 'image';
            const markdownImage = `![${caption}](${response.data.url})`;

            // 在光标位置插入图片链接
            setEditContent(prev => {
              const before = prev.slice(0, cursorPos);
              const after = prev.slice(cursorPos);
              const prefix = before && !before.endsWith('\n') ? '\n' : '';
              const suffix = after && !after.startsWith('\n') ? '\n' : '';
              return before + prefix + markdownImage + suffix + after;
            });
          }
        } catch (error) {
          console.error('Image upload failed in description editor:', error);
        } finally {
          setIsUploadingImage(false);
        }
        return;
      }
    }
  };

  return (
    <>
      <Card className="p-0 overflow-hidden flex flex-col">
        {/* 标题栏 */}
        <div className="bg-banana-50 px-4 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{t('descriptionCard.page', { num: index + 1 })}</span>
              {page.part && (
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                  {page.part}
                </span>
              )}
            </div>
            <ContextualStatusBadge page={page} context="description" />
          </div>
        </div>

        {/* 内容 */}
        <div className="p-4 flex-1">
          {generating ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <div className="text-center py-4 text-gray-500 text-sm">
                {t('common.generating')}
              </div>
            </div>
          ) : text ? (
            <div className="text-sm text-gray-700">
              <Markdown>{text}</Markdown>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <div className="flex text-3xl mb-2 justify-center"><FileText className="text-gray-400" size={48} /></div>
              <p className="text-sm">{t('descriptionCard.noDescription')}</p>
            </div>
          )}
        </div>

        {/* 操作栏 */}
        <div className="border-t border-gray-100 px-4 py-3 flex justify-end gap-2 mt-auto">
          <Button
            variant="ghost"
            size="sm"
            icon={<Edit2 size={16} />}
            onClick={handleEdit}
            disabled={generating}
          >
            {t('common.edit')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw size={16} className={generating ? 'animate-spin' : ''} />}
            onClick={onRegenerate}
            disabled={generating}
          >
            {generating ? t('common.generating') : t('descriptionCard.regenerate')}
          </Button>
        </div>
      </Card>

      {/* 编辑对话框 */}
      <Modal
        isOpen={isEditing}
        onClose={() => setIsEditing(false)}
        title={t('descriptionCard.descriptionTitle')}
        size="lg"
      >
        <div className="space-y-4">
          <div className="relative">
            <Textarea
              ref={editTextareaRef}
              label={t('descriptionCard.description')}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onPaste={handleEditPaste}
              rows={12}
              placeholder={t('descriptionCard.pasteImageHint')}
            />
            {isUploadingImage && (
              <div className="absolute inset-0 bg-white/60 dark:bg-black/40 flex items-center justify-center rounded-lg">
                <span className="text-sm text-gray-600 dark:text-gray-300">{t('descriptionCard.uploadingImage')}</span>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setIsEditing(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleSave}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
