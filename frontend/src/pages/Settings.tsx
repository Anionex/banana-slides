import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Key, Image, Zap, Save, RotateCcw, Globe, FileText } from 'lucide-react';
import { Button, Input, Card, Loading, useToast, useConfirm, LanguageSwitcher } from '@/components/shared';
import * as api from '@/api/endpoints';
import type { OutputLanguage } from '@/api/endpoints';
import { OUTPUT_LANGUAGE_OPTIONS } from '@/api/endpoints';
import type { Settings as SettingsType } from '@/types';

// 配置项类型定义
type FieldType = 'text' | 'password' | 'number' | 'select' | 'buttons';

interface FieldConfig {
  key: keyof typeof initialFormData;
  label: string;
  type: FieldType;
  placeholder?: string;
  description?: string;
  sensitiveField?: boolean;  // 是否为敏感字段（如 API Key）
  lengthKey?: keyof SettingsType;  // 用于显示已有长度的 key（如 api_key_length）
  options?: { value: string; label: string }[];  // select 类型的选项
  min?: number;
  max?: number;
}

interface SectionConfig {
  title: string;
  icon: React.ReactNode;
  fields: FieldConfig[];
}

// 初始表单数据
const initialFormData = {
  ai_provider_format: 'gemini' as 'openai' | 'gemini',
  api_base_url: '',
  api_key: '',
  text_model: '',
  image_model: '',
  image_caption_model: '',
  mineru_api_base: '',
  mineru_token: '',
  image_resolution: '2K',
  image_aspect_ratio: '16:9',
  max_description_workers: 5,
  max_image_workers: 8,
  output_language: 'zh' as OutputLanguage,
};

// 配置驱动的表单区块定义 - 使用 i18n
const getSettingsSections = (t: (key: string) => string): SectionConfig[] => [
  {
    title: t('settings.sections.api'),
    icon: <Key size={20} />,
    fields: [
      {
        key: 'ai_provider_format',
        label: t('settings.fields.aiProviderFormat.label'),
        type: 'buttons',
        description: t('settings.fields.aiProviderFormat.description'),
        options: [
          { value: 'openai', label: t('settings.fields.aiProviderFormat.options.openai') },
          { value: 'gemini', label: t('settings.fields.aiProviderFormat.options.gemini') },
        ],
      },
      {
        key: 'api_base_url',
        label: t('settings.fields.apiBaseUrl.label'),
        type: 'text',
        placeholder: 'https://api.example.com',
        description: t('settings.fields.apiBaseUrl.description'),
      },
      {
        key: 'api_key',
        label: t('settings.fields.apiKey.label'),
        type: 'password',
        placeholder: t('settings.fields.apiKey.placeholder'),
        sensitiveField: true,
        lengthKey: 'api_key_length',
        description: t('settings.fields.apiKey.description'),
      },
    ],
  },
  {
    title: t('settings.sections.models'),
    icon: <FileText size={20} />,
    fields: [
      {
        key: 'text_model',
        label: t('settings.fields.textModel.label'),
        type: 'text',
        placeholder: t('settings.fields.textModel.placeholder'),
        description: t('settings.fields.textModel.description'),
      },
      {
        key: 'image_model',
        label: t('settings.fields.imageModel.label'),
        type: 'text',
        placeholder: t('settings.fields.imageModel.placeholder'),
        description: t('settings.fields.imageModel.description'),
      },
      {
        key: 'image_caption_model',
        label: t('settings.fields.imageCaptionModel.label'),
        type: 'text',
        placeholder: t('settings.fields.imageCaptionModel.placeholder'),
        description: t('settings.fields.imageCaptionModel.description'),
      },
    ],
  },
  {
    title: t('settings.sections.mineru'),
    icon: <FileText size={20} />,
    fields: [
      {
        key: 'mineru_api_base',
        label: t('settings.fields.mineruApiBase.label'),
        type: 'text',
        placeholder: t('settings.fields.mineruApiBase.placeholder'),
        description: t('settings.fields.mineruApiBase.description'),
      },
      {
        key: 'mineru_token',
        label: t('settings.fields.mineruToken.label'),
        type: 'password',
        placeholder: t('settings.fields.mineruToken.placeholder'),
        sensitiveField: true,
        lengthKey: 'mineru_token_length',
        description: t('settings.fields.mineruToken.description'),
      },
    ],
  },
  {
    title: t('settings.sections.imageGeneration'),
    icon: <Image size={20} />,
    fields: [
      {
        key: 'image_resolution',
        label: t('settings.fields.imageResolution.label'),
        type: 'select',
        description: t('settings.fields.imageResolution.description'),
        options: [
          { value: '1K', label: '1K (1024px)' },
          { value: '2K', label: '2K (2048px)' },
          { value: '4K', label: '4K (4096px)' },
        ],
      },
    ],
  },
  {
    title: t('settings.sections.performance'),
    icon: <Zap size={20} />,
    fields: [
      {
        key: 'max_description_workers',
        label: t('settings.fields.maxDescriptionWorkers.label'),
        type: 'number',
        min: 1,
        max: 20,
        description: t('settings.fields.maxDescriptionWorkers.description'),
      },
      {
        key: 'max_image_workers',
        label: t('settings.fields.maxImageWorkers.label'),
        type: 'number',
        min: 1,
        max: 20,
        description: t('settings.fields.maxImageWorkers.description'),
      },
    ],
  },
  {
    title: t('settings.sections.outputLanguage'),
    icon: <Globe size={20} />,
    fields: [
      {
        key: 'output_language',
        label: t('settings.fields.outputLanguage.label'),
        type: 'buttons',
        description: t('settings.fields.outputLanguage.description'),
        options: OUTPUT_LANGUAGE_OPTIONS,
      },
    ],
  },
];

