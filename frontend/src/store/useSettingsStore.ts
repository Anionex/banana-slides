/**
 * 设置状态管理
 * 管理 API 配置和用户偏好
 */

import { create } from 'zustand';

export interface APISettings {
  // Gemini API 配置
  geminiApiKey: string;
  geminiApiBase: string;
  geminiTextModel: string;
  geminiImageModel: string;

  // MinerU API 配置
  mineruToken: string;
  mineruApiBase: string;

  // 使用模式
  useBackendProxy: boolean; // 是否使用后端代理
  backendApiUrl: string; // 后端 API 地址

  // 用户偏好
  language: string;
  theme: 'light' | 'dark' | 'system';
}

interface SettingsState extends APISettings {
  // Actions
  updateSettings: (settings: Partial<APISettings>) => void;
  resetSettings: () => void;
  loadSettings: () => void;
  
  // 验证
  isGeminiConfigured: () => boolean;
  isMinerUConfigured: () => boolean;
  canUseLocalMode: () => boolean;
}

// 从环境变量加载默认配置
const DEFAULT_SETTINGS: APISettings = {
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
  geminiApiBase: import.meta.env.VITE_GEMINI_API_BASE || 'https://apipro.maynor1024.live',
  geminiTextModel: import.meta.env.VITE_GEMINI_TEXT_MODEL || 'gemini-2.0-flash-exp',
  geminiImageModel: import.meta.env.VITE_GEMINI_IMAGE_MODEL || 'gemini-2.0-flash-exp',
  
  mineruToken: import.meta.env.VITE_MINERU_TOKEN || '',
  mineruApiBase: import.meta.env.VITE_MINERU_API_BASE || 'https://mineru.net/api/v4',
  
  useBackendProxy: import.meta.env.VITE_MODE === 'backend',
  backendApiUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
  
  language: 'zh-CN',
  theme: 'system'
};

// 从 localStorage 加载配置
const loadFromStorage = (): Partial<APISettings> => {
  try {
    const stored = localStorage.getItem('banana_slides_settings');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('加载设置失败:', error);
  }
  return {};
};

// 保存到 localStorage
const saveToStorage = (settings: APISettings): void => {
  try {
    localStorage.setItem('banana_slides_settings', JSON.stringify(settings));
  } catch (error) {
    console.error('保存设置失败:', error);
  }
};

export const useSettingsStore = create<SettingsState>((set, get) => {
  // 初始化时加载配置
  const stored = loadFromStorage();
  const initialSettings = { ...DEFAULT_SETTINGS, ...stored };

  return {
    ...initialSettings,

    updateSettings: (updates) => {
      const newSettings = { ...get(), ...updates };
      
      // 移除 actions
      const { updateSettings, resetSettings, loadSettings, isGeminiConfigured, isMinerUConfigured, canUseLocalMode, ...settingsToSave } = newSettings;
      
      saveToStorage(settingsToSave as APISettings);
      set(updates);
    },

    resetSettings: () => {
      saveToStorage(DEFAULT_SETTINGS);
      set(DEFAULT_SETTINGS);
    },

    loadSettings: () => {
      const stored = loadFromStorage();
      set({ ...DEFAULT_SETTINGS, ...stored });
    },

    isGeminiConfigured: () => {
      const { geminiApiKey } = get();
      return !!geminiApiKey && geminiApiKey.trim().length > 0;
    },

    isMinerUConfigured: () => {
      const { mineruToken } = get();
      return !!mineruToken && mineruToken.trim().length > 0;
    },

    canUseLocalMode: () => {
      const { isGeminiConfigured } = get();
      return isGeminiConfigured();
    }
  };
});
