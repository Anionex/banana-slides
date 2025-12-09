import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Project, Page } from '@/types';

/**
 * 合并 className (支持 Tailwind CSS)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 标准化后端返回的项目数据
 */
export function normalizeProject(data: any): Project {
  return {
    ...data,
    id: data.project_id || data.id,
    template_image_path: data.template_image_url || data.template_image_path,
    pages: (data.pages || []).map(normalizePage),
  };
}

/**
 * 标准化后端返回的页面数据
 */
export function normalizePage(data: any): Page {
  return {
    ...data,
    id: data.page_id || data.id,
    generated_image_path: data.generated_image_url || data.generated_image_path,
  };
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * 下载文件
 */
export function downloadFile(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * 格式化日期
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 将错误消息转换为友好的中文提示
 */
export function normalizeErrorMessage(errorMessage: string | null | undefined): string {
  if (!errorMessage) return '操作失败';

  const message = errorMessage.toLowerCase();

  if (message.includes('no template image found')) {
    return '当前项目还没有模板，请先点击页面工具栏的"更换模板"按钮，选择或上传一张模板图片后再生成。';
  } else if (message.includes('page must have description content')) {
    return '该页面还没有描述内容，请先在"编辑页面描述"步骤为此页生成或填写描述。';
  } else if (message.includes('image already exists')) {
    return '该页面已经有图片，如需重新生成，请在生成时选择"重新生成"或稍后重试。';
  } else if (message.includes('api key') && (message.includes('未配置') || message.includes('not configured') || message.includes('not valid'))) {
    return '🔑 Google API Key 未配置。请登录后在"设置"页面配置您的 API Key，或联系管理员。';
  } else if (message.includes('api key not valid') || message.includes('invalid api key')) {
    return '🔑 API Key 无效。请检查您在"设置"页面配置的 API Key 是否正确。';
  } else if (message.includes('图片生成失败') && message.includes('ai 返回')) {
    // 保留 AI 返回的原因，因为它可能包含有用信息
    return errorMessage;
  } else if (message.includes('no image found') || message.includes('图片生成失败')) {
    return '🖼️ 图片生成失败。可能的原因：内容被 AI 安全策略拒绝，请尝试修改描述后重试。';
  }

  return errorMessage;
}

/**
 * 从 axios 错误中提取后端返回的错误消息
 */
export function extractErrorMessage(error: any): string {
  // 1. 尝试从 axios 响应中提取后端消息
  if (error.response?.data) {
    const data = error.response.data;
    // 后端返回格式: { error: { code: "...", message: "..." } }
    if (data.error?.message) {
      return data.error.message;
    }
    // 其他格式
    if (data.message) {
      return data.message;
    }
    if (typeof data.error === 'string') {
      return data.error;
    }
  }

  // 2. 使用 error.message
  if (error.message) {
    return error.message;
  }

  // 3. 默认消息
  return '操作失败';
}

