import React from 'react';
import { useTranslation } from 'react-i18next';
import { Edit2, Trash2 } from 'lucide-react';
import { StatusBadge, Skeleton, useConfirm } from '@/components/shared';
import { getImageUrl } from '@/api/client';
import type { Page } from '@/types';

interface SlideCardProps {
  page: Page;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isGenerating?: boolean;
}

export const SlideCard: React.FC<SlideCardProps> = ({
  page,
  index,
  isSelected,
  onClick,
  onEdit,
  onDelete,
  isGenerating = false,
}) => {
  const { t } = useTranslation();
  const { confirm, ConfirmDialog } = useConfirm();
  const imageUrl = page.generated_image_path
    ? getImageUrl(page.generated_image_path, page.updated_at)
    : '';
  
  const generating = isGenerating || page.status === 'GENERATING';

  return (
    <div
      className={`group cursor-pointer transition-all ${
        isSelected ? 'ring-2 ring-banana-500' : ''
      }`}
      onClick={onClick}
    >
      {/* 缩略图 */}
      <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden mb-2">
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
                className="p-2 bg-white rounded-lg hover:bg-banana-50 transition-colors"
              >
                <Edit2 size={18} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  confirm(
                    t('preview.slideCard.confirmDelete'),
                    onDelete,
                    { title: t('preview.slideCard.confirmDeleteTitle'), variant: 'danger' }
                  );
                }}
                className="p-2 bg-white rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 size={18} className="text-red-600" />
              </button>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-3xl mb-1">🍌</div>
              <div className="text-xs">{t('preview.slideCard.notGenerated')}</div>
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
            isSelected ? 'text-banana-600' : 'text-gray-700'
          }`}
        >
          {index + 1}. {page.outline_content.title}
        </span>
      </div>
      {ConfirmDialog}
    </div>
  );
};

