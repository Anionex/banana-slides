import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { StatusBadge, Skeleton, useConfirm } from '@/components/shared';
import { getImageUrl } from '@/api/client';
import type { Page } from '@/types';

// SlideCard 组件自包含翻译
const slideCardI18n = {
  zh: {
    slideCard: {
      notGenerated: "未生成",
      confirmDeletePage: "确定要删除这一页吗？",
      confirmDeleteTitle: "确认删除",
      coverPage: "封面",
      coverPageTooltip: "第一页为封面页，通常包含标题和副标题"
    }
  },
  en: {
    slideCard: {
      notGenerated: "Not Generated",
      confirmDeletePage: "Are you sure you want to delete this page?",
      confirmDeleteTitle: "Confirm Delete",
      coverPage: "Cover",
      coverPageTooltip: "This is the cover page, usually containing the title and subtitle"
    }
  }
};

interface SlideCardProps {
  page: Page;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isGenerating?: boolean;
  aspectRatio?: string;
}

export const SlideCard: React.FC<SlideCardProps> = ({
  page,
  index,
  isSelected,
  onClick,
  onEdit,
  onDelete,
  isGenerating = false,
  aspectRatio = '16:9',
}) => {
  const t = useT(slideCardI18n);
  const { confirm, ConfirmDialog } = useConfirm();
  const imageUrl = page.generated_image_path
    ? getImageUrl(page.generated_image_path, page.updated_at)
    : '';
  
  const generating = isGenerating || page.status === 'QUEUED' || page.status === 'GENERATING';

  return (
    <div
      className={`group cursor-pointer transition-all ${
        isSelected ? 'ring-2 ring-banana-500' : ''
      }`}
      onClick={onClick}
    >
      {/* 缩略图 */}
      <div className="relative bg-gray-100 dark:bg-background-secondary rounded-lg overflow-hidden mb-2" style={{ aspectRatio: aspectRatio.replace(':', '/') }}>
        {generating ? (
          <Skeleton className="w-full h-full" />
        ) : page.generated_image_path ? (
          <>
            <img
              src={imageUrl}
              alt={`Slide ${index + 1}`}
              className="w-full h-full object-cover"
            />
            {/* 悬停操作 */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="p-2 bg-white dark:bg-background-secondary rounded-lg hover:bg-banana-50 dark:hover:bg-background-hover transition-colors"
              >
                <Edit2 size={18} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  confirm(
                    t('slideCard.confirmDeletePage'),
                    onDelete,
                    { title: t('slideCard.confirmDeleteTitle'), variant: 'danger' }
                  );
                }}
                className="p-2 bg-white dark:bg-background-secondary rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 size={18} className="text-red-600" />
              </button>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-3xl mb-1">🍌</div>
              <div className="text-xs">{t('slideCard.notGenerated')}</div>
            </div>
          </div>
        )}
        
        {/* 状态标签 */}
        <div className="absolute bottom-2 right-2">
          <StatusBadge status={page.status} />
        </div>
      </div>

      {/* 标题 */}
      <div className="flex items-center gap-2">
        <span
          className={`text-sm font-medium ${
            isSelected ? 'text-banana-600' : 'text-gray-700 dark:text-foreground-secondary'
          }`}
        >
          {index + 1}. {page.outline_content?.title}
        </span>
        {index === 0 && (
          <span
            className="text-xs px-1.5 py-0.5 bg-banana-100 dark:bg-banana-900/30 text-banana-700 dark:text-banana-400 rounded flex-shrink-0"
            title={t('slideCard.coverPageTooltip')}
          >
            {t('slideCard.coverPage')}
          </span>
        )}
      </div>
      {ConfirmDialog}
    </div>
  );
};

