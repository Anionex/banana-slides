import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import static language bundles
import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';

const resources = {
  'zh-CN': {
    common: zhCN.common,
    auth: zhCN.auth,
    project: zhCN.project,
    export: zhCN.export,
    errors: zhCN.errors,
  },
  'en-US': {
    common: enUS.common,
    auth: enUS.auth,
    project: enUS.project,
    export: enUS.export,
    errors: enUS.errors,
  },
};

i18n
  // 检测用户语言
  .use(LanguageDetector)
  // 绑定react-i18next
  .use(initReactI18next)
  // 初始化i18next
  .init({
    // 默认语言（当检测到的语言不可用时）
    fallbackLng: 'zh-CN',

    // 支持的语言列表
    supportedLngs: ['zh-CN', 'en-US'],

    // 调试模式（开发环境）
    debug: false,

    // 命名空间
    ns: ['common', 'auth', 'project', 'export', 'errors'],
    defaultNS: 'common',

    // 静态资源
    resources,

    // 语言检测配置
    detection: {
      order: [
        'localStorage',
        'navigator',
        'htmlTag',
      ],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },

    // 插值配置
    interpolation: {
      escapeValue: false, // React已经自动转义
    },

    // react配置
    react: {
      useSuspense: false, // 禁用suspense，避免加载闪烁
    },
  });

export default i18n;