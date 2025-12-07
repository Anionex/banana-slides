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
  const hasDescription = !!page.description_content;
  const hasImage = !!page.generated_image_path;
  const pageStatus = page.status;

  switch (context) {
    case 'description':
      // 描述页面上下文：只关心描述是否生成
      if (!hasDescription) {
        return {
          status: 'DRAFT',
          label: '未生成描述',
          description: '还没有生成描述'
        };
      }
      return {
        status: 'DESCRIPTION_GENERATED',
        label: '已生成描述',
        description: '描述已生成'
      };

    case 'image':
      // 图片页面上下文：关心图片生成状态
      if (!hasDescription) {
        return {
          status: 'DRAFT',
          label: '未生成描述',
          description: '需要先生成描述'
        };
      }
      if (!hasImage && pageStatus !== 'GENERATING') {
        return {
          status: 'DESCRIPTION_GENERATED',
          label: '未生成图片',
          description: '描述已生成，等待生成图片'
        };
      }
      if (pageStatus === 'GENERATING') {
        return {
          status: 'GENERATING',
          label: '生成中',
          description: '正在生成图片'
        };
      }
      if (pageStatus === 'FAILED') {
        return {
          status: 'FAILED',
          label: '失败',
          description: '图片生成失败'
        };
      }
      if (hasImage) {
        return {
          status: 'COMPLETED',
          label: '已完成',
          description: '图片已生成'
        };
      }
      // 默认返回页面状态
      return {
        status: pageStatus,
        label: '未知',
        description: '状态未知'
      };

    case 'full':
    default:
      // 完整上下文：显示页面的实际状态
      return {
        status: pageStatus,
        label: getStatusLabel(pageStatus),
        description: getStatusDescription(pageStatus, hasDescription, hasImage)
      };
  }
};

/**
 * 获取状态标签
 */
function getStatusLabel(status: PageStatus): string {
  const labels: Record<PageStatus, string> = {
    DRAFT: '草稿',
    DESCRIPTION_GENERATED: '已生成描述',
    GENERATING: '生成中',
    COMPLETED: '已完成',
    FAILED: '失败',
  };
  return labels[status] || '未知';
}

/**
 * 获取状态描述
 */
function getStatusDescription(
  status: PageStatus,
  _hasDescription: boolean,
  _hasImage: boolean
): string {
  if (status === 'DRAFT') return '草稿阶段';
  if (status === 'DESCRIPTION_GENERATED') return '描述已生成';
  if (status === 'GENERATING') return '正在生成中';
  if (status === 'FAILED') return '生成失败';
  if (status === 'COMPLETED') return '全部完成';
  return '状态未知';
}

