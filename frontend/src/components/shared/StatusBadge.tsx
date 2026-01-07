import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils';
import type { PageStatus } from '@/types';

interface StatusBadgeProps {
  status: PageStatus;
}

const statusStyles: Record<PageStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  DESCRIPTION_GENERATED: 'bg-blue-100 text-blue-600',
  GENERATING: 'bg-orange-100 text-orange-600 animate-pulse',
  COMPLETED: 'bg-green-100 text-green-600',
  FAILED: 'bg-red-100 text-red-600',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const { t } = useTranslation();

  const statusLabels: Record<PageStatus, string> = {
    DRAFT: t('components.status.draft'),
    DESCRIPTION_GENERATED: t('components.status.descriptionGenerated'),
    GENERATING: t('components.status.generating'),
    COMPLETED: t('components.status.completed'),
    FAILED: t('components.status.failed'),
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium',
        statusStyles[status]
      )}
    >
      {statusLabels[status]}
    </span>
  );
};
