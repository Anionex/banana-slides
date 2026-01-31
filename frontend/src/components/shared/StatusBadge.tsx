import React from 'react';
import { cn } from '@/utils';
import { useT } from '@/hooks/useT';
import { statusI18n } from '@/i18n/statusI18n';
import type { PageStatus } from '@/types';

interface StatusBadgeProps {
  status: PageStatus;
}

const statusClassNames: Record<PageStatus, string> = {
  DRAFT: 'bg-gray-100 dark:bg-background-secondary text-gray-600 dark:text-foreground-tertiary',
  DESCRIPTION_GENERATED: 'bg-blue-100 text-blue-600',
  GENERATING: 'bg-orange-100 text-orange-600 animate-pulse',
  COMPLETED: 'bg-green-100 text-green-600',
  FAILED: 'bg-red-100 text-red-600',
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
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium',
        className
      )}
    >
      {t(labelKey)}
    </span>
  );
};
