/**
 * Store 统一导出
 * 根据模式自动选择正确的 store
 */

import { isLocalMode } from '@/utils/mode';
import { useProjectStore as useBackendProjectStore } from './useProjectStore';
import { useLocalProjectStore } from './useLocalProjectStore';

/**
 * 根据模式自动选择正确的 project store
 */
export const useProjectStore = () => {
  if (isLocalMode()) {
    return useLocalProjectStore();
  } else {
    return useBackendProjectStore();
  }
};

// 导出其他 stores
export { useAuthStore } from './useAuthStore';
export { useSettingsStore } from './useSettingsStore';
export { useLocalProjectStore } from './useLocalProjectStore';
export { useProjectStore as useBackendProjectStore } from './useProjectStore';
