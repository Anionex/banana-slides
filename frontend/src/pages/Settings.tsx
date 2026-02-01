import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Key, Image, Zap, Save, RotateCcw, Globe, FileText, Brain } from 'lucide-react';
import { useT } from '@/hooks/useT';

// 组件内翻译
const settingsI18n = {
  zh: {
    nav: { backToHome: '返回首页' },
    settings: {
      title: "系统设置",
      subtitle: "配置应用的各项参数",
      sections: {
        appearance: "外观设置", language: "界面语言", apiConfig: "大模型 API 配置",
        modelConfig: "模型配置", mineruConfig: "MinerU 配置", imageConfig: "图像生成配置",
        performanceConfig: "性能配置", outputLanguage: "输出语言设置",
        textReasoning: "文本推理模式", imageReasoning: "图像推理模式",
        baiduOcr: "百度 OCR 配置", serviceTest: "服务测试"
      },
      theme: { label: "主题模式", light: "浅色", dark: "深色", system: "跟随系统" },
      language: { label: "界面语言", zh: "中文", en: "English" },
      fields: {
        aiProviderFormat: "AI 提供商格式",
        aiProviderFormatDesc: "选择 API 请求格式，影响后端如何构造和发送请求。保存设置后生效。",
        openaiFormat: "OpenAI 格式", geminiFormat: "Gemini 格式",
        apiBaseUrl: "API Base URL", apiBaseUrlPlaceholder: "https://api.example.com",
        apiBaseUrlDesc: "设置大模型提供商 API 的基础 URL",
        apiKey: "API Key", apiKeyPlaceholder: "输入新的 API Key",
        apiKeyDesc: "留空则保持当前设置不变，输入新值则更新",
        apiKeySet: "已设置（长度: {{length}}）",
        textModel: "文本大模型", textModelPlaceholder: "留空使用环境变量配置 (如: gemini-3-flash-preview)",
        textModelDesc: "用于生成大纲、描述等文本内容的模型名称",
        imageModel: "图像生成模型", imageModelPlaceholder: "留空使用环境变量配置 (如: imagen-3.0-generate-001)",
        imageModelDesc: "用于生成页面图片的模型名称",
        imageCaptionModel: "图片识别模型", imageCaptionModelPlaceholder: "留空使用环境变量配置 (如: gemini-3-flash-preview)",
        imageCaptionModelDesc: "用于识别参考文件中的图片并生成描述",
        mineruApiBase: "MinerU API Base", mineruApiBasePlaceholder: "留空使用环境变量配置 (如: https://mineru.net)",
        mineruApiBaseDesc: "MinerU 服务地址，用于解析参考文件",
        mineruToken: "MinerU Token", mineruTokenPlaceholder: "输入新的 MinerU Token",
        mineruTokenDesc: "留空则保持当前设置不变，输入新值则更新",
        imageResolution: "图像清晰度（某些OpenAI格式中转调整该值无效）",
        imageResolutionDesc: "更高的清晰度会生成更详细的图像，但需要更长时间",
        maxDescriptionWorkers: "描述生成最大并发数", maxDescriptionWorkersDesc: "同时生成描述的最大工作线程数 (1-20)，越大速度越快",
        maxImageWorkers: "图像生成最大并发数", maxImageWorkersDesc: "同时生成图像的最大工作线程数 (1-20)，越大速度越快",
        defaultOutputLanguage: "默认输出语言", defaultOutputLanguageDesc: "AI 生成内容时使用的默认语言",
        enableTextReasoning: "启用文本推理", enableTextReasoningDesc: "开启后，文本生成（大纲、描述等）会使用 extended thinking 进行深度推理",
        textThinkingBudget: "文本思考负载", textThinkingBudgetDesc: "文本推理的思考 token 预算 (1-8192)，数值越大推理越深入",
        enableImageReasoning: "启用图像推理", enableImageReasoningDesc: "开启后，图像生成会使用思考链模式，可能获得更好的构图效果",
        imageThinkingBudget: "图像思考负载", imageThinkingBudgetDesc: "图像推理的思考 token 预算 (1-8192)，数值越大推理越深入",
        baiduOcrApiKey: "百度 OCR API Key", baiduOcrApiKeyPlaceholder: "输入百度 OCR API Key",
        baiduOcrApiKeyDesc: "用于可编辑 PPTX 导出时的文字识别功能，留空则保持当前设置不变"
      },
      apiKeyTip: "API 密匙获取可前往 {{link}}, 减小迁移成本",
      serviceTest: {
        title: "服务测试", description: "提前验证关键服务配置是否可用，避免使用期间异常。",
        tip: "提示：图像生成和 MinerU 测试可能需要 30-60 秒，请耐心等待。",
        startTest: "开始测试", testing: "测试中...", testTimeout: "测试超时，请重试", testFailed: "测试失败",
        tests: {
          baiduOcr: { title: "Baidu OCR 服务", description: "识别测试图片文字，验证 BAIDU_OCR_API_KEY 配置" },
          textModel: { title: "文本生成模型", description: "发送短提示词，验证文本模型与 API 配置" },
          captionModel: { title: "图片识别模型", description: "生成测试图片并请求模型输出描述" },
          baiduInpaint: { title: "Baidu 图像修复", description: "使用测试图片执行修复，验证百度 inpaint 服务" },
          imageModel: { title: "图像生成模型", description: "基于测试图片生成演示文稿背景图（1K, 可能需要 20-40 秒）" },
          mineruPdf: { title: "MinerU 解析 PDF", description: "上传测试 PDF 并等待解析结果返回（可能需要 30-60 秒）" }
        },
        results: {
          recognizedText: "识别结果：{{text}}", modelReply: "模型回复：{{reply}}",
          captionDesc: "识别描述：{{caption}}", imageSize: "输出尺寸：{{width}}x{{height}}",
          parsePreview: "解析预览：{{preview}}"
        }
      },
      actions: { save: "保存设置", saving: "保存中...", resetToDefault: "重置为默认配置" },
      messages: {
        loadFailed: "加载设置失败", saveSuccess: "设置保存成功", saveFailed: "保存设置失败",
        resetConfirm: "将把大模型、图像生成和并发等所有配置恢复为环境默认值，已保存的自定义设置将丢失，确定继续吗？",
        resetTitle: "确认重置为默认配置", resetSuccess: "设置已重置", resetFailed: "重置设置失败",
        testServiceTip: "建议在本页底部进行服务测试，验证关键配置"
      }
    }
  },
  en: {
    nav: { backToHome: 'Back to Home' },
    settings: {
      title: "Settings",
      subtitle: "Configure application parameters",
      sections: {
        appearance: "Appearance", language: "Interface Language", apiConfig: "LLM API Configuration",
        modelConfig: "Model Configuration", mineruConfig: "MinerU Configuration", imageConfig: "Image Generation Configuration",
        performanceConfig: "Performance Configuration", outputLanguage: "Output Language Settings",
        textReasoning: "Text Reasoning Mode", imageReasoning: "Image Reasoning Mode",
        baiduOcr: "Baidu OCR Configuration", serviceTest: "Service Test"
      },
      theme: { label: "Theme", light: "Light", dark: "Dark", system: "System" },
      language: { label: "Interface Language", zh: "中文", en: "English" },
      fields: {
        aiProviderFormat: "AI Provider Format",
        aiProviderFormatDesc: "Select API request format, affects how backend constructs and sends requests. Takes effect after saving.",
        openaiFormat: "OpenAI Format", geminiFormat: "Gemini Format",
        apiBaseUrl: "API Base URL", apiBaseUrlPlaceholder: "https://api.example.com",
        apiBaseUrlDesc: "Set the base URL for the LLM provider API",
        apiKey: "API Key", apiKeyPlaceholder: "Enter new API Key",
        apiKeyDesc: "Leave empty to keep current setting, enter new value to update",
        apiKeySet: "Set (length: {{length}})",
        textModel: "Text Model", textModelPlaceholder: "Leave empty to use env config (e.g., gemini-3-flash-preview)",
        textModelDesc: "Model name for generating outlines, descriptions, etc.",
        imageModel: "Image Generation Model", imageModelPlaceholder: "Leave empty to use env config (e.g., imagen-3.0-generate-001)",
        imageModelDesc: "Model name for generating page images",
        imageCaptionModel: "Image Caption Model", imageCaptionModelPlaceholder: "Leave empty to use env config (e.g., gemini-3-flash-preview)",
        imageCaptionModelDesc: "Model for recognizing images in reference files and generating descriptions",
        mineruApiBase: "MinerU API Base", mineruApiBasePlaceholder: "Leave empty to use env config (e.g., https://mineru.net)",
        mineruApiBaseDesc: "MinerU service address for parsing reference files",
        mineruToken: "MinerU Token", mineruTokenPlaceholder: "Enter new MinerU Token",
        mineruTokenDesc: "Leave empty to keep current setting, enter new value to update",
        imageResolution: "Image Resolution (may not work with some OpenAI format proxies)",
        imageResolutionDesc: "Higher resolution generates more detailed images but takes longer",
        maxDescriptionWorkers: "Max Description Workers", maxDescriptionWorkersDesc: "Maximum concurrent workers for description generation (1-20), higher is faster",
        maxImageWorkers: "Max Image Workers", maxImageWorkersDesc: "Maximum concurrent workers for image generation (1-20), higher is faster",
        defaultOutputLanguage: "Default Output Language", defaultOutputLanguageDesc: "Default language for AI-generated content",
        enableTextReasoning: "Enable Text Reasoning", enableTextReasoningDesc: "When enabled, text generation uses extended thinking for deeper reasoning",
        textThinkingBudget: "Text Thinking Budget", textThinkingBudgetDesc: "Token budget for text reasoning (1-8192), higher values enable deeper reasoning",
        enableImageReasoning: "Enable Image Reasoning", enableImageReasoningDesc: "When enabled, image generation uses chain-of-thought mode for better composition",
        imageThinkingBudget: "Image Thinking Budget", imageThinkingBudgetDesc: "Token budget for image reasoning (1-8192), higher values enable deeper reasoning",
        baiduOcrApiKey: "Baidu OCR API Key", baiduOcrApiKeyPlaceholder: "Enter Baidu OCR API Key",
        baiduOcrApiKeyDesc: "For text recognition in editable PPTX export, leave empty to keep current setting"
      },
      apiKeyTip: "Get API keys from {{link}} for easier migration",
      serviceTest: {
        title: "Service Test", description: "Verify key service configurations before use to avoid issues.",
        tip: "Tip: Image generation and MinerU tests may take 30-60 seconds, please be patient.",
        startTest: "Start Test", testing: "Testing...", testTimeout: "Test timeout, please retry", testFailed: "Test failed",
        tests: {
          baiduOcr: { title: "Baidu OCR Service", description: "Recognize text in test image, verify BAIDU_OCR_API_KEY configuration" },
          textModel: { title: "Text Generation Model", description: "Send short prompt to verify text model and API configuration" },
          captionModel: { title: "Image Caption Model", description: "Generate test image and request model to output description" },
          baiduInpaint: { title: "Baidu Image Inpainting", description: "Use test image for inpainting, verify Baidu inpaint service" },
          imageModel: { title: "Image Generation Model", description: "Generate presentation background from test image (1K, may take 20-40 seconds)" },
          mineruPdf: { title: "MinerU PDF Parsing", description: "Upload test PDF and wait for parsing result (may take 30-60 seconds)" }
        },
        results: {
          recognizedText: "Recognized: {{text}}", modelReply: "Model reply: {{reply}}",
          captionDesc: "Caption: {{caption}}", imageSize: "Output size: {{width}}x{{height}}",
          parsePreview: "Parse preview: {{preview}}"
        }
      },
      actions: { save: "Save Settings", saving: "Saving...", resetToDefault: "Reset to Default" },
      messages: {
        loadFailed: "Failed to load settings", saveSuccess: "Settings saved successfully", saveFailed: "Failed to save settings",
        resetConfirm: "This will reset all configurations (LLM, image generation, concurrency, etc.) to environment defaults. Custom settings will be lost. Continue?",
        resetTitle: "Confirm Reset to Default", resetSuccess: "Settings reset successfully", resetFailed: "Failed to reset settings",
        testServiceTip: "It's recommended to test services at the bottom of this page to verify configurations"
      }
    }
  }
};
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

