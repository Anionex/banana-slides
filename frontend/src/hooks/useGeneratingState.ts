import type { Page } from '@/types';

/**
 * 判断页面描述是否处于生成状态
 * 通过 page.status === 'GENERATING_DESCRIPTION' 驱动，与图片生成的 'GENERATING' 状态互不干扰
 */
export const useDescriptionGeneratingState = (
  page: Page,
  isAiRefining: boolean
): boolean => {
  return page.status === 'GENERATING_DESCRIPTION' || isAiRefining;
};

/**
 * 判断页面图片是否处于生成状态
 * 检查与图片生成相关的状态：
 * 1. 图片生成任务（isGenerating）
 * 2. 页面的 GENERATING 状态（在图片生成过程中设置）
 */
export const useImageGeneratingState = (
  page: Page,
  isGenerating: boolean
): boolean => {
  return isGenerating || page.status === 'GENERATING';
};

/**
 * @deprecated 使用 useDescriptionGeneratingState 或 useImageGeneratingState 替代
 * 原来的通用版本：合并所有生成状态
 * 问题：无法区分描述生成和图片生成，导致在描述页面看到图片生成状态
 */
export const useGeneratingState = (
  page: Page,
  isGenerating: boolean,
  isAiRefining: boolean
): boolean => {
  return isGenerating || page.status === 'GENERATING' || isAiRefining;
};

/**
 * 简单版本：只判断页面自身的生成状态
 */
export const usePageGeneratingState = (
  page: Page,
  isGenerating: boolean
): boolean => {
  return isGenerating || page.status === 'GENERATING';
};


