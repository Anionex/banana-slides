import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Key, Image, Zap, Save, RotateCcw, Globe, FileText, Brain } from 'lucide-react';
import { Button, Input, Card, Loading, useToast, useConfirm, LanguageSwitcher } from '@/components/shared';
import * as api from '@/api/endpoints';
import type { OutputLanguage } from '@/api/endpoints';
import { OUTPUT_LANGUAGE_OPTIONS } from '@/api/endpoints';
import type { Settings as SettingsType } from '@/types';

// 配置项类型定义
type FieldType = 'text' | 'password' | 'number' | 'select' | 'buttons' | 'switch';

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

type TestStatus = 'idle' | 'loading' | 'success' | 'error';

interface ServiceTestState {
  status: TestStatus;
  message?: string;
  detail?: string;
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
  // 推理模式配置（分别控制文本和图像）
  enable_text_reasoning: false,
  text_thinking_budget: 1024,
  enable_image_reasoning: false,
  image_thinking_budget: 1024,
  baidu_ocr_api_key: '',
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
  {
    title: '文本推理模式',
    icon: <Brain size={20} />,
    fields: [
      {
        key: 'enable_text_reasoning',
        label: '启用文本推理',
        type: 'switch',
        description: '开启后，文本生成（大纲、描述等）会使用 extended thinking 进行深度推理',
      },
      {
        key: 'text_thinking_budget',
        label: '文本思考负载',
        type: 'number',
        min: 1,
        max: 8192,
        description: '文本推理的思考 token 预算 (1-8192)，数值越大推理越深入',
      },
    ],
  },
  {
    title: '图像推理模式',
    icon: <Brain size={20} />,
    fields: [
      {
        key: 'enable_image_reasoning',
        label: '启用图像推理',
        type: 'switch',
        description: '开启后，图像生成会使用思考链模式，可能获得更好的构图效果',
      },
      {
        key: 'image_thinking_budget',
        label: '图像思考负载',
        type: 'number',
        min: 1,
        max: 8192,
        description: '图像推理的思考 token 预算 (1-8192)，数值越大推理越深入',
      },
    ],
  },
  {
    title: '百度 OCR 配置',
    icon: <FileText size={20} />,
    fields: [
      {
        key: 'baidu_ocr_api_key',
        label: '百度 OCR API Key',
        type: 'password',
        placeholder: '输入百度 OCR API Key',
        sensitiveField: true,
        lengthKey: 'baidu_ocr_api_key_length',
        description: '用于可编辑 PPTX 导出时的文字识别功能，留空则保持当前设置不变',
      },
    ],
  },
];

