import React from 'react';
import { cn } from '@/utils';
import { useT } from '@/hooks/useT';
import type { PageStatus } from '@/types';

// Status 组件自包含翻译
const statusI18n = {
  zh: {
    status: {
      draft: "草稿", descriptionGenerated: "已生成描述", generating: "生成中",
      completed: "已完成", failed: "失败", unknown: "未知",
      notGeneratedDesc: "未生成描述", noDescription: "还没有生成描述",
      descGenerated: "描述已生成", notGeneratedImage: "未生成图片",
      waitingForImage: "描述已生成，等待生成图片", generatingImage: "正在生成图片",
      imageFailed: "图片生成失败", imageCompleted: "图片已生成",
      draftStage: "草稿阶段", allCompleted: "全部完成", statusUnknown: "状态未知"
    }
  },
  en: {
    status: {
      draft: "Draft", descriptionGenerated: "Description Generated", generating: "Generating",
      completed: "Completed", failed: "Failed", unknown: "Unknown",
      notGeneratedDesc: "Description Not Generated", noDescription: "No description generated yet",
      descGenerated: "Description Generated", notGeneratedImage: "Image Not Generated",
      waitingForImage: "Description generated, waiting for image", generatingImage: "Generating image",
      imageFailed: "Image generation failed", imageCompleted: "Image generated",
      draftStage: "Draft Stage", allCompleted: "All Completed", statusUnknown: "Status Unknown"
    }
  }
};

interface StatusBadgeProps {
  status: PageStatus;
}

const statusClassNames: Record<PageStatus, string> = {
  DRAFT: 'bg-gray-100 dark:bg-background-secondary text-gray-600 dark:text-foreground-tertiary',
  DESCRIPTION_GENERATED: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  GENERATING: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 animate-pulse',
  COMPLETED: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  FAILED: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
};

const statusLabelKeys: Record<PageStatus, string> = {
  DRAFT: 'status.draft',
  DESCRIPTION_GENERATED: 'status.descriptionGenerated',
  GENERATING: 'status.generating',
  COMPLETED: 'status.completed',
  FAILED: 'status.failed',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const t = useT(statusI18n);
  const className = statusClassNames[status];
  const labelKey = statusLabelKeys[status];
  
  return (
    <span
      data-testid="status-badge"
      data-status={status}
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium',
        className
      )}
    >
      {t(labelKey)}
    </span>
  );
};
