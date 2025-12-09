/**
 * 应用模式检测工具
 */

export type AppMode = 'local' | 'backend';

/**
 * 获取当前应用模式
 */
export const getAppMode = (): AppMode => {
  const mode = import.meta.env.VITE_MODE || 'local';
  return mode as AppMode;
};

/**
 * 是否为本地模式
 */
export const isLocalMode = (): boolean => {
  return getAppMode() === 'local';
};

/**
 * 是否为后端模式
 */
export const isBackendMode = (): boolean => {
  return getAppMode() === 'backend';
};

/**
 * 是否应该使用本地存储
 */
export const shouldUseLocalStorage = (): boolean => {
  return isLocalMode();
};

/**
 * 是否应该调用后端 API
 */
export const shouldCallBackendAPI = (): boolean => {
  return isBackendMode();
};