// Settings 组件 - 纯嵌入模式（可复用）
export const Settings: React.FC = () => {
  const { t } = useTranslation();
  const { show } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [serviceTestStates, setServiceTestStates] = useState<Record<string, ServiceTestState>>({});

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
          enable_text_reasoning: response.data.enable_text_reasoning || false,
          text_thinking_budget: response.data.text_thinking_budget || 1024,
          enable_image_reasoning: response.data.enable_image_reasoning || false,
          image_thinking_budget: response.data.image_thinking_budget || 1024,
          baidu_ocr_api_key: '',
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
      const { api_key, mineru_token, baidu_ocr_api_key, ...otherData } = formData;
      const payload: Parameters<typeof api.updateSettings>[0] = {
        ...otherData,
      };

      if (api_key) {
        payload.api_key = api_key;
      }

      if (mineru_token) {
        payload.mineru_token = mineru_token;
      }

      if (baidu_ocr_api_key) {
        payload.baidu_ocr_api_key = baidu_ocr_api_key;
      }

      const response = await api.updateSettings(payload);
      if (response.data) {
        setSettings(response.data);
        show({ message: t('settings.toast.saveSuccess'), type: 'success' });
        show({ message: t('settings.toast.testRecommendation', 'Recommend testing services at page bottom'), type: 'info' });
        setFormData(prev => ({ ...prev, api_key: '', mineru_token: '', baidu_ocr_api_key: '' }));
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
              enable_text_reasoning: response.data.enable_text_reasoning || false,
              text_thinking_budget: response.data.text_thinking_budget || 1024,
              enable_image_reasoning: response.data.enable_image_reasoning || false,
              image_thinking_budget: response.data.image_thinking_budget || 1024,
              baidu_ocr_api_key: '',
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

  const updateServiceTest = (key: string, nextState: ServiceTestState) => {
    setServiceTestStates(prev => ({ ...prev, [key]: nextState }));
  };

  const handleServiceTest = async (
    key: string,
    action: (settings?: any) => Promise<any>,
    formatDetail: (data: any) => string
  ) => {
    updateServiceTest(key, { status: 'loading' });
    try {
      // 准备测试时要使用的设置（包括未保存的修改）
      const testSettings: any = {};

      // 只传递用户已填写的非空值
      if (formData.api_key) testSettings.api_key = formData.api_key;
      if (formData.api_base_url) testSettings.api_base_url = formData.api_base_url;
      if (formData.ai_provider_format) testSettings.ai_provider_format = formData.ai_provider_format;
      if (formData.text_model) testSettings.text_model = formData.text_model;
      if (formData.image_model) testSettings.image_model = formData.image_model;
      if (formData.image_caption_model) testSettings.image_caption_model = formData.image_caption_model;
      if (formData.mineru_api_base) testSettings.mineru_api_base = formData.mineru_api_base;
      if (formData.mineru_token) testSettings.mineru_token = formData.mineru_token;
      if (formData.baidu_ocr_api_key) testSettings.baidu_ocr_api_key = formData.baidu_ocr_api_key;
      if (formData.image_resolution) testSettings.image_resolution = formData.image_resolution;

      // 推理模式设置
      if (formData.enable_text_reasoning !== undefined) {
        testSettings.enable_text_reasoning = formData.enable_text_reasoning;
      }
      if (formData.text_thinking_budget !== undefined) {
        testSettings.text_thinking_budget = formData.text_thinking_budget;
      }
      if (formData.enable_image_reasoning !== undefined) {
        testSettings.enable_image_reasoning = formData.enable_image_reasoning;
      }
      if (formData.image_thinking_budget !== undefined) {
        testSettings.image_thinking_budget = formData.image_thinking_budget;
      }

      // 启动异步测试，获取任务ID
      const response = await action(testSettings);
      const taskId = response.data.task_id;

      // 开始轮询任务状态
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await api.getTestStatus(taskId);
          const taskStatus = statusResponse.data.status;

          if (taskStatus === 'COMPLETED') {
            clearInterval(pollInterval);
            const detail = formatDetail(statusResponse.data.result || {});
            const message = statusResponse.data.message || '测试成功';
            updateServiceTest(key, { status: 'success', message, detail });
            show({ message, type: 'success' });
          } else if (taskStatus === 'FAILED') {
            clearInterval(pollInterval);
            const errorMessage = statusResponse.data.error || '测试失败';
            updateServiceTest(key, { status: 'error', message: errorMessage });
            show({ message: '测试失败: ' + errorMessage, type: 'error' });
          }
          // 如果是 PENDING 或 PROCESSING，继续轮询
        } catch (pollError: any) {
          clearInterval(pollInterval);
          const errorMessage = pollError?.response?.data?.error?.message || pollError?.message || '轮询失败';
          updateServiceTest(key, { status: 'error', message: errorMessage });
          show({ message: '测试失败: ' + errorMessage, type: 'error' });
        }
      }, 2000); // 每2秒轮询一次

      // 设置最大轮询时间（2分钟）
      setTimeout(() => {
        clearInterval(pollInterval);
        if (serviceTestStates[key]?.status === 'loading') {
          updateServiceTest(key, { status: 'error', message: '测试超时' });
          show({ message: '测试超时，请重试', type: 'error' });
        }
      }, 120000);

    } catch (error: any) {
      const errorMessage = error?.response?.data?.error?.message || error?.message || '未知错误';
      updateServiceTest(key, { status: 'error', message: errorMessage });
      show({ message: '测试失败: ' + errorMessage, type: 'error' });
    }
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

    // switch 类型 - 开关切换
    if (field.type === 'switch') {
      const isEnabled = Boolean(value);
      return (
        <div key={field.key}>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              {field.label}
            </label>
            <button
              type="button"
              onClick={() => handleFieldChange(field.key, !isEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-banana-500 focus:ring-offset-2 ${
                isEnabled ? 'bg-banana-500' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
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

    // 判断是否禁用（思考负载字段在对应开关关闭时禁用）
    let isDisabled = false;
    if (field.key === 'text_thinking_budget') {
      isDisabled = !formData.enable_text_reasoning;
    } else if (field.key === 'image_thinking_budget') {
      isDisabled = !formData.enable_image_reasoning;
    }

    return (
      <div key={field.key} className={isDisabled ? 'opacity-50' : ''}>
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
          disabled={isDisabled}
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

        {/* 服务测试区 */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center">
            <FileText size={20} />
            <span className="ml-2">服务测试</span>
          </h2>
          <p className="text-sm text-gray-500">
            提前验证关键服务配置是否可用，避免使用期间异常。
          </p>
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-gray-700">
              💡 提示：图像生成和 MinerU 测试可能需要 30-60 秒，请耐心等待。
            </p>
          </div>
          <div className="space-y-4">
            {[
              {
                key: 'baidu-ocr',
                title: 'Baidu OCR 服务',
                description: '识别测试图片文字，验证 BAIDU_OCR_API_KEY 配置',
                action: api.testBaiduOcr,
                formatDetail: (data: any) => (data?.recognized_text ? `识别结果：${data.recognized_text}` : ''),
              },
              {
                key: 'text-model',
                title: '文本生成模型',
                description: '发送短提示词，验证文本模型与 API 配置',
                action: api.testTextModel,
                formatDetail: (data: any) => (data?.reply ? `模型回复：${data.reply}` : ''),
              },
              {
                key: 'caption-model',
                title: '图片识别模型',
                description: '生成测试图片并请求模型输出描述',
                action: api.testCaptionModel,
                formatDetail: (data: any) => (data?.caption ? `识别描述：${data.caption}` : ''),
              },
              {
                key: 'baidu-inpaint',
                title: 'Baidu 图像修复',
                description: '使用测试图片执行修复，验证百度 inpaint 服务',
                action: api.testBaiduInpaint,
                formatDetail: (data: any) => (data?.image_size ? `输出尺寸：${data.image_size[0]}x${data.image_size[1]}` : ''),
              },
              {
                key: 'image-model',
                title: '图像生成模型',
                description: '基于测试图片生成演示文稿背景图（1K, 可能需要 20-40 秒）',
                action: api.testImageModel,
                formatDetail: (data: any) => (data?.image_size ? `输出尺寸：${data.image_size[0]}x${data.image_size[1]}` : ''),
              },
              {
                key: 'mineru-pdf',
                title: 'MinerU 解析 PDF',
                description: '上传测试 PDF 并等待解析结果返回（可能需要 30-60 秒）',
                action: api.testMineruPdf,
                formatDetail: (data: any) => (data?.content_preview ? `解析预览：${data.content_preview}` : data?.message || ''),
              },
            ].map((item) => {
              const testState = serviceTestStates[item.key] || { status: 'idle' as TestStatus };
              const isLoadingTest = testState.status === 'loading';
              return (
                <div
                  key={item.key}
                  className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-2"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-base font-semibold text-gray-800">{item.title}</div>
                      <div className="text-sm text-gray-500">{item.description}</div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={isLoadingTest}
                      onClick={() => handleServiceTest(item.key, item.action, item.formatDetail)}
                    >
                      {isLoadingTest ? '测试中...' : '开始测试'}
                    </Button>
                  </div>
                  {testState.status === 'success' && (
                    <p className="text-sm text-green-600">
                      {testState.message}{testState.detail ? `｜${testState.detail}` : ''}
                    </p>
                  )}
                  {testState.status === 'error' && (
                    <p className="text-sm text-red-600">
                      {testState.message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
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
