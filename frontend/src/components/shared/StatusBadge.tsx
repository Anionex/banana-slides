import React from 'react';
import { cn } from '@/utils';
import type { PageStatus } from '@/types';

interface StatusBadgeProps {
  status: PageStatus;
}

const statusConfig: Record<PageStatus, { label: string; className: string }> = {
  DRAFT: {
    label: '草稿',
    className: 'bg-gray-100 text-gray-600',
  },
  OUTLINE_GENERATED: {
    label: '已生成大纲',
    className: 'bg-purple-100 text-purple-600',
  },
  DESCRIPTION_GENERATED: {
    label: '已生成描述',
    className: 'bg-blue-100 text-blue-600',
  },
  GENERATING: {
    label: '生成中',
    className: 'bg-orange-100 text-orange-600 animate-pulse',
  },
  COMPLETED: {
    label: '已完成',
    className: 'bg-green-100 text-green-600',
  },
  FAILED: {
    label: '失败',
    className: 'bg-red-100 text-red-600',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config = statusConfig[status] || {
    label: status || '未知',
    className: 'bg-gray-100 text-gray-600',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium',
        config.className
      )}
    >
      {config.label}
    </span>
  );
};