// Settings 组件 - 纯嵌入模式（可复用）
export const Settings: React.FC = () => {
  const t = useT(settingsI18n);
  
  // 配置驱动的表单区块定义（使用翻译）
  const settingsSections: SectionConfig[] = [
    {
      title: t('settings.sections.apiConfig'),
      icon: <Key size={20} />,
      fields: [
        {
          key: 'ai_provider_format',
          label: t('settings.fields.aiProviderFormat'),
          type: 'buttons',
          description: t('settings.fields.aiProviderFormatDesc'),
          options: [
            { value: 'openai', label: t('settings.fields.openaiFormat') },
            { value: 'gemini', label: t('settings.fields.geminiFormat') },
          ],
        },
        {
          key: 'api_base_url',
          label: t('settings.fields.apiBaseUrl'),
          type: 'text',
          placeholder: t('settings.fields.apiBaseUrlPlaceholder'),
          description: t('settings.fields.apiBaseUrlDesc'),
        },
        {
          key: 'api_key',
          label: t('settings.fields.apiKey'),
          type: 'password',
          placeholder: t('settings.fields.apiKeyPlaceholder'),
          sensitiveField: true,
          lengthKey: 'api_key_length',
          description: t('settings.fields.apiKeyDesc'),
        },
      ],
    },
    {
      title: t('settings.sections.modelConfig'),
      icon: <FileText size={20} />,
      fields: [
        {
          key: 'text_model',
          label: t('settings.fields.textModel'),
          type: 'text',
          placeholder: t('settings.fields.textModelPlaceholder'),
          description: t('settings.fields.textModelDesc'),
        },
        {
          key: 'image_model',
          label: t('settings.fields.imageModel'),
          type: 'text',
          placeholder: t('settings.fields.imageModelPlaceholder'),
          description: t('settings.fields.imageModelDesc'),
        },
        {
          key: 'image_caption_model',
          label: t('settings.fields.imageCaptionModel'),
          type: 'text',
          placeholder: t('settings.fields.imageCaptionModelPlaceholder'),
          description: t('settings.fields.imageCaptionModelDesc'),
        },
      ],
    },
    {
      title: t('settings.sections.mineruConfig'),
      icon: <FileText size={20} />,
      fields: [
        {
          key: 'mineru_api_base',
          label: t('settings.fields.mineruApiBase'),
          type: 'text',
          placeholder: t('settings.fields.mineruApiBasePlaceholder'),
          description: t('settings.fields.mineruApiBaseDesc'),
        },
        {
          key: 'mineru_token',
          label: t('settings.fields.mineruToken'),
          type: 'password',
          placeholder: t('settings.fields.mineruTokenPlaceholder'),
          sensitiveField: true,
          lengthKey: 'mineru_token_length',
          description: t('settings.fields.mineruTokenDesc'),
        },
      ],
    },
    {
      title: t('settings.sections.imageConfig'),
      icon: <Image size={20} />,
      fields: [
        {
          key: 'image_resolution',
          label: t('settings.fields.imageResolution'),
          type: 'select',
          description: t('settings.fields.imageResolutionDesc'),
          options: [
            { value: '1K', label: '1K (1024px)' },
            { value: '2K', label: '2K (2048px)' },
            { value: '4K', label: '4K (4096px)' },
          ],
        },
      ],
    },
    {
      title: t('settings.sections.performanceConfig'),
      icon: <Zap size={20} />,
      fields: [
        {
          key: 'max_description_workers',
          label: t('settings.fields.maxDescriptionWorkers'),
          type: 'number',
          min: 1,
          max: 20,
          description: t('settings.fields.maxDescriptionWorkersDesc'),
        },
        {
          key: 'max_image_workers',
          label: t('settings.fields.maxImageWorkers'),
          type: 'number',
          min: 1,
          max: 20,
          description: t('settings.fields.maxImageWorkersDesc'),
        },
      ],
    },
    {
      title: t('settings.sections.outputLanguage'),
      icon: <Globe size={20} />,
      fields: [
        {
          key: 'output_language',
          label: t('settings.fields.defaultOutputLanguage'),
          type: 'buttons',
          description: t('settings.fields.defaultOutputLanguageDesc'),
          options: OUTPUT_LANGUAGE_OPTIONS,
        },
      ],
    },
    {
      title: t('settings.sections.textReasoning'),
      icon: <Brain size={20} />,
      fields: [
        {
          key: 'enable_text_reasoning',
          label: t('settings.fields.enableTextReasoning'),
          type: 'switch',
          description: t('settings.fields.enableTextReasoningDesc'),
        },
        {
          key: 'text_thinking_budget',
          label: t('settings.fields.textThinkingBudget'),
          type: 'number',
          min: 1,
          max: 8192,
          description: t('settings.fields.textThinkingBudgetDesc'),
        },
      ],
    },
    {
      title: t('settings.sections.imageReasoning'),
      icon: <Brain size={20} />,
      fields: [
        {
          key: 'enable_image_reasoning',
          label: t('settings.fields.enableImageReasoning'),
          type: 'switch',
          description: t('settings.fields.enableImageReasoningDesc'),
        },
        {
          key: 'image_thinking_budget',
          label: t('settings.fields.imageThinkingBudget'),
          type: 'number',
          min: 1,
          max: 8192,
          description: t('settings.fields.imageThinkingBudgetDesc'),
        },
      ],
    },
    {
      title: t('settings.sections.baiduOcr'),
      icon: <FileText size={20} />,
      fields: [
        {
          key: 'baidu_ocr_api_key',
          label: t('settings.fields.baiduOcrApiKey'),
          type: 'password',
          placeholder: t('settings.fields.baiduOcrApiKeyPlaceholder'),
          sensitiveField: true,
          lengthKey: 'baidu_ocr_api_key_length',
          description: t('settings.fields.baiduOcrApiKeyDesc'),
        },
      ],
    },
  ];
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
        show({ message: t('settings.messages.saveSuccess'), type: 'success' });
        show({ message: t('settings.messages.testServiceTip'), type: 'info' });
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
            show({ message: t('settings.messages.resetSuccess'), type: 'success' });
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
            show({ message: `${t('settings.serviceTest.testFailed')}: ${errorMessage}`, type: 'error' });
          }
          // 如果是 PENDING 或 PROCESSING，继续轮询
        } catch (pollError: any) {
          clearInterval(pollInterval);
          const errorMessage = pollError?.response?.data?.error?.message || pollError?.message || t('settings.serviceTest.testFailed');
          updateServiceTest(key, { status: 'error', message: errorMessage });
          show({ message: `${t('settings.serviceTest.testFailed')}: ${errorMessage}`, type: 'error' });
        }
      }, 2000); // 每2秒轮询一次

      // 设置最大轮询时间（2分钟）
      setTimeout(() => {
        clearInterval(pollInterval);
        if (serviceTestStates[key]?.status === 'loading') {
          updateServiceTest(key, { status: 'error', message: '测试超时' });
          show({ message: t('settings.serviceTest.testTimeout'), type: 'error' });
        }
      }, 120000);

    } catch (error: any) {
      const errorMessage = error?.response?.data?.error?.message || error?.message || t('common.unknownError');
      updateServiceTest(key, { status: 'error', message: errorMessage });
      show({ message: `${t('settings.serviceTest.testFailed')}: ${errorMessage}`, type: 'error' });
    }
  };

  const renderField = (field: FieldConfig) => {
    const value = formData[field.key];

    if (field.type === 'buttons' && field.options) {
      return (
        <div key={field.key}>
          <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">
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
                    : 'bg-white dark:bg-background-secondary border border-gray-200 dark:border-border-primary text-gray-700 dark:text-foreground-secondary hover:bg-gray-50 dark:hover:bg-background-hover hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {field.description && (
            <p className="mt-1 text-xs text-gray-500 dark:text-foreground-tertiary">{field.description}</p>
          )}
        </div>
      );
    }

    if (field.type === 'select' && field.options) {
      return (
        <div key={field.key}>
          <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">
            {field.label}
          </label>
          <select
            value={value as string}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className="w-full h-10 px-4 rounded-lg border border-gray-200 dark:border-border-primary bg-white dark:bg-background-secondary focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent"
          >
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {field.description && (
            <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">{field.description}</p>
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
            <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary">
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
                className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-background-secondary transition-transform ${
                  isEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {field.description && (
            <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">{field.description}</p>
          )}
        </div>
      );
    }

    // text, password, number 类型
    const placeholder = field.sensitiveField && settings && field.lengthKey
      ? t('settings.fields.apiKeySet', { length: settings[field.lengthKey] })
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
          <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">{field.description}</p>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading message={t('common.loading')} />
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
              <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground-primary mb-4 flex items-center">
                {section.icon}
                <span className="ml-2">{section.title}</span>
              </h2>
              <div className="space-y-4">
                {section.fields.map((field) => renderField(field))}
                {section.title === t('settings.sections.apiConfig') && (
                  <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
                    <p className="text-sm text-gray-700 dark:text-foreground-secondary">
                      {t('settings.apiKeyTip', { link: '' }).split('{{link}}')[0]}
                      <a
                        href="https://aihubmix.com/?aff=17EC"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline font-medium"
                      >
                        AIHubmix
                      </a>
                      {t('settings.apiKeyTip', { link: '' }).split('{{link}}')[1]}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 服务测试区 */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground-primary mb-2 flex items-center">
            <FileText size={20} />
            <span className="ml-2">{t('settings.serviceTest.title')}</span>
          </h2>
          <p className="text-sm text-gray-500 dark:text-foreground-tertiary">
            {t('settings.serviceTest.description')}
          </p>
          <div className="p-3 bg-yellow-50 dark:bg-background-primary border border-yellow-200 dark:border-yellow-700 rounded-lg">
            <p className="text-sm text-gray-700 dark:text-foreground-secondary">
              💡 {t('settings.serviceTest.tip')}
            </p>
          </div>
          <div className="space-y-4">
            {[
              {
                key: 'baidu-ocr',
                titleKey: 'settings.serviceTest.tests.baiduOcr.title',
                descriptionKey: 'settings.serviceTest.tests.baiduOcr.description',
                resultKey: 'settings.serviceTest.results.recognizedText',
                action: api.testBaiduOcr,
                formatDetail: (data: any) => (data?.recognized_text ? t('settings.serviceTest.results.recognizedText', { text: data.recognized_text }) : ''),
              },
              {
                key: 'text-model',
                titleKey: 'settings.serviceTest.tests.textModel.title',
                descriptionKey: 'settings.serviceTest.tests.textModel.description',
                resultKey: 'settings.serviceTest.results.modelReply',
                action: api.testTextModel,
                formatDetail: (data: any) => (data?.reply ? t('settings.serviceTest.results.modelReply', { reply: data.reply }) : ''),
              },
              {
                key: 'caption-model',
                titleKey: 'settings.serviceTest.tests.captionModel.title',
                descriptionKey: 'settings.serviceTest.tests.captionModel.description',
                resultKey: 'settings.serviceTest.results.captionDesc',
                action: api.testCaptionModel,
                formatDetail: (data: any) => (data?.caption ? t('settings.serviceTest.results.captionDesc', { caption: data.caption }) : ''),
              },
              {
                key: 'baidu-inpaint',
                titleKey: 'settings.serviceTest.tests.baiduInpaint.title',
                descriptionKey: 'settings.serviceTest.tests.baiduInpaint.description',
                resultKey: 'settings.serviceTest.results.imageSize',
                action: api.testBaiduInpaint,
                formatDetail: (data: any) => (data?.image_size ? t('settings.serviceTest.results.imageSize', { width: data.image_size[0], height: data.image_size[1] }) : ''),
              },
              {
                key: 'image-model',
                titleKey: 'settings.serviceTest.tests.imageModel.title',
                descriptionKey: 'settings.serviceTest.tests.imageModel.description',
                resultKey: 'settings.serviceTest.results.imageSize',
                action: api.testImageModel,
                formatDetail: (data: any) => (data?.image_size ? t('settings.serviceTest.results.imageSize', { width: data.image_size[0], height: data.image_size[1] }) : ''),
              },
              {
                key: 'mineru-pdf',
                titleKey: 'settings.serviceTest.tests.mineruPdf.title',
                descriptionKey: 'settings.serviceTest.tests.mineruPdf.description',
                resultKey: 'settings.serviceTest.results.parsePreview',
                action: api.testMineruPdf,
                formatDetail: (data: any) => (data?.content_preview ? t('settings.serviceTest.results.parsePreview', { preview: data.content_preview }) : data?.message || ''),
              },
            ].map((item) => {
              const testState = serviceTestStates[item.key] || { status: 'idle' as TestStatus };
              const isLoadingTest = testState.status === 'loading';
              return (
                <div
                  key={item.key}
                  className="p-4 bg-gray-50 dark:bg-background-primary border border-gray-200 dark:border-border-primary rounded-lg space-y-2"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-base font-semibold text-gray-800 dark:text-foreground-primary">{t(item.titleKey)}</div>
                      <div className="text-sm text-gray-500 dark:text-foreground-tertiary">{t(item.descriptionKey)}</div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={isLoadingTest}
                      onClick={() => handleServiceTest(item.key, item.action, item.formatDetail)}
                    >
                      {isLoadingTest ? t('settings.serviceTest.testing') : t('settings.serviceTest.startTest')}
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
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-border-primary">
          <Button
            variant="secondary"
            icon={<RotateCcw size={18} />}
            onClick={handleReset}
            disabled={isSaving}
          >
            {t('settings.actions.resetToDefault')}
          </Button>
          <Button
            variant="primary"
            icon={<Save size={18} />}
            onClick={handleSave}
            loading={isSaving}
          >
            {isSaving ? t('settings.actions.saving') : t('settings.actions.save')}
          </Button>
        </div>
      </div>
    </>
  );
};

// SettingsPage 组件 - 完整页面包装
export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const t = useT(settingsI18n);

  return (
    <div className="min-h-screen bg-gradient-to-br from-banana-50 dark:from-background-primary to-yellow-50 dark:to-background-primary">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="p-6 md:p-8">
          <div className="space-y-8">
            {/* 顶部标题 */}
            <div className="flex items-center justify-between pb-6 border-b border-gray-200 dark:border-border-primary">
              <div className="flex items-center">
                <Button
                  variant="secondary"
                  icon={<Home size={18} />}
                  onClick={() => navigate('/')}
                  className="mr-4"
                >
                  {t('nav.backToHome')}
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground-primary">{t('settings.title')}</h1>
                  <p className="text-sm text-gray-500 dark:text-foreground-tertiary mt-1">
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
