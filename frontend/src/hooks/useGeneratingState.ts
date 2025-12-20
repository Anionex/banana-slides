import type { Page } from '@/types';

/**
 * 判断页面描述是否处于生成状态
 * 只检查与描述生成相关的状态：
 * 1. 描述生成任务（isGenerating）
 * 2. AI 修改时的全局状态（isAiRefining）
 * 
 * 注意：不检查 page.status === 'GENERATING'，因为该状态在图片生成时也会被设置
 */
export const useDescriptionGeneratingState = (
  isGenerating: boolean,
  isAiRefining: boolean
): boolean => {
  return isGenerating || isAiRefining;
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


