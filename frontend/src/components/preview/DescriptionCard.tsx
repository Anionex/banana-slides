import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Edit2, FileText, RefreshCw, ChevronDown, Plus } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { useImagePaste } from '@/hooks/useImagePaste';
import { Card, ContextualStatusBadge, Button, Modal, Skeleton, Markdown } from '@/components/shared';
import { MarkdownTextarea, type MarkdownTextareaRef } from '@/components/shared/MarkdownTextarea';
import { useDescriptionGeneratingState } from '@/hooks/useGeneratingState';
import { parseDescription, updateSection } from '@/utils/descriptionParser';
import type { Page, DescriptionContent } from '@/types';

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
      addPreset: "添加预设",
      customPreset: "自定义预设名称",
      selectLayout: "选择排版",
      sectionTitle: "标题",
      sectionText: "正文",
      sectionImage: "配图",
      sectionLayout: "排版",
      sectionMaterial: "素材",
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
      addPreset: "Add preset",
      customPreset: "Custom preset name",
      selectLayout: "Select layout",
      sectionTitle: "Title",
      sectionText: "Text",
      sectionImage: "Image",
      sectionLayout: "Layout",
      sectionMaterial: "Material",
    }
  }
};

// 每个段落的样式配置（黄色系品牌色）
const SECTION_STYLES: Record<string, { bg: string; labelKey: string }> = {
  '页面标题': { bg: 'bg-amber-50/80 dark:bg-amber-900/10', labelKey: 'descriptionCard.sectionTitle' },
  '页面文字': { bg: 'bg-yellow-50/80 dark:bg-yellow-900/10', labelKey: 'descriptionCard.sectionText' },
  '配图建议': { bg: 'bg-orange-50/80 dark:bg-orange-900/10', labelKey: 'descriptionCard.sectionImage' },
  '排版建议': { bg: 'bg-amber-100/60 dark:bg-amber-800/10', labelKey: 'descriptionCard.sectionLayout' },
  '其他页面素材': { bg: 'bg-stone-50/80 dark:bg-stone-800/10', labelKey: 'descriptionCard.sectionMaterial' },
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
  layoutPresets?: string[];
  onAddLayoutPreset?: (preset: string) => void;
  onDeleteLayoutPreset?: (preset: string) => void;
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

export const DescriptionCard: React.FC<DescriptionCardProps> = React.memo(({
  page,
  index,
  projectId,
  showToast,
  onUpdate,
  onRegenerate,
  isGenerating = false,
  isAiRefining = false,
  layoutPresets,
  onAddLayoutPreset,
  onDeleteLayoutPreset,
}) => {
  const t = useT(descriptionCardI18n);

  const text = getDescriptionText(page.description_content);
  const sections = useMemo(() => parseDescription(text), [text]);

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
    onUpdate({
      description_content: {
        text: editContent,
      } as DescriptionContent,
    });
    setIsEditing(false);
  };

  const [showAddPreset, setShowAddPreset] = useState(false);
  const [newPreset, setNewPreset] = useState('');

  const handleLayoutSelect = (preset: string) => {
    const newText = updateSection(text, '排版建议', preset);
    onUpdate({ description_content: { text: newText } as DescriptionContent });
  };

  const handleAddPreset = () => {
    const trimmed = newPreset.trim();
    if (trimmed && onAddLayoutPreset) {
      onAddLayoutPreset(trimmed);
      handleLayoutSelect(trimmed);
    }
    setNewPreset('');
    setShowAddPreset(false);
  };

  return (
    <>
      <Card className="p-0 overflow-visible flex flex-col">
        {/* 标题栏 */}
        <div className="bg-banana-50 dark:bg-background-hover px-4 py-3 border-b border-gray-100 dark:border-border-primary">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 dark:text-foreground-primary">{t('descriptionCard.page', { num: index + 1 })}</span>
              {index === 0 && (
                <span
                  className="text-xs px-1.5 py-0.5 bg-banana-100 dark:bg-banana-900/30 text-banana-700 dark:text-banana-400 rounded"
                  title={t('descriptionCard.coverPageTooltip')}
                >
                  {t('descriptionCard.coverPage')}
                </span>
              )}
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
          ) : sections.length > 0 ? (
            <div className="space-y-2">
              {sections.map((section, i) => {
                const style = SECTION_STYLES[section.key];
                if (!style) {
                  return (
                    <div key={i} className="rounded-lg px-3 py-2 bg-gray-50/80 dark:bg-gray-800/10">
                      {section.key && <span className="text-[11px] font-medium text-gray-500/70 dark:text-gray-400/60 mb-1 block">{section.key}</span>}
                      <div className="text-sm text-gray-700 dark:text-foreground-secondary"><Markdown>{section.content}</Markdown></div>
                    </div>
                  );
                }
                const isLayout = section.key === '排版建议';
                return (
                  <div key={i} className={`rounded-lg px-3 py-2 ${style.bg}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium text-amber-700/70 dark:text-amber-400/60">{t(style.labelKey)}</span>
                      {isLayout && layoutPresets && (
                        <LayoutDropdown
                          presets={layoutPresets}
                          current={section.content}
                          onSelect={handleLayoutSelect}
                          onAdd={() => setShowAddPreset(true)}
                          onDelete={onDeleteLayoutPreset || (() => {})}
                          t={t}
                        />
                      )}
                    </div>
                    <div className="text-sm text-gray-700 dark:text-foreground-secondary">
                      <Markdown>{section.content}</Markdown>
                    </div>
                  </div>
                );
              })}
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

      {/* 添加预设弹窗 */}
      <Modal
        isOpen={showAddPreset}
        onClose={() => { setShowAddPreset(false); setNewPreset(''); }}
        title={t('descriptionCard.addPreset')}
        size="sm"
      >
        <div className="space-y-4">
          <input
            type="text"
            value={newPreset}
            onChange={e => setNewPreset(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddPreset()}
            placeholder={t('descriptionCard.customPreset')}
            className="w-full px-3 py-2 border border-gray-200 dark:border-border-primary rounded-lg bg-white dark:bg-background-secondary text-sm focus:outline-none focus:border-banana"
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => { setShowAddPreset(false); setNewPreset(''); }}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleAddPreset} disabled={!newPreset.trim()}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}, (prev, next) =>
  prev.index === next.index &&
  prev.isGenerating === next.isGenerating &&
  prev.isAiRefining === next.isAiRefining &&
  prev.projectId === next.projectId &&
  prev.page.id === next.page.id &&
  prev.page.status === next.page.status &&
  prev.page.part === next.page.part &&
  prev.layoutPresets === next.layoutPresets &&
  getDescriptionText(prev.page.description_content) === getDescriptionText(next.page.description_content)
);

/** 排版预设下拉框 */
function LayoutDropdown({ presets, current, onSelect, onAdd, onDelete, t }: {
  presets: string[];
  current: string;
  onSelect: (v: string) => void;
  onAdd: () => void;
  onDelete: (v: string) => void;
  t: (key: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-0.5 text-[11px] text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition-colors"
      >
        {t('descriptionCard.selectLayout')}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 min-w-[140px] max-h-[200px] overflow-y-auto bg-white dark:bg-background-secondary border border-gray-200 dark:border-border-primary rounded-lg shadow-lg py-1">
          {presets.map(p => (
            <div
              key={p}
              className={`group flex items-center px-3 py-1.5 text-xs hover:bg-banana-50 dark:hover:bg-banana-pale transition-colors ${
                p === current ? 'text-amber-700 dark:text-amber-400 font-medium bg-amber-50/50 dark:bg-amber-900/10' : 'text-gray-700 dark:text-foreground-secondary'
              }`}
            >
              <button
                title={p}
                onClick={() => { onSelect(p); setOpen(false); }}
                className="flex-1 text-left truncate max-w-[160px]"
              >
                {p}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(p); }}
                className="ml-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
          <div className="border-t border-gray-100 dark:border-border-primary mt-1 pt-1">
            <button
              onClick={() => { onAdd(); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400 hover:bg-banana-50 dark:hover:bg-banana-pale flex items-center gap-1"
            >
              <Plus size={12} />
              {t('descriptionCard.addPreset')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
