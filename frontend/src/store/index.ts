/**
 * Store 统一导出
 * 根据模式自动选择正确的 store
 */

import { isLocalMode } from '@/utils/mode';
import { useProjectStore as useBackendProjectStoreOriginal } from './useProjectStore';
import { useLocalProjectStore as useLocalProjectStoreOriginal } from './useLocalProjectStore';

/**
 * 统一的 project store hook
 * 根据模式自动选择正确的实现
 */
export const useProjectStore = isLocalMode() ? useLocalProjectStoreOriginal : useBackendProjectStoreOriginal;

// 导出其他 stores
export { useAuthStore } from './useAuthStore';
export { useSettingsStore } from './useSettingsStore';
export { useLocalProjectStore } from './useLocalProjectStore';
export { useProjectStore as useBackendProjectStore } from './useProjectStore';
