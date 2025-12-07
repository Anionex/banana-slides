import React from 'react';
import { cn } from '@/utils';
import type { Page } from '@/types';
import { usePageStatus, type PageStatusContext } from '@/hooks/usePageStatus';

interface ContextualStatusBadgeProps {
  page: Page;
  /** 上下文：description（描述页）、image（图片页）、full（完整状态） */
  context?: PageStatusContext;
  /** 是否显示详细描述（悬停提示） */
  showDescription?: boolean;
}

/**
 * 根据上下文智能显示状态的徽章
 * 
 * - 在描述编辑页面：只显示描述相关状态
 * - 在图片预览页面：显示图片生成状态
 * - 其他场景：显示完整页面状态
 */
export const ContextualStatusBadge: React.FC<ContextualStatusBadgeProps> = ({
  page,
  context = 'full',
  showDescription = true,
}) => {
  const { status, label, description } = usePageStatus(page, context);

  const statusConfig = {
    DRAFT: 'bg-gray-100 text-gray-600',
    DESCRIPTION_GENERATED: 'bg-blue-100 text-blue-600',
    GENERATING: 'bg-orange-100 text-orange-600 animate-pulse',
    COMPLETED: 'bg-green-100 text-green-600',
    FAILED: 'bg-red-100 text-red-600',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium',
        statusConfig[status]
      )}
      title={showDescription ? description : undefined}
    >
      {label}
    </span>
  );
};

