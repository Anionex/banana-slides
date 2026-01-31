import { useTranslation } from 'react-i18next';
import type { Page, PageStatus } from '@/types';

export type PageStatusContext = 'description' | 'image' | 'full';

export interface DerivedPageStatus {
  status: PageStatus;
  label: string;
  description: string;
}

export const usePageStatus = (
  page: Page,
  context: PageStatusContext = 'full'
): DerivedPageStatus => {
  const { t } = useTranslation();
  const hasDescription = !!page.description_content;
  const hasImage = !!page.generated_image_path;
  const pageStatus = page.status;

  switch (context) {
    case 'description':
      if (!hasDescription) {
        return {
          status: 'DRAFT',
          label: t('status.notGeneratedDesc'),
          description: t('status.noDescription')
        };
      }
      return {
        status: 'DESCRIPTION_GENERATED',
        label: t('status.descriptionGenerated'),
        description: t('status.descGenerated')
      };

    case 'image':
      if (!hasDescription) {
        return {
          status: 'DRAFT',
          label: t('status.notGeneratedDesc'),
          description: t('status.noDescription')
        };
      }
      if (!hasImage && pageStatus !== 'GENERATING') {
        return {
          status: 'DESCRIPTION_GENERATED',
          label: t('status.notGeneratedImage'),
          description: t('status.waitingForImage')
        };
      }
      if (pageStatus === 'GENERATING') {
        return {
          status: 'GENERATING',
          label: t('status.generating'),
          description: t('status.generatingImage')
        };
      }
      if (pageStatus === 'FAILED') {
        return {
          status: 'FAILED',
          label: t('status.failed'),
          description: t('status.imageFailed')
        };
      }
      if (hasImage) {
        return {
          status: 'COMPLETED',
          label: t('status.completed'),
          description: t('status.imageCompleted')
        };
      }
      return {
        status: pageStatus,
        label: t('status.unknown'),
        description: t('status.statusUnknown')
      };

    case 'full':
    default:
      return {
        status: pageStatus,
        label: getStatusLabel(pageStatus, t),
        description: getStatusDescription(pageStatus, t)
      };
  }
};

function getStatusLabel(status: PageStatus, t: (key: string) => string): string {
  const labels: Record<PageStatus, string> = {
    DRAFT: t('status.draft'),
    DESCRIPTION_GENERATED: t('status.descriptionGenerated'),
    GENERATING: t('status.generating'),
    COMPLETED: t('status.completed'),
    FAILED: t('status.failed'),
  };
  return labels[status] || t('status.unknown');
}

function getStatusDescription(status: PageStatus, t: (key: string) => string): string {
  if (status === 'DRAFT') return t('status.draftStage');
  if (status === 'DESCRIPTION_GENERATED') return t('status.descGenerated');
  if (status === 'GENERATING') return t('status.generating');
  if (status === 'FAILED') return t('status.failed');
  if (status === 'COMPLETED') return t('status.allCompleted');
  return t('status.statusUnknown');
}
