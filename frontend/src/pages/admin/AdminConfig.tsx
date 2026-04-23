import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CreditCard,
  Database,
  Image,
  Package,
  Plus,
  Save,
  Settings,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import { useT } from '@/hooks/useT';
import { Button, Card, Input, Loading, useToast } from '@/components/shared';
import * as api from '@/api/endpoints';
import { paymentApi, CreditPackage } from '@/api/payment';

const adminConfigI18n = {
  zh: {
    title: '系统配置',
    subtitle: '管理系统级配置，包括支付、存储、用户策略、积分定价等',
    back: '返回管理后台',
    save: '保存配置',
    saving: '保存中...',
    saveSuccess: '配置保存成功',
    saveFailed: '保存失败',
    sections: {
      userPolicy: '用户策略',
      userPolicyDesc: '配置普通用户可以自定义的设置字段',
      creditPricing: '积分定价',
      creditPricingDesc: '配置各项操作的积分消耗',
      bonusConfig: '奖励配置',
      bonusConfigDesc: '配置注册和邀请奖励',
      payment: '支付栈配置',
      paymentDesc: '在管理后台同时维护 Stripe、PayPal、虎皮椒、Lemon Squeezy 等支付通道。',
      storage: '对象存储配置',
      storageDesc: '在本地、Cloudflare R2、阿里云 OSS 之间切换，并统一管理图片 / 导出文件访问。',
      features: '功能开关',
      featuresDesc: '启用或禁用特定功能',
      packages: '积分套餐',
      packagesDesc: '配置各套餐的积分数量和价格',
      imagePool: '文生图渠道池',
      imagePoolDesc: '配置多个文生图渠道，按优先级自动降级',
    },
    actions: {
      enabled: '已启用',
      disabled: '未启用',
      defaultProvider: '默认支付渠道',
      activeStorage: '当前存储后端',
      providerMode: '运行模式',
      signedUrlTtl: '签名链接 TTL（秒）',
    },
    channelFields: {
      name: '渠道名称',
      providerFormat: '提供商格式',
      apiKey: 'API Key',
      apiBase: 'API Base URL',
      model: '模型',
      priority: '优先级',
      enabled: '启用',
      addChannel: '添加渠道',
    },
    packageFields: {
      credits: '积分',
      bonusCredits: '赠送积分',
      priceCny: '价格 (CNY)',
      priceUsd: '价格 (USD)',
      resetToDefault: '恢复默认',
    },
    fields: {
      userEditableFields: '用户可编辑字段',
      registrationBonus: '注册奖励积分',
      invitationBonus: '邀请奖励积分（双方各得）',
      maxInvitationCodes: '每用户最大邀请码数',
      costGenerateOutline: '生成大纲',
      costGenerateDescription: '生成描述（每页）',
      costGenerateImage1k: '生成图片 1K（每页）',
      costGenerateImage2k: '生成图片 2K（每页）',
      costGenerateImage4k: '生成图片 4K（每页）',
      costEditImage: '编辑图片',
      costGenerateMaterial: '生成素材',
      costRefineOutline: '修改大纲',
      costRefineDescription: '修改描述（每页）',
      costParseFile: '解析参考文件',
      costExportEditable: '导出可编辑 PPTX（每页）',
      enableCreditsPurchase: '允许用户购买积分',
      enableAlipay: '开放支付宝支付',
      enableInvitation: '启用邀请功能',
    },
    fieldCategories: {
      api: 'API 配置',
      model: '模型配置',
      mineru: 'MinerU 配置',
      image: '图像配置',
      performance: '性能配置',
      output: '输出配置',
      reasoning: '推理配置',
      ocr: 'OCR 配置',
    },
  },
  en: {
    title: 'System Configuration',
    subtitle: 'Manage payments, storage, user policy, credit pricing, and more from one admin surface.',
    back: 'Back to Admin',
    save: 'Save Configuration',
    saving: 'Saving...',
    saveSuccess: 'Configuration saved successfully',
    saveFailed: 'Failed to save',
    sections: {
      userPolicy: 'User Policy',
      userPolicyDesc: 'Configure which settings fields users can customize',
      creditPricing: 'Credit Pricing',
      creditPricingDesc: 'Configure credit costs for various operations',
      bonusConfig: 'Bonus Configuration',
      bonusConfigDesc: 'Configure registration and invitation bonuses',
      payment: 'Payment Stack',
      paymentDesc: 'Configure Stripe, PayPal, XunhuPay, and Lemon Squeezy from the admin dashboard.',
      storage: 'Object Storage',
      storageDesc: 'Switch between local storage, Cloudflare R2, and Alibaba Cloud OSS for asset delivery.',
      features: 'Feature Toggles',
      featuresDesc: 'Enable or disable specific features',
      packages: 'Credit Packages',
      packagesDesc: 'Configure credits and pricing for each package',
      imagePool: 'Image Provider Pool',
      imagePoolDesc: 'Configure multiple image generation channels with priority-based fallback',
    },
    actions: {
      enabled: 'Enabled',
      disabled: 'Disabled',
      defaultProvider: 'Default payment provider',
      activeStorage: 'Active storage backend',
      providerMode: 'Mode',
      signedUrlTtl: 'Signed URL TTL (seconds)',
    },
    channelFields: {
      name: 'Channel Name',
      providerFormat: 'Provider Format',
      apiKey: 'API Key',
      apiBase: 'API Base URL',
      model: 'Model',
      priority: 'Priority',
      enabled: 'Enabled',
      addChannel: 'Add Channel',
    },
    packageFields: {
      credits: 'Credits',
      bonusCredits: 'Bonus Credits',
      priceCny: 'Price (CNY)',
      priceUsd: 'Price (USD)',
      resetToDefault: 'Reset to Default',
    },
    fields: {
      userEditableFields: 'User Editable Fields',
      registrationBonus: 'Registration Bonus Credits',
      invitationBonus: 'Invitation Bonus Credits',
      maxInvitationCodes: 'Max Invitation Codes per User',
      costGenerateOutline: 'Generate Outline',
      costGenerateDescription: 'Generate Description (per page)',
      costGenerateImage1k: 'Generate Image 1K (per page)',
      costGenerateImage2k: 'Generate Image 2K (per page)',
      costGenerateImage4k: 'Generate Image 4K (per page)',
      costEditImage: 'Edit Image',
      costGenerateMaterial: 'Generate Material',
      costRefineOutline: 'Refine Outline',
      costRefineDescription: 'Refine Description (per page)',
      costParseFile: 'Parse Reference File',
      costExportEditable: 'Export Editable PPTX (per page)',
      enableCreditsPurchase: 'Enable Credit Purchase',
      enableAlipay: 'Enable Alipay',
      enableInvitation: 'Enable Invitation',
    },
    fieldCategories: {
      api: 'API Config',
      model: 'Model Config',
      mineru: 'MinerU Config',
      image: 'Image Config',
      performance: 'Performance',
      output: 'Output Config',
      reasoning: 'Reasoning Config',
      ocr: 'OCR Config',
    },
  },
};

