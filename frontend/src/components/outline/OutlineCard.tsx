import React, { useState, useEffect } from 'react';
import { GripVertical, Edit2, Trash2, Check, X } from 'lucide-react';
import { Card, useConfirm, Markdown, ShimmerOverlay } from '@/components/shared';
import type { Page } from '@/types';

interface OutlineCardProps {
  page: Page;
  index: number;
  onUpdate: (data: Partial<Page>) => void;
  onDelete: () => void;
  onClick: () => void;
  isSelected: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  isAiRefining?: boolean;
}

export const OutlineCard: React.FC<OutlineCardProps> = ({
  page,
  index,
  onUpdate,
  onDelete,
  onClick,
  isSelected,
  dragHandleProps,
  isAiRefining = false,
}) => {
  const { confirm, ConfirmDialog } = useConfirm();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(page.outline_content.title);
  const [editPoints, setEditPoints] = useState(page.outline_content.points.join('\n'));

  // 当 page prop 变化时，同步更新本地编辑状态（如果不在编辑模式）
  useEffect(() => {
    if (!isEditing) {
      setEditTitle(page.outline_content.title);
      setEditPoints(page.outline_content.points.join('\n'));
    }
  }, [page.outline_content.title, page.outline_content.points, isEditing]);

  const handleSave = () => {
    onUpdate({
      outline_content: {
        title: editTitle,
        points: editPoints.split('\n').filter((p) => p.trim()),
      },
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(page.outline_content.title);
    setEditPoints(page.outline_content.points.join('\n'));
    setIsEditing(false);
  };

  return (
    <Card
      className={`p-4 relative ${
        isSelected ? 'border-2 border-banana-500 shadow-yellow' : ''
      }`}
      onClick={!isEditing ? onClick : undefined}
    >
      <ShimmerOverlay show={isAiRefining} />
      
      <div className="flex items-start gap-3 relative z-10">
        {/* 拖拽手柄 */}
        <div 
          {...dragHandleProps}
          className="flex-shrink-0 cursor-move text-gray-400 hover:text-gray-600 pt-1"
        >
          <GripVertical size={20} />
        </div>

        {/* 内容区 */}
        <div className="flex-1 min-w-0">
          {/* 页码和章节 */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-gray-900">
              第 {index + 1} 页
            </span>
            {page.part && (
              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                {page.part}
              </span>
            )}
          </div>

          {isEditing ? (
            /* 编辑模式 */
            <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-banana-500"
                placeholder="标题"
              />
              <textarea
                value={editPoints}
                onChange={(e) => setEditPoints(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-banana-500 resize-none"
                placeholder="要点（每行一个）"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleCancel}
                  className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={16} className="inline mr-1" />
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="px-3 py-1.5 text-sm bg-banana-500 text-black rounded-lg hover:bg-banana-600 transition-colors"
                >
                  <Check size={16} className="inline mr-1" />
                  保存
                </button>
              </div>
            </div>
          ) : (
            /* 查看模式 */
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">
                {page.outline_content.title}
              </h4>
              <div className="text-gray-600">
                <Markdown>{page.outline_content.points.join('\n')}</Markdown>
              </div>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        {!isEditing && (
          <div className="flex-shrink-0 flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className="p-1.5 text-gray-500 hover:text-banana-600 hover:bg-banana-50 rounded transition-colors"
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                confirm(
                  '确定要删除这一页吗？',
                  onDelete,
                  { title: '确认删除', variant: 'danger' }
                );
              }}
              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>
      {ConfirmDialog}
    </Card>
  );
};

