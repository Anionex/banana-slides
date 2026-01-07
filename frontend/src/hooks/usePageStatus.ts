import { useTranslation } from 'react-i18next';
import type { Page, PageStatus } from '@/types';

/**
 * 页面状态类型
 */
export type PageStatusContext = 'description' | 'image' | 'full';

/**
 * 派生的页面状态
 */
export interface DerivedPageStatus {
  status: PageStatus;
  label: string;
  description: string;
}

/**
 * 根据上下文获取页面的派生状态
 *
 * @param page - 页面对象
 * @param context - 上下文：'description' | 'image' | 'full'
 * @returns 派生的状态信息
 */
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
      // 描述页面上下文：只关心描述是否生成
      if (!hasDescription) {
        return {
          status: 'DRAFT',
          label: t('components.pageStatus.noDescription'),
          description: t('components.pageStatus.noDescriptionDesc')
        };
      }
      return {
        status: 'DESCRIPTION_GENERATED',
        label: t('components.pageStatus.descriptionGenerated'),
        description: t('components.pageStatus.descriptionGeneratedDesc')
      };

    case 'image':
      // 图片页面上下文：关心图片生成状态
      if (!hasDescription) {
        return {
          status: 'DRAFT',
          label: t('components.pageStatus.noDescription'),
          description: t('components.pageStatus.needDescriptionFirst')
        };
      }
      if (!hasImage && pageStatus !== 'GENERATING') {
        return {
          status: 'DESCRIPTION_GENERATED',
          label: t('components.pageStatus.noImage'),
          description: t('components.pageStatus.waitingForImage')
        };
      }
      if (pageStatus === 'GENERATING') {
        return {
          status: 'GENERATING',
          label: t('components.status.generating'),
          description: t('components.pageStatus.generatingImage')
        };
      }
      if (pageStatus === 'FAILED') {
        return {
          status: 'FAILED',
          label: t('components.status.failed'),
          description: t('components.pageStatus.imageFailed')
        };
      }
      if (hasImage) {
        return {
          status: 'COMPLETED',
          label: t('components.status.completed'),
          description: t('components.pageStatus.imageGenerated')
        };
      }
      // 默认返回页面状态
      return {
        status: pageStatus,
        label: t('components.pageStatus.unknown'),
        description: t('components.pageStatus.unknownDesc')
      };

    case 'full':
    default:
      // 完整上下文：显示页面的实际状态
      return {
        status: pageStatus,
        label: getStatusLabel(pageStatus, t),
        description: getStatusDescription(pageStatus, t)
      };
  }
};

/**
 * 获取状态标签
 */
function getStatusLabel(status: PageStatus, t: (key: string) => string): string {
  const labels: Record<PageStatus, string> = {
    DRAFT: t('components.status.draft'),
    DESCRIPTION_GENERATED: t('components.status.descriptionGenerated'),
    GENERATING: t('components.status.generating'),
    COMPLETED: t('components.status.completed'),
    FAILED: t('components.status.failed'),
  };
  return labels[status] || t('components.pageStatus.unknown');
}

/**
 * 获取状态描述
 */
function getStatusDescription(
  status: PageStatus,
  t: (key: string) => string
): string {
  if (status === 'DRAFT') return t('components.pageStatus.draftDesc');
  if (status === 'DESCRIPTION_GENERATED') return t('components.pageStatus.descriptionGeneratedDesc');
  if (status === 'GENERATING') return t('components.pageStatus.generatingDesc');
  if (status === 'FAILED') return t('components.pageStatus.failedDesc');
  if (status === 'COMPLETED') return t('components.pageStatus.completedDesc');
  return t('components.pageStatus.unknownDesc');
}
