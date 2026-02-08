import React, { useState, useRef, useCallback } from 'react';
import { Edit2, FileText, RefreshCw } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { useImagePaste } from '@/hooks/useImagePaste';
import { Card, ContextualStatusBadge, Button, Modal, Skeleton, Markdown } from '@/components/shared';
import { MarkdownTextarea, type MarkdownTextareaRef } from '@/components/shared/MarkdownTextarea';
import { useDescriptionGeneratingState } from '@/hooks/useGeneratingState';
import type { Page, DescriptionContent } from '@/types';

// DescriptionCard 组件自包含翻译
const descriptionCardI18n = {
  zh: {
    descriptionCard: {
      page: "第 {{num}} 页", regenerate: "重新生成",
      descriptionTitle: "编辑页面描述", description: "描述",
      noDescription: "还没有生成描述",
      uploadingImage: "正在上传图片...",
      descriptionPlaceholder: "输入页面描述, 可包含页面文字、素材、排版设计等信息，支持粘贴图片"
    }
  },
  en: {
    descriptionCard: {
      page: "Page {{num}}", regenerate: "Regenerate",
      descriptionTitle: "Edit Descriptions", description: "Description",
      noDescription: "No description generated yet",
      uploadingImage: "Uploading image...",
      descriptionPlaceholder: "Enter page description, can include page text, materials, layout design, etc., support pasting images"
    }
  }
};

export interface DescriptionCardProps {
  page: Page;
  index: number;
  projectId?: string;
  showToast: (props: { message: string; type: 'success' | 'error' | 'info' | 'warning' }) => void;
  onUpdate: (data: Partial<Page>) => void;
  onRegenerate: () => void;
  isGenerating?: boolean;
  isAiRefining?: boolean;
}

export const DescriptionCard: React.FC<DescriptionCardProps> = ({
  page,
  index,
  projectId,
  showToast,
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
  const textareaRef = useRef<MarkdownTextareaRef>(null);

  // Callback to insert at cursor position in the textarea
  const insertAtCursor = useCallback((markdown: string) => {
    textareaRef.current?.insertAtCursor(markdown);
  }, []);

  const { handlePaste, handleFiles, isUploading } = useImagePaste({
    projectId,
    setContent: setEditContent,
    showToast: showToast,
    insertAtCursor,
  });

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

  return (
    <>
      <Card className="p-0 overflow-hidden flex flex-col">
        {/* 标题栏 */}
        <div className="bg-banana-50 dark:bg-background-hover px-4 py-3 border-b border-gray-100 dark:border-border-primary">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 dark:text-foreground-primary">{t('descriptionCard.page', { num: index + 1 })}</span>
              {page.part && (
                <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
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
              <div className="text-center py-4 text-gray-500 dark:text-foreground-tertiary text-sm">
                {t('common.generating')}
              </div>
            </div>
          ) : text ? (
            <div className="text-sm text-gray-700 dark:text-foreground-secondary">
              <Markdown>{text}</Markdown>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400 dark:text-foreground-tertiary">
              <div className="flex text-3xl mb-2 justify-center"><FileText className="text-gray-400 dark:text-foreground-tertiary" size={48} /></div>
              <p className="text-sm">{t('descriptionCard.noDescription')}</p>
            </div>
          )}
        </div>

        {/* 操作栏 */}
        <div className="border-t border-gray-100 dark:border-border-primary px-4 py-3 flex justify-end gap-2 mt-auto">
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
          <MarkdownTextarea
            ref={textareaRef}
            label={t('descriptionCard.description')}
            value={editContent}
            onChange={setEditContent}
            onPaste={handlePaste}
            onFiles={handleFiles}
            rows={12}
            placeholder={t('descriptionCard.descriptionPlaceholder')}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setIsEditing(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={isUploading}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
