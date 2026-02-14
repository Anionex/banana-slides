import { useT } from '@/hooks/useT';
import type { Page, PageStatus } from '@/types';

// usePageStatus hook 自包含翻译
const pageStatusI18n = {
  zh: {
    status: {
      draft: "草稿", descriptionGenerated: "描述已生成", generating: "生成中",
      completed: "已完成", failed: "失败", unknown: "未知",
      notGeneratedDesc: "未生成描述", noDescription: "还没有生成描述",
      descGenerated: "描述已生成", notGeneratedImage: "未生成图片",
      waitingForImage: "等待生成图片", generatingImage: "正在生成图片",
      imageFailed: "图片生成失败", imageCompleted: "图片已生成",
      statusUnknown: "状态未知", draftStage: "草稿阶段", allCompleted: "全部完成"
    }
  },
  en: {
    status: {
      draft: "Draft", descriptionGenerated: "Description Generated", generating: "Generating",
      completed: "Completed", failed: "Failed", unknown: "Unknown",
      notGeneratedDesc: "No Description", noDescription: "No description generated yet",
      descGenerated: "Description Generated", notGeneratedImage: "No Image",
      waitingForImage: "Waiting for image generation", generatingImage: "Generating image",
      imageFailed: "Image generation failed", imageCompleted: "Image generated",
      statusUnknown: "Status unknown", draftStage: "Draft stage", allCompleted: "All completed"
    }
  }
};

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
  const t = useT(pageStatusI18n);
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