// Settings 组件 - 纯嵌入模式（可复用）
export const Settings: React.FC = () => {
  const { t } = useTranslation();
  const { show, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(initialFormData);

  // 获取当前语言的配置
  const settingsSections = getSettingsSections(t);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const response = await api.getSettings();
      if (response.data) {
        setSettings(response.data);
        setFormData({
          ai_provider_format: response.data.ai_provider_format || 'gemini',
          api_base_url: response.data.api_base_url || '',
          api_key: '',
          image_resolution: response.data.image_resolution || '2K',
          image_aspect_ratio: response.data.image_aspect_ratio || '16:9',
          max_description_workers: response.data.max_description_workers || 5,
          max_image_workers: response.data.max_image_workers || 8,
          text_model: response.data.text_model || '',
          image_model: response.data.image_model || '',
          mineru_api_base: response.data.mineru_api_base || '',
          mineru_token: '',
          image_caption_model: response.data.image_caption_model || '',
          output_language: response.data.output_language || 'zh',
        });
      }
    } catch (error: any) {
      console.error('Load settings failed:', error);
      show({
        message: t('settings.toast.loadFailed') + ': ' + (error?.message || t('settings.toast.unknownError')),
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { api_key, mineru_token, ...otherData } = formData;
      const payload: Parameters<typeof api.updateSettings>[0] = {
        ...otherData,
      };

      if (api_key) {
        payload.api_key = api_key;
      }

      if (mineru_token) {
        payload.mineru_token = mineru_token;
      }

      const response = await api.updateSettings(payload);
      if (response.data) {
        setSettings(response.data);
        show({ message: t('settings.toast.saveSuccess'), type: 'success' });
        setFormData(prev => ({ ...prev, api_key: '', mineru_token: '' }));
      }
    } catch (error: any) {
      console.error('Save settings failed:', error);
      show({
        message: t('settings.toast.saveFailed') + ': ' + (error?.response?.data?.error?.message || error?.message || t('settings.toast.unknownError')),
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    confirm(
      t('settings.confirm.resetMessage'),
      async () => {
        setIsSaving(true);
        try {
          const response = await api.resetSettings();
          if (response.data) {
            setSettings(response.data);
            setFormData({
              ai_provider_format: response.data.ai_provider_format || 'gemini',
              api_base_url: response.data.api_base_url || '',
              api_key: '',
              image_resolution: response.data.image_resolution || '2K',
              image_aspect_ratio: response.data.image_aspect_ratio || '16:9',
              max_description_workers: response.data.max_description_workers || 5,
              max_image_workers: response.data.max_image_workers || 8,
              text_model: response.data.text_model || '',
              image_model: response.data.image_model || '',
              mineru_api_base: response.data.mineru_api_base || '',
              mineru_token: '',
              image_caption_model: response.data.image_caption_model || '',
              output_language: response.data.output_language || 'zh',
            });
            show({ message: t('settings.toast.resetSuccess'), type: 'success' });
          }
        } catch (error: any) {
          console.error('Reset settings failed:', error);
          show({
            message: t('settings.toast.resetFailed') + ': ' + (error?.message || t('settings.toast.unknownError')),
            type: 'error'
          });
        } finally {
          setIsSaving(false);
        }
      },
      {
        title: t('settings.confirm.resetTitle'),
        confirmText: t('settings.confirm.resetConfirm'),
        cancelText: t('settings.confirm.cancel'),
        variant: 'warning',
      }
    );
  };

  const handleFieldChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const renderField = (field: FieldConfig) => {
    const value = formData[field.key];

    if (field.type === 'buttons' && field.options) {
      return (
        <div key={field.key}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {field.label}
          </label>
          <div className="flex flex-wrap gap-2">
            {field.options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleFieldChange(field.key, option.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  value === option.value
                    ? option.value === 'openai'
                      ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md'
                      : 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {field.description && (
            <p className="mt-1 text-xs text-gray-500">{field.description}</p>
          )}
        </div>
      );
    }

    if (field.type === 'select' && field.options) {
      return (
        <div key={field.key}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {field.label}
          </label>
          <select
            value={value as string}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className="w-full h-10 px-4 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent"
          >
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {field.description && (
            <p className="mt-1 text-sm text-gray-500">{field.description}</p>
          )}
        </div>
      );
    }

    // text, password, number 类型
    const placeholder = field.sensitiveField && settings && field.lengthKey
      ? t('settings.fields.sensitiveSet', { length: settings[field.lengthKey] })
      : field.placeholder || '';

    return (
      <div key={field.key}>
        <Input
          label={field.label}
          type={field.type === 'number' ? 'number' : field.type}
          placeholder={placeholder}
          value={value as string | number}
          onChange={(e) => {
            const newValue = field.type === 'number' 
              ? parseInt(e.target.value) || (field.min ?? 0)
              : e.target.value;
            handleFieldChange(field.key, newValue);
          }}
          min={field.min}
          max={field.max}
        />
        {field.description && (
          <p className="mt-1 text-sm text-gray-500">{field.description}</p>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading message={t('settings.loading')} />
      </div>
    );
  }

  return (
    <>
      <ToastContainer />
      {ConfirmDialog}
      <div className="space-y-8">
        {/* 配置区块（配置驱动） */}
        <div className="space-y-8">
          {settingsSections.map((section) => (
            <div key={section.title}>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                {section.icon}
                <span className="ml-2">{section.title}</span>
              </h2>
              <div className="space-y-4">
                {section.fields.map((field) => renderField(field))}
                {section.title === t('settings.sections.api') && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-gray-700">
                      {t('settings.apiKeyHint.prefix')}{' '}
                      <a
                        href="https://aihubmix.com/?aff=17EC"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline font-medium"
                      >
                        AIHubmix
                      </a>
                      {t('settings.apiKeyHint.suffix')}
                    </p>
                  </div>
                )}
                {section.title === t('settings.sections.outputLanguage') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.fields.uiLanguage.label')}
                    </label>
                    <LanguageSwitcher />
                    <p className="mt-1 text-xs text-gray-500">{t('settings.fields.uiLanguage.description')}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <Button
            variant="secondary"
            icon={<RotateCcw size={18} />}
            onClick={handleReset}
            disabled={isSaving}
          >
            {t('settings.buttons.reset')}
          </Button>
          <Button
            variant="primary"
            icon={<Save size={18} />}
            onClick={handleSave}
            loading={isSaving}
          >
            {isSaving ? t('settings.buttons.saving') : t('settings.buttons.save')}
          </Button>
        </div>
      </div>
    </>
  );
};

// SettingsPage 组件 - 完整页面包装
export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-banana-50 to-yellow-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="p-6 md:p-8">
          <div className="space-y-8">
            {/* 顶部标题 */}
            <div className="flex items-center justify-between pb-6 border-b border-gray-200">
              <div className="flex items-center">
                <Button
                  variant="secondary"
                  icon={<Home size={18} />}
                  onClick={() => navigate('/')}
                  className="mr-4"
                >
                  {t('settings.backHome')}
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>
                  <p className="text-sm text-gray-500 mt-1">
                    {t('settings.subtitle')}
                  </p>
                </div>
              </div>
            </div>

            <Settings />
          </div>
        </Card>
      </div>
    </div>
  );
};
