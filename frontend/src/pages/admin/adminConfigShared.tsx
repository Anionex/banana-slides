import React, { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { Button, useToast } from '@/components/shared';
import * as api from '@/api/endpoints';
import { paymentApi, CreditPackage } from '@/api/payment';

export const adminConfigI18n = {
  zh: {
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

export interface PackageConfig {
  id: string;
  name: string;
  credits: number;
  price_cny: number;
  price_usd: number;
  description: string;
  bonus_credits: number;
}

export interface ProviderChannel {
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

interface WechatPayConfig {
  mch_id: string;
  app_id: string;
  api_v3_key: string;
  api_v3_key_length?: number;
  private_key: string;
  private_key_length?: number;
  cert_serial_no: string;
  wxpay_public_key_id: string;
  wxpay_public_key: string;
  wxpay_public_key_length?: number;
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

export interface SystemConfig {
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
    wechatpay: WechatPayConfig;
  };
  storage_backend: 'local' | 'r2' | 'oss';
  storage_provider_configs: {
    local: LocalStorageConfig;
    r2: R2StorageConfig;
    oss: OSSStorageConfig;
  };
}

export interface FieldInfo {
  key: string;
  label: string;
  category: string;
  sensitive?: boolean;
}

export const ALL_SETTINGS_FIELDS: FieldInfo[] = [
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
    wechatpay: {
      mch_id: '',
      app_id: '',
      api_v3_key: '',
      private_key: '',
      cert_serial_no: '',
      wxpay_public_key_id: '',
      wxpay_public_key: '',
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

export const PAYMENT_PROVIDER_OPTIONS = [
  { value: 'stripe', label: 'Stripe' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'xunhupay', label: 'XunhuPay' },
  { value: 'lemon_squeezy', label: 'Lemon Squeezy' },
  { value: 'wechatpay', label: 'WeChat Pay (微信支付)' },
] as const;

export const STORAGE_BACKEND_OPTIONS = [
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

export const ProviderToggle: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
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

export const SecretPlaceholder = (length?: number, fallback = '') => (length ? `(${length} chars set)` : fallback);

export const ConfigPageHeader: React.FC<{
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onSave: () => void;
  isSaving: boolean;
  saveLabel: string;
  savingLabel: string;
}> = ({ title, subtitle, icon, onSave, isSaving, saveLabel, savingLabel }) => (
  <header className="bg-white dark:bg-background-secondary border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
    <div className="flex items-center gap-3">
      {icon}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-foreground-primary">{title}</h1>
        <p className="text-sm text-gray-500 dark:text-foreground-tertiary">{subtitle}</p>
      </div>
    </div>
    <Button
      variant="primary"
      icon={<Save size={18} />}
      onClick={onSave}
      loading={isSaving}
    >
      {isSaving ? savingLabel : saveLabel}
    </Button>
  </header>
);

export function useAdminConfig() {
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
      id, name, credits, bonus_credits, price_cny, price_usd, description,
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

  return {
    config, packages, isLoading, isSaving,
    t, ToastContainer,
    updateConfig, handleSave,
    handleNumberChange, handleBoolChange,
    handleFieldToggle, fieldsByCategory,
    handlePackageChange, handleResetPackages,
    handleAddChannel, handleRemoveChannel, handleChannelChange,
    togglePaymentProvider, handlePaymentProviderField, handleNestedPaymentProviderField,
    handleStorageField,
  };
}
