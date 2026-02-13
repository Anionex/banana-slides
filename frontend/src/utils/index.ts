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
  const lang = localStorage.getItem('i18nextLng') || navigator.language || 'zh-CN';
  const locale = lang.startsWith('zh') ? 'zh-CN' : 'en-US';
  return date.toLocaleString(locale, {
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
 * 将错误消息转换为友好的中英文提示
 */
export function normalizeErrorMessage(errorMessage: string | null | undefined): string {
  const lang = localStorage.getItem('i18nextLng') || navigator.language || 'zh';
  const isZh = lang.startsWith('zh');

  if (!errorMessage) return isZh ? '操作失败' : 'Operation failed';

  const message = errorMessage.toLowerCase();

  // Handle specific error messages
  if (message.includes('no template image found')) {
    return isZh
      ? '当前项目还没有模板，请先点击页面工具栏的"更换模板"按钮，选择或上传一张模板图片后再生成。'
      : 'No template found. Please select or upload a template image first.';
  } else if (message.includes('page must have description content')) {
    return isZh
      ? '该页面还没有描述内容，请先在"编辑页面描述"步骤为此页生成或填写描述。'
      : 'This page has no description. Please generate or write a description first.';
  } else if (message.includes('image already exists')) {
    return isZh
      ? '该页面已经有图片，如需重新生成，请在生成时选择"重新生成"或稍后重试。'
      : 'Image already exists. Choose "Regenerate" to create a new one.';
  }

  // Handle HTTP error codes
  if (message.includes('503') || message.includes('service unavailable')) {
    return isZh ? 'AI 服务暂时不可用，请稍后重试。如果问题持续，请检查设置页的 API 配置。' : 'AI service temporarily unavailable. Please try again later.';
  } else if (message.includes('500') || message.includes('internal server error')) {
    return isZh ? '服务器内部错误，请稍后重试。' : 'Internal server error. Please try again later.';
  } else if (message.includes('502') || message.includes('bad gateway')) {
    return isZh ? '网关错误，请稍后重试。' : 'Bad gateway. Please try again later.';
  } else if (message.includes('504') || message.includes('gateway timeout')) {
    return isZh ? '请求超时，请稍后重试。' : 'Gateway timeout. Please try again later.';
  } else if (message.includes('429') || message.includes('too many requests')) {
    return isZh ? '请求过于频繁，请稍后重试。' : 'Too many requests. Please try again later.';
  } else if (message.includes('401') || message.includes('unauthorized')) {
    return isZh ? '认证失败，请检查 API 密钥配置。' : 'Authentication failed. Please check API key settings.';
  } else if (message.includes('403') || message.includes('forbidden')) {
    return isZh ? '访问被拒绝，请检查 API 权限配置。' : 'Access denied. Please check API permissions.';
  } else if (message.includes('network error') || message.includes('econnrefused')) {
    return isZh ? '网络连接失败，请检查网络或后端服务是否正常运行。' : 'Network error. Please check your connection.';
  } else if (message.includes('timeout')) {
    return isZh ? '请求超时，请稍后重试。' : 'Request timed out. Please try again later.';
  }

  return errorMessage;
}