interface PackageConfig {
  id: string;
  name: string;
  credits: number;
  price_cny: number;
  price_usd: number;
  description: string;
  bonus_credits: number;
}

interface ProviderChannel {
  id: string;
  name: string;
  provider_format: string;
  api_key: string;
  api_key_length?: number;
  api_base: string;
  model: string;
  priority: number;
  enabled: boolean;
}

interface StripeConfig {
  secret_key: string;
  secret_key_length?: number;
  webhook_secret: string;
  webhook_secret_length?: number;
  portal_configuration_id: string;
  portal_return_url: string;
  price_ids: Record<string, string>;
  subscription_price_ids: Record<string, string>;
}

interface PayPalConfig {
  client_id: string;
  client_id_length?: number;
  client_secret: string;
  client_secret_length?: number;
  webhook_id: string;
  webhook_id_length?: number;
  mode: string;
  brand_name: string;
  currency: string;
  plan_ids: Record<string, string>;
}

interface XunhuPayConfig {
  app_id: string;
  app_id_length?: number;
  app_secret: string;
  app_secret_length?: number;
}

interface LemonConfig {
  api_key: string;
  api_key_length?: number;
  webhook_secret: string;
  webhook_secret_length?: number;
  store_id: string;
  variant_ids: Record<string, string>;
}

interface LocalStorageConfig {
  upload_folder: string;
}

interface R2StorageConfig {
  account_id: string;
  bucket: string;
  access_key_id: string;
  access_key_id_length?: number;
  secret_access_key: string;
  secret_access_key_length?: number;
  public_base_url: string;
  region: string;
  endpoint_url: string;
  signed_url_ttl: number;
}

interface OSSStorageConfig {
  bucket: string;
  endpoint: string;
  access_key_id: string;
  access_key_id_length?: number;
  access_key_secret: string;
  access_key_secret_length?: number;
  public_base_url: string;
  signed_url_ttl: number;
}

interface SystemConfig {
  user_editable_fields: string[];
  registration_bonus: number;
  invitation_bonus: number;
  max_invitation_codes: number;
  cost_generate_outline: number;
  cost_generate_description: number;
  cost_generate_image_1k: number;
  cost_generate_image_2k: number;
  cost_generate_image_4k: number;
  cost_edit_image: number;
  cost_generate_material: number;
  cost_refine_outline: number;
  cost_refine_description: number;
  cost_parse_file: number;
  cost_export_editable: number;
  xunhupay_app_id: string;
  xunhupay_app_secret: string;
  xunhupay_app_secret_length: number;
  enable_credits_purchase: boolean;
  enable_alipay: boolean;
  enable_invitation: boolean;
  credit_packages: PackageConfig[] | null;
  image_provider_pool: ProviderChannel[] | null;
  default_payment_provider: string;
  enabled_payment_providers: string[];
  payment_provider_configs: {
    stripe: StripeConfig;
    paypal: PayPalConfig;
    xunhupay: XunhuPayConfig;
    lemon_squeezy: LemonConfig;
  };
  storage_backend: 'local' | 'r2' | 'oss';
  storage_provider_configs: {
    local: LocalStorageConfig;
    r2: R2StorageConfig;
    oss: OSSStorageConfig;
  };
}

interface FieldInfo {
  key: string;
  label: string;
  category: string;
  sensitive?: boolean;
}

