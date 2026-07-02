import React, { useState, useRef, useCallback } from 'react';
import { Edit2, FileText, RefreshCw, Tag, Layout, Image, Focus, MessageSquare, ImageOff } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { useImagePaste, buildMaterialsMarkdown } from '@/hooks/useImagePaste';
import { Card, ContextualStatusBadge, Button, Modal, Skeleton, Markdown, MaterialSelector } from '@/components/shared';
import { MarkdownTextarea, type MarkdownTextareaRef } from '@/components/shared/MarkdownTextarea';
import { useDescriptionGeneratingState } from '@/hooks/useGeneratingState';
import type { Page, DescriptionContent, Material } from '@/types';

// DescriptionCard 组件自包含翻译
const descriptionCardI18n = {
  zh: {
    descriptionCard: {
      page: "第 {{num}} 页", regenerate: "重新生成",
      descriptionTitle: "编辑页面描述", description: "描述",
      noDescription: "还没有生成描述",
      uploadingImage: "正在上传图片...",
      descriptionPlaceholder: "输入页面描述, 可包含页面文字、素材、排版设计等信息，支持粘贴图片",
      coverPage: "封面",
      coverPageTooltip: "第一页为封面页，默认保持简洁风格",
      notInImagePrompt: "不影响图片生成"
    }
  },
  en: {
    descriptionCard: {
      page: "Page {{num}}", regenerate: "Regenerate",
      descriptionTitle: "Edit Descriptions", description: "Description",
      noDescription: "No description generated yet",
      uploadingImage: "Uploading image...",
      descriptionPlaceholder: "Enter page description, can include page text, materials, layout design, etc., support pasting images",
      coverPage: "Cover",
      coverPageTooltip: "This is the cover page, default to keep simple style",
      notInImagePrompt: "Not used in image generation"
    }
  }
};

export interface DescriptionCardProps {
  page: Page;
  index: number;
  projectId?: string;
  extraFieldNames?: string[];
  imagePromptFields?: string[];
  showToast: (props: { message: string; type: 'success' | 'error' | 'info' | 'warning' }) => void;
  onUpdate: (data: Partial<Page>) => void;
  onRegenerate: () => void;
  isAiRefining?: boolean;
}

// 从 description_content 提取文本内容（提取到组件外部供 memo 比较器使用）
const getDescriptionText = (descContent: DescriptionContent | undefined): string => {
  if (!descContent) return '';
  if ('text' in descContent) {
    return descContent.text;
  } else if ('text_content' in descContent && Array.isArray(descContent.text_content)) {
    return descContent.text_content.join('\n');
  }
  return '';
};

// 提取 extra_fields，向后兼容 layout_suggestion
const getExtraFields = (descContent: DescriptionContent | undefined): Record<string, string> => {
  if (!descContent) return {};
  if (descContent.extra_fields) return descContent.extra_fields;
  // 向后兼容：旧数据只有 layout_suggestion
  if (descContent.layout_suggestion) return { '排版建议': descContent.layout_suggestion };
  return {};
};

// 用于 memo 比较的序列化 key
const getExtraFieldsKey = (descContent: DescriptionContent | undefined): string => {
  const fields = getExtraFields(descContent);
  return JSON.stringify(fields);
};

