import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Key, Image, Zap, Save, RotateCcw, Globe, FileText, Brain } from 'lucide-react';
import { Button, Input, Card, Loading, useToast, useConfirm } from '@/components/shared';
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

// 配置驱动的表单区块定义
const settingsSections: SectionConfig[] = [
  {
    title: '大模型 API 配置',
    icon: <Key size={20} />,
    fields: [
      {
        key: 'ai_provider_format',
        label: 'AI 提供商格式',
        type: 'buttons',
        description: '选择 API 请求格式，影响后端如何构造和发送请求。保存设置后生效。',
        options: [
          { value: 'openai', label: 'OpenAI 格式' },
          { value: 'gemini', label: 'Gemini 格式' },
        ],
      },
      {
        key: 'api_base_url',
        label: 'API Base URL',
        type: 'text',
        placeholder: 'https://api.example.com',
        description: '设置大模型提供商 API 的基础 URL',
      },
      {
        key: 'api_key',
        label: 'API Key',
        type: 'password',
        placeholder: '输入新的 API Key',
        sensitiveField: true,
        lengthKey: 'api_key_length',
        description: '留空则保持当前设置不变，输入新值则更新',
      },
    ],
  },
  {
    title: '模型配置',
    icon: <FileText size={20} />,
    fields: [
      {
        key: 'text_model',
        label: '文本大模型',
        type: 'text',
        placeholder: '留空使用环境变量配置 (如: gemini-2.0-flash-exp)',
        description: '用于生成大纲、描述等文本内容的模型名称',
      },
      {
        key: 'image_model',
        label: '图像生成模型',
        type: 'text',
        placeholder: '留空使用环境变量配置 (如: imagen-3.0-generate-001)',
        description: '用于生成页面图片的模型名称',
      },
      {
        key: 'image_caption_model',
        label: '图片识别模型',
        type: 'text',
        placeholder: '留空使用环境变量配置 (如: gemini-2.0-flash-exp)',
        description: '用于识别参考文件中的图片并生成描述',
      },
    ],
  },
  {
    title: 'MinerU 配置',
    icon: <FileText size={20} />,
    fields: [
      {
        key: 'mineru_api_base',
        label: 'MinerU API Base',
        type: 'text',
        placeholder: '留空使用环境变量配置 (如: https://mineru.net)',
        description: 'MinerU 服务地址，用于解析参考文件',
      },
      {
        key: 'mineru_token',
        label: 'MinerU Token',
        type: 'password',
        placeholder: '输入新的 MinerU Token',
        sensitiveField: true,
        lengthKey: 'mineru_token_length',
        description: '留空则保持当前设置不变，输入新值则更新',
      },
    ],
  },
  {
    title: '图像生成配置',
    icon: <Image size={20} />,
    fields: [
      {
        key: 'image_resolution',
        label: '图像清晰度（某些OpenAI格式中转调整该值无效）',
        type: 'select',
        description: '更高的清晰度会生成更详细的图像，但需要更长时间',
        options: [
          { value: '1K', label: '1K (1024px)' },
          { value: '2K', label: '2K (2048px)' },
          { value: '4K', label: '4K (4096px)' },
        ],
      },
    ],
  },
  {
    title: '性能配置',
    icon: <Zap size={20} />,
    fields: [
      {
        key: 'max_description_workers',
        label: '描述生成最大并发数',
        type: 'number',
        min: 1,
        max: 20,
        description: '同时生成描述的最大工作线程数 (1-20)，越大速度越快',
      },
      {
        key: 'max_image_workers',
        label: '图像生成最大并发数',
        type: 'number',
        min: 1,
        max: 20,
        description: '同时生成图像的最大工作线程数 (1-20)，越大速度越快',
      },
    ],
  },
  {
    title: '输出语言设置',
    icon: <Globe size={20} />,
    fields: [
      {
        key: 'output_language',
        label: '默认输出语言',
        type: 'buttons',
        description: 'AI 生成内容时使用的默认语言',
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
  const { show, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [serviceTestStates, setServiceTestStates] = useState<Record<string, ServiceTestState>>({});

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
      console.error('加载设置失败:', error);
      show({
        message: '加载设置失败: ' + (error?.message || '未知错误'),
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
        show({ message: '设置保存成功', type: 'success' });
        show({ message: '建议在本页底部进行服务测试，验证关键配置', type: 'info' });
        setFormData(prev => ({ ...prev, api_key: '', mineru_token: '', baidu_ocr_api_key: '' }));
      }
    } catch (error: any) {
      console.error('保存设置失败:', error);
      show({
        message: '保存设置失败: ' + (error?.response?.data?.error?.message || error?.message || '未知错误'),
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    confirm(
      '将把大模型、图像生成和并发等所有配置恢复为环境默认值，已保存的自定义设置将丢失，确定继续吗？',
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
            show({ message: '设置已重置', type: 'success' });
          }
        } catch (error: any) {
          console.error('重置设置失败:', error);
          show({
            message: '重置设置失败: ' + (error?.message || '未知错误'),
            type: 'error'
          });
        } finally {
          setIsSaving(false);
        }
      },
      {
        title: '确认重置为默认配置',
        confirmText: '确定重置',
        cancelText: '取消',
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
    action: () => Promise<any>,
    formatDetail: (data: any) => string
  ) => {
    updateServiceTest(key, { status: 'loading' });
    try {
      const response = await action();
      const detail = formatDetail(response.data);
      const message = response.message || '测试成功';
      updateServiceTest(key, { status: 'success', message, detail });
      show({ message, type: 'success' });
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
      ? `已设置（长度: ${settings[field.lengthKey]}）`
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
        <Loading message="加载设置中..." />
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
                {section.title === '大模型 API 配置' && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-gray-700">
                      API 密匙获取可前往{' '}
                      <a
                        href="https://aihubmix.com/?aff=17EC"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline font-medium"
                      >
                        AIHubmix
                      </a>
                      , 减小迁移成本
                    </p>
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
                description: '基于测试图片生成演示文稿背景图',
                action: api.testImageModel,
                formatDetail: (data: any) => (data?.image_size ? `输出尺寸：${data.image_size[0]}x${data.image_size[1]}` : ''),
              },
              {
                key: 'mineru-pdf',
                title: 'MinerU 解析 PDF',
                description: '上传测试 PDF 并等待解析结果返回',
                action: api.testMineruPdf,
                formatDetail: (data: any) => (data?.content_preview ? `解析预览：${data.content_preview}` : ''),
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
            重置为默认配置
          </Button>
          <Button
            variant="primary"
            icon={<Save size={18} />}
            onClick={handleSave}
            loading={isSaving}
          >
            {isSaving ? '保存中...' : '保存设置'}
          </Button>
        </div>
      </div>
    </>
  );
};

// SettingsPage 组件 - 完整页面包装
export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  
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
                  返回首页
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">系统设置</h1>
                  <p className="text-sm text-gray-500 mt-1">
                    配置应用的各项参数
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