const ALL_SETTINGS_FIELDS: FieldInfo[] = [
  { key: 'ai_provider_format', label: 'AI 提供商格式', category: 'api' },
  { key: 'api_base_url', label: 'API Base URL', category: 'api' },
  { key: 'api_key', label: 'API Key', category: 'api', sensitive: true },
  { key: 'text_model', label: '文本模型', category: 'model' },
  { key: 'image_model', label: '图像生成模型', category: 'model' },
  { key: 'image_caption_model', label: '图片识别模型', category: 'model' },
  { key: 'mineru_api_base', label: 'MinerU API Base', category: 'mineru' },
  { key: 'mineru_token', label: 'MinerU Token', category: 'mineru', sensitive: true },
  { key: 'image_resolution', label: '图像清晰度', category: 'image' },
  { key: 'image_aspect_ratio', label: '图像宽高比', category: 'image' },
  { key: 'max_description_workers', label: '描述生成并发数', category: 'performance' },
  { key: 'max_image_workers', label: '图像生成并发数', category: 'performance' },
  { key: 'output_language', label: '输出语言', category: 'output' },
  { key: 'enable_text_reasoning', label: '文本推理模式', category: 'reasoning' },
  { key: 'text_thinking_budget', label: '文本思考负载', category: 'reasoning' },
  { key: 'enable_image_reasoning', label: '图像推理模式', category: 'reasoning' },
  { key: 'image_thinking_budget', label: '图像思考负载', category: 'reasoning' },
  { key: 'baidu_ocr_api_key', label: '百度 OCR API Key', category: 'ocr', sensitive: true },
];

const EMPTY_SYSTEM_CONFIG: SystemConfig = {
  user_editable_fields: [],
  registration_bonus: 50,
  invitation_bonus: 50,
  max_invitation_codes: 3,
  cost_generate_outline: 5,
  cost_generate_description: 1,
  cost_generate_image_1k: 4,
  cost_generate_image_2k: 8,
  cost_generate_image_4k: 16,
  cost_edit_image: 8,
  cost_generate_material: 10,
  cost_refine_outline: 2,
  cost_refine_description: 1,
  cost_parse_file: 5,
  cost_export_editable: 15,
  xunhupay_app_id: '',
  xunhupay_app_secret: '',
  xunhupay_app_secret_length: 0,
  enable_credits_purchase: true,
  enable_alipay: false,
  enable_invitation: true,
  credit_packages: null,
  image_provider_pool: null,
  default_payment_provider: 'stripe',
  enabled_payment_providers: ['stripe'],
  payment_provider_configs: {
    stripe: {
      secret_key: '',
      webhook_secret: '',
      portal_configuration_id: '',
      portal_return_url: '',
      price_ids: { starter: '', basic: '', standard: '', pro: '', enterprise: '' },
      subscription_price_ids: { pro_monthly: '', team_monthly: '', enterprise_monthly: '' },
    },
    paypal: {
      client_id: '',
      client_secret: '',
      webhook_id: '',
      mode: 'sandbox',
      brand_name: 'Banana Slides',
      currency: 'USD',
      plan_ids: { pro_monthly: '', team_monthly: '', enterprise_monthly: '' },
    },
    xunhupay: {
      app_id: '',
      app_secret: '',
    },
    lemon_squeezy: {
      api_key: '',
      webhook_secret: '',
      store_id: '',
      variant_ids: { starter: '', basic: '', standard: '', pro: '', enterprise: '' },
    },
  },
  storage_backend: 'local',
  storage_provider_configs: {
    local: { upload_folder: '' },
    r2: {
      account_id: '',
      bucket: '',
      access_key_id: '',
      secret_access_key: '',
      public_base_url: '',
      region: 'auto',
      endpoint_url: '',
      signed_url_ttl: 3600,
    },
    oss: {
      bucket: '',
      endpoint: '',
      access_key_id: '',
      access_key_secret: '',
      public_base_url: '',
      signed_url_ttl: 3600,
    },
  },
};

const PAYMENT_PROVIDER_OPTIONS = [
  { value: 'stripe', label: 'Stripe' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'xunhupay', label: 'XunhuPay' },
  { value: 'lemon_squeezy', label: 'Lemon Squeezy' },
] as const;

const STORAGE_BACKEND_OPTIONS = [
  { value: 'local', label: 'Local Storage' },
  { value: 'r2', label: 'Cloudflare R2' },
  { value: 'oss', label: 'Alibaba Cloud OSS' },
] as const;

const deepMerge = <T,>(base: T, override: any): T => {
  if (Array.isArray(base)) {
    return (Array.isArray(override) ? override : base) as T;
  }
  if (typeof base === 'object' && base !== null) {
    const result: any = { ...(base as any) };
    if (override && typeof override === 'object') {
      Object.entries(override).forEach(([key, value]) => {
        const existing = (result as any)[key];
        if (existing && typeof existing === 'object' && !Array.isArray(existing) && value && typeof value === 'object' && !Array.isArray(value)) {
          (result as any)[key] = deepMerge(existing, value);
        } else {
          (result as any)[key] = value;
        }
      });
    }
    return result;
  }
  return (override ?? base) as T;
};

const normalizeConfig = (raw: any): SystemConfig => deepMerge(EMPTY_SYSTEM_CONFIG, raw || {});

const ProviderToggle: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
      checked ? 'bg-green-500' : 'bg-gray-300'
    }`}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
      checked ? 'translate-x-6' : 'translate-x-1'
    }`} />
  </button>
);

const SecretPlaceholder = (length?: number, fallback = '') => (length ? `(${length} chars set)` : fallback);