export const DescriptionCard: React.FC<DescriptionCardProps> = React.memo(({
  page,
  index,
  projectId,
  extraFieldNames = [],
  imagePromptFields,
  showToast,
  onUpdate,
  onRegenerate,
  isAiRefining = false,
}) => {
  const t = useT(descriptionCardI18n);

  const text = getDescriptionText(page.description_content);
  const extraFields = getExtraFields(page.description_content);
  const pageTitle = page.outline_content?.title?.trim() || '';

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isMaterialSelectorOpen, setIsMaterialSelectorOpen] = useState(false);
  const [editExtraFields, setEditExtraFields] = useState<Record<string, string>>({});
  const textareaRef = useRef<MarkdownTextareaRef>(null);
  const extraFieldRefs = useRef<Record<string, MarkdownTextareaRef | null>>({});

  // Active field target for image paste — switched via onFocus
  const activeSetContent = useRef<(updater: (prev: string) => string) => void>(setEditContent);
  const activeInsertAtCursor = useRef<((markdown: string) => void) | undefined>(
    () => textareaRef.current?.insertAtCursor('')
  );

  const { handlePaste, handleFiles, isUploading } = useImagePaste({
    projectId,
    setContent: (updater) => activeSetContent.current(updater),
    showToast: showToast,
    insertAtCursor: (md) => activeInsertAtCursor.current?.(md),
  });

  const handleMaterialSelect = useCallback((materials: Material[]) => {
    const setContent = (updater: (prev: string) => string) => activeSetContent.current(updater);
    const markdown = buildMaterialsMarkdown(materials, setContent);
    activeInsertAtCursor.current?.(markdown + '\n');
  }, []);

  // Focus handlers to switch paste target
  const focusMainDesc = useCallback(() => {
    activeSetContent.current = setEditContent;
    activeInsertAtCursor.current = (md: string) => textareaRef.current?.insertAtCursor(md);
  }, []);

  const focusExtraField = useCallback((fieldName: string) => {
    activeSetContent.current = (updater) =>
      setEditExtraFields(prev => ({ ...prev, [fieldName]: updater(prev[fieldName] || '') }));
    activeInsertAtCursor.current = (md: string) => extraFieldRefs.current[fieldName]?.insertAtCursor(md);
  }, []);

  // 通过 page.status 驱动骨架屏，与图片生成的 GENERATING 状态互不干扰
  const generating = useDescriptionGeneratingState(page, isAiRefining);

  const handleEdit = () => {
    // 在打开编辑对话框时，从当前的 page 获取最新值
    const currentText = getDescriptionText(page.description_content);
    const currentExtraFields = getExtraFields(page.description_content);
    setEditContent(currentText);
    setEditExtraFields({ ...currentExtraFields });
    setIsEditing(true);
  };

  const handleSave = () => {
    // 保存时包含 text 和 extra_fields
    const filteredFields: Record<string, string> = {};
    for (const [key, value] of Object.entries(editExtraFields)) {
      if (value.trim()) {
        filteredFields[key] = value;
      }
    }
    onUpdate({
      description_content: {
        text: editContent,
        ...(Object.keys(filteredFields).length > 0 ? { extra_fields: filteredFields } : {}),
      } as DescriptionContent,
    });
    setIsEditing(false);
  };

  // 合并已有和配置中的字段名（按配置顺序，附加已有但不在配置中的）
  const allFieldNames = [...new Set([...extraFieldNames, ...Object.keys(extraFields)])];

  return (
    <>
      <Card
        className="p-0 overflow-hidden flex flex-col transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-banana-200 dark:hover:border-border-hover motion-safe:animate-slide-in-up"
        style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 dark:border-border-primary">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-400 dark:text-foreground-tertiary">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="truncate text-sm font-medium text-gray-800 dark:text-foreground-secondary">
              {pageTitle || t('descriptionCard.page', { num: index + 1 })}
            </span>
            {index === 0 && (
              <span
                className="shrink-0 text-[11px] px-1.5 py-0.5 rounded text-banana-700 dark:text-banana-400 bg-banana-50 dark:bg-banana-900/30"
                title={t('descriptionCard.coverPageTooltip')}
              >
                {t('descriptionCard.coverPage')}
              </span>
            )}
            {(generating || page.status === 'FAILED') && (
              <ContextualStatusBadge page={page} context="description" />
            )}
          </div>
          {/* 操作：始终可见的图标按钮（移动端友好） */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={handleEdit}
              disabled={generating}
              title={t('common.edit')}
              aria-label={t('common.edit')}
              className="w-8 h-8 grid place-items-center rounded-lg text-gray-500 hover:text-gray-900 dark:text-foreground-tertiary dark:hover:text-foreground-primary hover:bg-gray-100 dark:hover:bg-background-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-banana-500"
            >
              <Edit2 size={16} />
            </button>
            <button
              type="button"
              onClick={onRegenerate}
              disabled={generating}
              title={t('descriptionCard.regenerate')}
              aria-label={t('descriptionCard.regenerate')}
              className="w-8 h-8 grid place-items-center rounded-lg text-gray-500 hover:text-gray-900 dark:text-foreground-tertiary dark:hover:text-foreground-primary hover:bg-gray-100 dark:hover:bg-background-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-banana-500"
            >
              <RefreshCw size={16} className={generating ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="p-4 flex-1 max-h-96 overflow-y-auto desc-card-scroll" data-testid="description-card-content">
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
              {allFieldNames.map(name => {
                const value = extraFields[name];
                if (!value) return null;
                const FIELD_ICONS: Record<string, typeof Tag> = { '视觉元素': Image, '视觉焦点': Focus, '排版布局': Layout, '演讲者备注': MessageSquare };
                const FieldIcon = FIELD_ICONS[name] || Tag;
                const notInImagePrompt = imagePromptFields && !imagePromptFields.includes(name);
                return (
                  <div key={name} className="mt-3 pt-3 border-t border-gray-100 dark:border-border-primary">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-foreground-tertiary mb-1">
                      <FieldIcon size={12} />
                      <span className="font-medium">{name}</span>
                      {notInImagePrompt && (
                        <span className="relative group/nip">
                          <ImageOff size={11} className="opacity-50" />
                          <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-max max-w-40 px-2 py-1 text-[10px] leading-snug text-gray-600 dark:text-foreground-secondary bg-white dark:bg-background-primary border border-gray-200 dark:border-border-primary rounded-md shadow-md opacity-0 pointer-events-none group-hover/nip:opacity-100 transition-opacity z-50">
                            {t('descriptionCard.notInImagePrompt')}
                          </span>
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-foreground-tertiary"><Markdown>{value}</Markdown></div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-10">
              <div className="w-11 h-11 grid place-items-center rounded-2xl bg-banana-50 dark:bg-banana-900/20 mb-3">
                <FileText size={20} className="text-banana-500" />
              </div>
              <p className="text-sm text-gray-400 dark:text-foreground-tertiary">{t('descriptionCard.noDescription')}</p>
            </div>
          )}
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
            onSelectFromLibrary={() => setIsMaterialSelectorOpen(true)}
            onFocus={focusMainDesc}
            rows={6}
            placeholder={t('descriptionCard.descriptionPlaceholder')}
          />
          {/* 额外字段编辑 */}
          {allFieldNames.map(name => (
            <MarkdownTextarea
              key={name}
              ref={el => { extraFieldRefs.current[name] = el; }}
              label={name}
              value={editExtraFields[name] || ''}
              onChange={v => setEditExtraFields(prev => ({ ...prev, [name]: v }))}
              onPaste={handlePaste}
              onFiles={handleFiles}
              onFocus={() => focusExtraField(name)}
              showUploadButton={false}
              rows={2}
              placeholder={name}
            />
          ))}
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

      <MaterialSelector
        projectId={projectId}
        isOpen={isMaterialSelectorOpen}
        onClose={() => setIsMaterialSelectorOpen(false)}
        onSelect={handleMaterialSelect}
        multiple
      />
    </>
  );
}, (prev, next) =>
  prev.index === next.index &&
  prev.isAiRefining === next.isAiRefining &&
  prev.projectId === next.projectId &&
  prev.page.id === next.page.id &&
  prev.page.status === next.page.status &&
  prev.page.part === next.page.part &&
  getDescriptionText(prev.page.description_content) === getDescriptionText(next.page.description_content) &&
  getExtraFieldsKey(prev.page.description_content) === getExtraFieldsKey(next.page.description_content) &&
  JSON.stringify(prev.extraFieldNames) === JSON.stringify(next.extraFieldNames) &&
  JSON.stringify(prev.imagePromptFields) === JSON.stringify(next.imagePromptFields)
);