export const AdminConfig: React.FC = () => {
  const t = useT(adminConfigI18n);
  const { show, ToastContainer } = useToast();

  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fieldsByCategory = useMemo(() => ALL_SETTINGS_FIELDS.reduce((acc, field) => {
    if (!acc[field.category]) acc[field.category] = [];
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, FieldInfo[]>), []);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const [res, packageCatalog] = await Promise.all([
        api.getSystemConfig(),
        paymentApi.getPackages(),
      ]);
      if (res.data) setConfig(normalizeConfig(res.data));
      setPackages(packageCatalog.packages || []);
    } catch (error: any) {
      show({ message: error?.message || 'Failed to load config', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const updateConfig = (patch: Partial<SystemConfig>) => {
    setConfig((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const handleSave = async () => {
    if (!config) return;

    const payload = { ...config };
    if (!payload.enabled_payment_providers.includes(payload.default_payment_provider)) {
      payload.enabled_payment_providers = [payload.default_payment_provider, ...payload.enabled_payment_providers];
    }

    setIsSaving(true);
    try {
      await api.updateSystemConfig(payload);
      show({ message: t('saveSuccess'), type: 'success' });
      await loadConfig();
    } catch (error: any) {
      show({ message: error?.response?.data?.error?.message || t('saveFailed'), type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFieldToggle = (fieldKey: string) => {
    if (!config) return;
    const fields = new Set(config.user_editable_fields);
    if (fields.has(fieldKey)) {
      fields.delete(fieldKey);
    } else {
      fields.add(fieldKey);
    }
    updateConfig({ user_editable_fields: Array.from(fields) });
  };

  const handleNumberChange = (key: keyof SystemConfig, value: string) => {
    if (!config) return;
    const numValue = parseInt(value, 10) || 0;
    updateConfig({ [key]: numValue } as Partial<SystemConfig>);
  };

  const handleBoolChange = (key: keyof SystemConfig, value: boolean) => {
    if (!config) return;
    updateConfig({ [key]: value } as Partial<SystemConfig>);
  };

  const handlePackageChange = (index: number, field: string, value: string) => {
    if (!config) return;
    const pkgs = config.credit_packages || packages.map(({ id, name, credits, bonus_credits, price_cny, price_usd, description }) => ({
      id,
      name,
      credits,
      bonus_credits,
      price_cny,
      price_usd,
      description,
    }));
    const updated = [...pkgs];
    updated[index] = {
      ...updated[index],
      [field]: field === 'credits' || field === 'bonus_credits'
        ? (parseInt(value, 10) || 0)
        : (parseFloat(value) || 0),
    };
    updateConfig({ credit_packages: updated });
  };

  const handleResetPackages = () => updateConfig({ credit_packages: null });

  const handleAddChannel = () => {
    if (!config) return;
    const pool = config.image_provider_pool || [];
    const newChannel: ProviderChannel = {
      id: crypto.randomUUID(),
      name: '',
      provider_format: 'gemini',
      api_key: '',
      api_base: '',
      model: 'gemini-3-pro-image-preview',
      priority: pool.length + 1,
      enabled: true,
    };
    updateConfig({ image_provider_pool: [...pool, newChannel] });
  };

  const handleRemoveChannel = (index: number) => {
    if (!config || !config.image_provider_pool) return;
    const updated = config.image_provider_pool.filter((_, i) => i !== index);
    updateConfig({ image_provider_pool: updated.length ? updated : null });
  };

  const handleChannelChange = (index: number, field: string, value: string | number | boolean) => {
    if (!config || !config.image_provider_pool) return;
    const updated = [...config.image_provider_pool];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig({ image_provider_pool: updated });
  };

  const togglePaymentProvider = (provider: string) => {
    if (!config) return;
    const enabled = new Set(config.enabled_payment_providers);
    if (enabled.has(provider)) {
      if (provider === config.default_payment_provider) return;
      enabled.delete(provider);
    } else {
      enabled.add(provider);
    }
    updateConfig({ enabled_payment_providers: Array.from(enabled) });
  };

  const handlePaymentProviderField = (provider: keyof SystemConfig['payment_provider_configs'], field: string, value: any) => {
    if (!config) return;
    updateConfig({
      payment_provider_configs: {
        ...config.payment_provider_configs,
        [provider]: {
          ...(config.payment_provider_configs as any)[provider],
          [field]: value,
        },
      },
    });
  };

  const handleNestedPaymentProviderField = (
    provider: keyof SystemConfig['payment_provider_configs'],
    group: string,
    field: string,
    value: any,
  ) => {
    if (!config) return;
    const providerConfig: any = (config.payment_provider_configs as any)[provider] || {};
    updateConfig({
      payment_provider_configs: {
        ...config.payment_provider_configs,
        [provider]: {
          ...providerConfig,
          [group]: {
            ...(providerConfig[group] || {}),
            [field]: value,
          },
        },
      },
    });
  };

  const handleStorageField = (provider: keyof SystemConfig['storage_provider_configs'], field: string, value: any) => {
    if (!config) return;
    updateConfig({
      storage_provider_configs: {
        ...config.storage_provider_configs,
        [provider]: {
          ...(config.storage_provider_configs as any)[provider],
          [field]: value,
        },
      },
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background-primary">
        <Loading />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background-primary">
        <p className="text-red-500">Failed to load configuration</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background-primary">
      <ToastContainer />

      <header className="bg-white dark:bg-background-secondary border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/admin"
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-foreground-secondary dark:hover:text-foreground-primary flex items-center gap-1"
          >
            <ArrowLeft size={16} />
            {t('back')}
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-foreground-primary flex items-center gap-2">
            <Settings size={20} />
            {t('title')}
          </h1>
        </div>
        <Button
          variant="primary"
          icon={<Save size={18} />}
          onClick={handleSave}
          loading={isSaving}
        >
          {isSaving ? t('saving') : t('save')}
        </Button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <Card className="p-6 mb-6">
          <div className="flex items-center mb-4">
            <Shield className="mr-2 text-blue-500" size={20} />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground-primary">{t('sections.userPolicy')}</h2>
              <p className="text-sm text-gray-500 dark:text-foreground-tertiary">{t('sections.userPolicyDesc')}</p>
            </div>
          </div>

          <div className="space-y-4">
            {Object.entries(fieldsByCategory).map(([category, fields]) => (
              <div key={category} className="border-b dark:border-border-primary pb-4 last:border-0">
                <h3 className="text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">
                  {t(`fieldCategories.${category}` as any) || category}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {fields.map((field) => {
                    const isEnabled = config.user_editable_fields.includes(field.key);
                    return (
                      <button
                        key={field.key}
                        onClick={() => handleFieldToggle(field.key)}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                          isEnabled
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 dark:bg-background-secondary text-gray-600 dark:text-foreground-tertiary hover:bg-gray-200 dark:hover:bg-background-hover'
                        } ${field.sensitive ? 'border-2 border-yellow-400' : ''}`}
                        title={field.sensitive ? 'Sensitive field' : ''}
                        type="button"
                      >
                        {field.label}
                        {field.sensitive && ' 🔒'}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 mb-6">
          <div className="flex items-center mb-4">
            <Users className="mr-2 text-green-500" size={20} />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground-primary">{t('sections.bonusConfig')}</h2>
              <p className="text-sm text-gray-500 dark:text-foreground-tertiary">{t('sections.bonusConfigDesc')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1">{t('fields.registrationBonus')}</label>
              <Input type="number" value={config.registration_bonus} onChange={(e) => handleNumberChange('registration_bonus', e.target.value)} min={0} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1">{t('fields.invitationBonus')}</label>
              <Input type="number" value={config.invitation_bonus} onChange={(e) => handleNumberChange('invitation_bonus', e.target.value)} min={0} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1">{t('fields.maxInvitationCodes')}</label>
              <Input type="number" value={config.max_invitation_codes} onChange={(e) => handleNumberChange('max_invitation_codes', e.target.value)} min={0} max={100} />
            </div>
          </div>
        </Card>

        <Card className="p-6 mb-6">
          <div className="flex items-center mb-4">
            <CreditCard className="mr-2 text-purple-500" size={20} />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground-primary">{t('sections.creditPricing')}</h2>
              <p className="text-sm text-gray-500 dark:text-foreground-tertiary">{t('sections.creditPricingDesc')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { key: 'cost_generate_outline', label: t('fields.costGenerateOutline') },
              { key: 'cost_generate_description', label: t('fields.costGenerateDescription') },
              { key: 'cost_generate_image_1k', label: t('fields.costGenerateImage1k') },
              { key: 'cost_generate_image_2k', label: t('fields.costGenerateImage2k') },
              { key: 'cost_generate_image_4k', label: t('fields.costGenerateImage4k') },
              { key: 'cost_edit_image', label: t('fields.costEditImage') },
              { key: 'cost_generate_material', label: t('fields.costGenerateMaterial') },
              { key: 'cost_refine_outline', label: t('fields.costRefineOutline') },
              { key: 'cost_refine_description', label: t('fields.costRefineDescription') },
              { key: 'cost_parse_file', label: t('fields.costParseFile') },
              { key: 'cost_export_editable', label: t('fields.costExportEditable') },
            ].map((item) => (
              <div key={item.key}>
                <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1">{item.label}</label>
                <Input
                  type="number"
                  value={(config as any)[item.key]}
                  onChange={(e) => handleNumberChange(item.key as keyof SystemConfig, e.target.value)}
                  min={0}
                />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 mb-6">
          <div className="flex items-center mb-4">
            <CreditCard className="mr-2 text-emerald-500" size={20} />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground-primary">{t('sections.payment')}</h2>
              <p className="text-sm text-gray-500 dark:text-foreground-tertiary">{t('sections.paymentDesc')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1">{t('actions.defaultProvider')}</label>
              <select
                value={config.default_payment_provider}
                onChange={(e) => updateConfig({ default_payment_provider: e.target.value })}
                className="w-full rounded-md border border-gray-300 dark:border-border-primary bg-white dark:bg-background-secondary text-sm px-3 py-2"
              >
                {PAYMENT_PROVIDER_OPTIONS.map((provider) => (
                  <option key={provider.value} value={provider.value}>{provider.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1">Enabled Providers</label>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_PROVIDER_OPTIONS.map((provider) => {
                  const enabled = config.enabled_payment_providers.includes(provider.value);
                  const isDefault = provider.value === config.default_payment_provider;
                  return (
                    <button
                      key={provider.value}
                      type="button"
                      onClick={() => togglePaymentProvider(provider.value)}
                      disabled={isDefault}
                      className={`px-3 py-2 rounded-full text-sm border transition-colors ${
                        enabled
                          ? 'border-banana bg-banana/10 text-banana'
                          : 'border-gray-200 dark:border-border-primary text-gray-500 dark:text-foreground-tertiary'
                      } ${isDefault ? 'opacity-100 cursor-default' : ''}`}
                    >
                      {provider.label}{isDefault ? ' · default' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="border dark:border-border-primary rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-foreground-primary">Stripe</h3>
                <ProviderToggle checked={config.enabled_payment_providers.includes('stripe')} onChange={() => togglePaymentProvider('stripe')} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Secret Key</label>
                  <Input
                    type="password"
                    value={config.payment_provider_configs.stripe.secret_key}
                    onChange={(e) => handlePaymentProviderField('stripe', 'secret_key', e.target.value)}
                    placeholder={SecretPlaceholder(config.payment_provider_configs.stripe.secret_key_length)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Webhook Secret</label>
                  <Input
                    type="password"
                    value={config.payment_provider_configs.stripe.webhook_secret}
                    onChange={(e) => handlePaymentProviderField('stripe', 'webhook_secret', e.target.value)}
                    placeholder={SecretPlaceholder(config.payment_provider_configs.stripe.webhook_secret_length)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Portal Configuration ID</label>
                  <Input value={config.payment_provider_configs.stripe.portal_configuration_id} onChange={(e) => handlePaymentProviderField('stripe', 'portal_configuration_id', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Portal Return URL</label>
                  <Input value={config.payment_provider_configs.stripe.portal_return_url} onChange={(e) => handlePaymentProviderField('stripe', 'portal_return_url', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                {['starter', 'basic', 'standard', 'pro', 'enterprise'].map((priceKey) => (
                  <div key={priceKey}>
                    <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Price ID · {priceKey}</label>
                    <Input
                      value={config.payment_provider_configs.stripe.price_ids[priceKey] || ''}
                      onChange={(e) => handleNestedPaymentProviderField('stripe', 'price_ids', priceKey, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                {['pro_monthly', 'team_monthly', 'enterprise_monthly'].map((planKey) => (
                  <div key={planKey}>
                    <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Subscription Price · {planKey}</label>
                    <Input
                      value={config.payment_provider_configs.stripe.subscription_price_ids[planKey] || ''}
                      onChange={(e) => handleNestedPaymentProviderField('stripe', 'subscription_price_ids', planKey, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="border dark:border-border-primary rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-foreground-primary">PayPal</h3>
                <ProviderToggle checked={config.enabled_payment_providers.includes('paypal')} onChange={() => togglePaymentProvider('paypal')} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Client ID</label>
                  <Input
                    type="password"
                    value={config.payment_provider_configs.paypal.client_id}
                    onChange={(e) => handlePaymentProviderField('paypal', 'client_id', e.target.value)}
                    placeholder={SecretPlaceholder(config.payment_provider_configs.paypal.client_id_length)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Client Secret</label>
                  <Input
                    type="password"
                    value={config.payment_provider_configs.paypal.client_secret}
                    onChange={(e) => handlePaymentProviderField('paypal', 'client_secret', e.target.value)}
                    placeholder={SecretPlaceholder(config.payment_provider_configs.paypal.client_secret_length)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Webhook ID</label>
                  <Input
                    type="password"
                    value={config.payment_provider_configs.paypal.webhook_id}
                    onChange={(e) => handlePaymentProviderField('paypal', 'webhook_id', e.target.value)}
                    placeholder={SecretPlaceholder(config.payment_provider_configs.paypal.webhook_id_length)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">{t('actions.providerMode')}</label>
                  <select
                    value={config.payment_provider_configs.paypal.mode}
                    onChange={(e) => handlePaymentProviderField('paypal', 'mode', e.target.value)}
                    className="w-full rounded-md border border-gray-300 dark:border-border-primary bg-white dark:bg-background-secondary text-sm px-3 py-2"
                  >
                    <option value="sandbox">Sandbox</option>
                    <option value="live">Live</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Brand Name</label>
                  <Input value={config.payment_provider_configs.paypal.brand_name} onChange={(e) => handlePaymentProviderField('paypal', 'brand_name', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Currency</label>
                  <Input value={config.payment_provider_configs.paypal.currency} onChange={(e) => handlePaymentProviderField('paypal', 'currency', e.target.value.toUpperCase())} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                {['pro_monthly', 'team_monthly', 'enterprise_monthly'].map((planKey) => (
                  <div key={planKey}>
                    <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">PayPal Plan ID · {planKey}</label>
                    <Input
                      value={config.payment_provider_configs.paypal.plan_ids[planKey] || ''}
                      onChange={(e) => handleNestedPaymentProviderField('paypal', 'plan_ids', planKey, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border dark:border-border-primary rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-foreground-primary">XunhuPay</h3>
                  <ProviderToggle checked={config.enabled_payment_providers.includes('xunhupay')} onChange={() => togglePaymentProvider('xunhupay')} />
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">APP ID</label>
                    <Input value={config.payment_provider_configs.xunhupay.app_id} onChange={(e) => {
                      handlePaymentProviderField('xunhupay', 'app_id', e.target.value);
                      updateConfig({ xunhupay_app_id: e.target.value });
                    }} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">APP Secret</label>
                    <Input
                      type="password"
                      value={config.payment_provider_configs.xunhupay.app_secret}
                      onChange={(e) => {
                        handlePaymentProviderField('xunhupay', 'app_secret', e.target.value);
                        updateConfig({ xunhupay_app_secret: e.target.value });
                      }}
                      placeholder={SecretPlaceholder(config.payment_provider_configs.xunhupay.app_secret_length || config.xunhupay_app_secret_length)}
                    />
                  </div>
                </div>
              </div>

              <div className="border dark:border-border-primary rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-foreground-primary">Lemon Squeezy</h3>
                  <ProviderToggle checked={config.enabled_payment_providers.includes('lemon_squeezy')} onChange={() => togglePaymentProvider('lemon_squeezy')} />
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">API Key</label>
                    <Input
                      type="password"
                      value={config.payment_provider_configs.lemon_squeezy.api_key}
                      onChange={(e) => handlePaymentProviderField('lemon_squeezy', 'api_key', e.target.value)}
                      placeholder={SecretPlaceholder(config.payment_provider_configs.lemon_squeezy.api_key_length)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Store ID</label>
                    <Input value={config.payment_provider_configs.lemon_squeezy.store_id} onChange={(e) => handlePaymentProviderField('lemon_squeezy', 'store_id', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Webhook Secret</label>
                    <Input
                      type="password"
                      value={config.payment_provider_configs.lemon_squeezy.webhook_secret}
                      onChange={(e) => handlePaymentProviderField('lemon_squeezy', 'webhook_secret', e.target.value)}
                      placeholder={SecretPlaceholder(config.payment_provider_configs.lemon_squeezy.webhook_secret_length)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  {['starter', 'basic', 'standard', 'pro', 'enterprise'].map((variantKey) => (
                    <div key={variantKey}>
                      <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Variant · {variantKey}</label>
                      <Input
                        value={config.payment_provider_configs.lemon_squeezy.variant_ids[variantKey] || ''}
                        onChange={(e) => handleNestedPaymentProviderField('lemon_squeezy', 'variant_ids', variantKey, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 mb-6">
          <div className="flex items-center mb-4">
            <Database className="mr-2 text-cyan-500" size={20} />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground-primary">{t('sections.storage')}</h2>
              <p className="text-sm text-gray-500 dark:text-foreground-tertiary">{t('sections.storageDesc')}</p>
            </div>
          </div>

          <div className="mb-6 max-w-md">
            <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1">{t('actions.activeStorage')}</label>
            <select
              value={config.storage_backend}
              onChange={(e) => updateConfig({ storage_backend: e.target.value as SystemConfig['storage_backend'] })}
              className="w-full rounded-md border border-gray-300 dark:border-border-primary bg-white dark:bg-background-secondary text-sm px-3 py-2"
            >
              {STORAGE_BACKEND_OPTIONS.map((backend) => (
                <option key={backend.value} value={backend.value}>{backend.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-6">
            <div className="border dark:border-border-primary rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 dark:text-foreground-primary mb-4">Local Storage</h3>
              <div className="max-w-xl">
                <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Upload Folder</label>
                <Input value={config.storage_provider_configs.local.upload_folder || ''} onChange={(e) => handleStorageField('local', 'upload_folder', e.target.value)} placeholder="uploads/" />
              </div>
            </div>

            <div className="border dark:border-border-primary rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 dark:text-foreground-primary mb-4">Cloudflare R2</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Account ID</label>
                  <Input value={config.storage_provider_configs.r2.account_id} onChange={(e) => handleStorageField('r2', 'account_id', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Bucket</label>
                  <Input value={config.storage_provider_configs.r2.bucket} onChange={(e) => handleStorageField('r2', 'bucket', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Access Key ID</label>
                  <Input
                    type="password"
                    value={config.storage_provider_configs.r2.access_key_id}
                    onChange={(e) => handleStorageField('r2', 'access_key_id', e.target.value)}
                    placeholder={SecretPlaceholder(config.storage_provider_configs.r2.access_key_id_length)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Secret Access Key</label>
                  <Input
                    type="password"
                    value={config.storage_provider_configs.r2.secret_access_key}
                    onChange={(e) => handleStorageField('r2', 'secret_access_key', e.target.value)}
                    placeholder={SecretPlaceholder(config.storage_provider_configs.r2.secret_access_key_length)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Public Base URL</label>
                  <Input value={config.storage_provider_configs.r2.public_base_url} onChange={(e) => handleStorageField('r2', 'public_base_url', e.target.value)} placeholder="https://cdn.example.com" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Region</label>
                  <Input value={config.storage_provider_configs.r2.region} onChange={(e) => handleStorageField('r2', 'region', e.target.value)} placeholder="auto" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Endpoint URL</label>
                  <Input value={config.storage_provider_configs.r2.endpoint_url} onChange={(e) => handleStorageField('r2', 'endpoint_url', e.target.value)} placeholder="https://<account>.r2.cloudflarestorage.com" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">{t('actions.signedUrlTtl')}</label>
                  <Input type="number" value={config.storage_provider_configs.r2.signed_url_ttl} onChange={(e) => handleStorageField('r2', 'signed_url_ttl', parseInt(e.target.value, 10) || 0)} />
                </div>
              </div>
            </div>

            <div className="border dark:border-border-primary rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 dark:text-foreground-primary mb-4">Alibaba Cloud OSS</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Bucket</label>
                  <Input value={config.storage_provider_configs.oss.bucket} onChange={(e) => handleStorageField('oss', 'bucket', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Endpoint</label>
                  <Input value={config.storage_provider_configs.oss.endpoint} onChange={(e) => handleStorageField('oss', 'endpoint', e.target.value)} placeholder="oss-cn-hangzhou.aliyuncs.com" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Access Key ID</label>
                  <Input
                    type="password"
                    value={config.storage_provider_configs.oss.access_key_id}
                    onChange={(e) => handleStorageField('oss', 'access_key_id', e.target.value)}
                    placeholder={SecretPlaceholder(config.storage_provider_configs.oss.access_key_id_length)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Access Key Secret</label>
                  <Input
                    type="password"
                    value={config.storage_provider_configs.oss.access_key_secret}
                    onChange={(e) => handleStorageField('oss', 'access_key_secret', e.target.value)}
                    placeholder={SecretPlaceholder(config.storage_provider_configs.oss.access_key_secret_length)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Public Base URL</label>
                  <Input value={config.storage_provider_configs.oss.public_base_url} onChange={(e) => handleStorageField('oss', 'public_base_url', e.target.value)} placeholder="https://cdn.example.com" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">{t('actions.signedUrlTtl')}</label>
                  <Input type="number" value={config.storage_provider_configs.oss.signed_url_ttl} onChange={(e) => handleStorageField('oss', 'signed_url_ttl', parseInt(e.target.value, 10) || 0)} />
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 mb-6">
          <div className="flex items-center mb-4">
            <Package className="mr-2 text-orange-500" size={20} />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground-primary">{t('sections.features')}</h2>
              <p className="text-sm text-gray-500 dark:text-foreground-tertiary">{t('sections.featuresDesc')}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-foreground-secondary">{t('fields.enableCreditsPurchase')}</label>
              <ProviderToggle checked={config.enable_credits_purchase} onChange={() => handleBoolChange('enable_credits_purchase', !config.enable_credits_purchase)} />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-foreground-secondary">{t('fields.enableAlipay')}</label>
              <ProviderToggle checked={config.enable_alipay} onChange={() => handleBoolChange('enable_alipay', !config.enable_alipay)} />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-foreground-secondary">{t('fields.enableInvitation')}</label>
              <ProviderToggle checked={config.enable_invitation} onChange={() => handleBoolChange('enable_invitation', !config.enable_invitation)} />
            </div>
          </div>
        </Card>

        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Package className="mr-2 text-indigo-500" size={20} />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground-primary">{t('sections.packages')}</h2>
                <p className="text-sm text-gray-500 dark:text-foreground-tertiary">{t('sections.packagesDesc')}</p>
              </div>
            </div>
            {config.credit_packages && (
              <Button variant="secondary" size="sm" onClick={handleResetPackages}>
                {t('packageFields.resetToDefault')}
              </Button>
            )}
          </div>

          <div className="space-y-4">
            {(config.credit_packages || packages).map((pkg, index) => (
              <div key={pkg.id} className="border dark:border-border-primary rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-foreground-primary mb-3">{pkg.name} ({pkg.id})</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">{t('packageFields.credits')}</label>
                    <Input type="number" value={pkg.credits} onChange={(e) => handlePackageChange(index, 'credits', e.target.value)} min={0} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">{t('packageFields.bonusCredits')}</label>
                    <Input type="number" value={pkg.bonus_credits} onChange={(e) => handlePackageChange(index, 'bonus_credits', e.target.value)} min={0} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">{t('packageFields.priceCny')}</label>
                    <Input type="number" value={pkg.price_cny} onChange={(e) => handlePackageChange(index, 'price_cny', e.target.value)} min={0} step="0.01" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">{t('packageFields.priceUsd')}</label>
                    <Input type="number" value={pkg.price_usd} onChange={(e) => handlePackageChange(index, 'price_usd', e.target.value)} min={0} step="0.01" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Image className="mr-2 text-teal-500" size={20} />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground-primary">{t('sections.imagePool')}</h2>
                <p className="text-sm text-gray-500 dark:text-foreground-tertiary">{t('sections.imagePoolDesc')}</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" icon={<Plus size={16} />} onClick={handleAddChannel}>
              {t('channelFields.addChannel')}
            </Button>
          </div>

          <div className="space-y-4" data-testid="image-pool-section">
            {(config.image_provider_pool || []).map((ch, index) => (
              <div key={ch.id} className="border dark:border-border-primary rounded-lg p-4 relative">
                <button
                  onClick={() => handleRemoveChannel(index)}
                  className="absolute top-3 right-3 text-red-400 hover:text-red-600"
                  aria-label="Remove channel"
                  type="button"
                >
                  <Trash2 size={16} />
                </button>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">{t('channelFields.name')}</label>
                    <Input value={ch.name} onChange={(e) => handleChannelChange(index, 'name', e.target.value)} placeholder="e.g. Gemini Primary" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">{t('channelFields.providerFormat')}</label>
                    <select
                      value={ch.provider_format}
                      onChange={(e) => handleChannelChange(index, 'provider_format', e.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-border-primary bg-white dark:bg-background-secondary text-sm px-3 py-2"
                    >
                      <option value="gemini">Gemini</option>
                      <option value="openai">OpenAI</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">{t('channelFields.model')}</label>
                    <Input value={ch.model} onChange={(e) => handleChannelChange(index, 'model', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">{t('channelFields.apiKey')}</label>
                    <Input type="password" value={ch.api_key} onChange={(e) => handleChannelChange(index, 'api_key', e.target.value)} placeholder={ch.api_key_length ? `(${ch.api_key_length} chars set)` : ''} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">{t('channelFields.apiBase')}</label>
                    <Input value={ch.api_base} onChange={(e) => handleChannelChange(index, 'api_base', e.target.value)} placeholder="https://..." />
                  </div>
                  <div className="flex items-end gap-4">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">{t('channelFields.priority')}</label>
                      <Input type="number" value={ch.priority} onChange={(e) => handleChannelChange(index, 'priority', parseInt(e.target.value, 10) || 0)} min={1} />
                    </div>
                    <ProviderToggle checked={ch.enabled} onChange={() => handleChannelChange(index, 'enabled', !ch.enabled)} />
                  </div>
                </div>
              </div>
            ))}
            {(!config.image_provider_pool || config.image_provider_pool.length === 0) && (
              <p className="text-sm text-gray-400 dark:text-foreground-tertiary text-center py-4">{t('sections.imagePoolDesc')}</p>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
};
