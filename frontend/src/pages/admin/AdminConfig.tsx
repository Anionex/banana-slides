import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Save, Settings, CreditCard, Users, Shield, Package } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { Button, Card, Input, Loading, useToast } from '@/components/shared';
import * as api from '@/api/endpoints';
import { paymentApi, CreditPackage } from '@/api/payment';

const adminConfigI18n = {
  zh: {
    title: '系统配置',
    subtitle: '管理系统级配置，包括用户策略、积分定价等',
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
      features: '功能开关',
      featuresDesc: '启用或禁用特定功能',
      packages: '积分套餐',
      packagesDesc: '配置各套餐的积分数量和价格',
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
      costGenerateImage: '生成图片（每页）',
      costEditImage: '编辑图片',
      costGenerateMaterial: '生成素材',
      costRefineOutline: '修改大纲',
      costRefineDescription: '修改描述（每页）',
      costParseFile: '解析参考文件',
      costExportEditable: '导出可编辑PPTX（每页）',
      enableCreditsPurchase: '允许用户购买积分',
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
    subtitle: 'Manage system-wide settings including user policies and credit pricing',
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
      features: 'Feature Toggles',
      featuresDesc: 'Enable or disable specific features',
      packages: 'Credit Packages',
      packagesDesc: 'Configure credits and pricing for each package',
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
      invitationBonus: 'Invitation Bonus Credits (each party)',
      maxInvitationCodes: 'Max Invitation Codes per User',
      costGenerateOutline: 'Generate Outline',
      costGenerateDescription: 'Generate Description (per page)',
      costGenerateImage: 'Generate Image (per page)',
      costEditImage: 'Edit Image',
      costGenerateMaterial: 'Generate Material',
      costRefineOutline: 'Refine Outline',
      costRefineDescription: 'Refine Description (per page)',
      costParseFile: 'Parse Reference File',
      costExportEditable: 'Export Editable PPTX (per page)',
      enableCreditsPurchase: 'Enable Credit Purchase',
      enableInvitation: 'Enable Invitation Feature',
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

interface SystemConfig {
  user_editable_fields: string[];
  registration_bonus: number;
  invitation_bonus: number;
  max_invitation_codes: number;
  cost_generate_outline: number;
  cost_generate_description: number;
  cost_generate_image: number;
  cost_edit_image: number;
  cost_generate_material: number;
  cost_refine_outline: number;
  cost_refine_description: number;
  cost_parse_file: number;
  cost_export_editable: number;
  enable_credits_purchase: boolean;
  enable_invitation: boolean;
  credit_packages: PackageConfig[] | null;
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

export const AdminConfig: React.FC = () => {
  const t = useT(adminConfigI18n);
  const { show, ToastContainer } = useToast();

  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const [res, pkgs] = await Promise.all([
        api.getSystemConfig(),
        paymentApi.getPackages(),
      ]);
      if (res.data) setConfig(res.data);
      setPackages(pkgs);
    } catch (error: any) {
      show({ message: error?.message || 'Failed to load config', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setIsSaving(true);
    try {
      await api.updateSystemConfig(config);
      show({ message: t('saveSuccess'), type: 'success' });
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
    setConfig({ ...config, user_editable_fields: Array.from(fields) });
  };

  const handleNumberChange = (key: keyof SystemConfig, value: string) => {
    if (!config) return;
    const numValue = parseInt(value) || 0;
    setConfig({ ...config, [key]: numValue });
  };

  const handleBoolChange = (key: keyof SystemConfig, value: boolean) => {
    if (!config) return;
    setConfig({ ...config, [key]: value });
  };

  const handlePackageChange = (index: number, field: string, value: string) => {
    if (!config) return;
    const pkgs = (config.credit_packages || packages.map(({ id, name, credits, bonus_credits, price_cny, price_usd, description }) =>
      ({ id, name, credits, bonus_credits, price_cny, price_usd, description })
    ));
    const updated = [...pkgs];
    updated[index] = { ...updated[index], [field]: field === 'credits' || field === 'bonus_credits' ? (parseInt(value) || 0) : (parseFloat(value) || 0) };
    setConfig({ ...config, credit_packages: updated });
  };

  const handleResetPackages = () => {
    if (!config) return;
    setConfig({ ...config, credit_packages: null });
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

  // Group fields by category
  const fieldsByCategory = ALL_SETTINGS_FIELDS.reduce((acc, field) => {
    if (!acc[field.category]) acc[field.category] = [];
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, FieldInfo[]>);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background-primary">
      <ToastContainer />

      {/* Header Nav */}
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

      <main className="max-w-4xl mx-auto px-6 py-8">
          {/* User Policy Section */}
          <Card className="p-6 mb-6">
            <div className="flex items-center mb-4">
              <Shield className="mr-2 text-blue-500" size={20} />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground-primary">
                  {t('sections.userPolicy')}
                </h2>
                <p className="text-sm text-gray-500 dark:text-foreground-tertiary">
                  {t('sections.userPolicyDesc')}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {Object.entries(fieldsByCategory).map(([category, fields]) => (
                <div key={category} className="border-b dark:border-border-primary pb-4 last:border-0">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">
                    {t(`fieldCategories.${category}` as any) || category}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {fields.map(field => {
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
                          title={field.sensitive ? '敏感字段' : ''}
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

          {/* Bonus Config Section */}
          <Card className="p-6 mb-6">
            <div className="flex items-center mb-4">
              <Users className="mr-2 text-green-500" size={20} />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground-primary">
                  {t('sections.bonusConfig')}
                </h2>
                <p className="text-sm text-gray-500 dark:text-foreground-tertiary">
                  {t('sections.bonusConfigDesc')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1">
                  {t('fields.registrationBonus')}
                </label>
                <Input
                  type="number"
                  value={config.registration_bonus}
                  onChange={e => handleNumberChange('registration_bonus', e.target.value)}
                  min={0}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1">
                  {t('fields.invitationBonus')}
                </label>
                <Input
                  type="number"
                  value={config.invitation_bonus}
                  onChange={e => handleNumberChange('invitation_bonus', e.target.value)}
                  min={0}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1">
                  {t('fields.maxInvitationCodes')}
                </label>
                <Input
                  type="number"
                  value={config.max_invitation_codes}
                  onChange={e => handleNumberChange('max_invitation_codes', e.target.value)}
                  min={0}
                  max={100}
                />
              </div>
            </div>
          </Card>

          {/* Credit Pricing Section */}
          <Card className="p-6 mb-6">
            <div className="flex items-center mb-4">
              <CreditCard className="mr-2 text-purple-500" size={20} />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground-primary">
                  {t('sections.creditPricing')}
                </h2>
                <p className="text-sm text-gray-500 dark:text-foreground-tertiary">
                  {t('sections.creditPricingDesc')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { key: 'cost_generate_outline', label: t('fields.costGenerateOutline') },
                { key: 'cost_generate_description', label: t('fields.costGenerateDescription') },
                { key: 'cost_generate_image', label: t('fields.costGenerateImage') },
                { key: 'cost_edit_image', label: t('fields.costEditImage') },
                { key: 'cost_generate_material', label: t('fields.costGenerateMaterial') },
                { key: 'cost_refine_outline', label: t('fields.costRefineOutline') },
                { key: 'cost_refine_description', label: t('fields.costRefineDescription') },
                { key: 'cost_parse_file', label: t('fields.costParseFile') },
                { key: 'cost_export_editable', label: t('fields.costExportEditable') },
              ].map(item => (
                <div key={item.key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1">
                    {item.label}
                  </label>
                  <Input
                    type="number"
                    value={(config as any)[item.key]}
                    onChange={e => handleNumberChange(item.key as keyof SystemConfig, e.target.value)}
                    min={0}
                  />
                </div>
              ))}
            </div>
          </Card>

          {/* Feature Toggles Section */}
          <Card className="p-6 mb-6">
            <div className="flex items-center mb-4">
              <Package className="mr-2 text-orange-500" size={20} />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground-primary">
                  {t('sections.features')}
                </h2>
                <p className="text-sm text-gray-500 dark:text-foreground-tertiary">
                  {t('sections.featuresDesc')}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-foreground-secondary">
                  {t('fields.enableCreditsPurchase')}
                </label>
                <button
                  onClick={() => handleBoolChange('enable_credits_purchase', !config.enable_credits_purchase)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    config.enable_credits_purchase ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.enable_credits_purchase ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-foreground-secondary">
                  {t('fields.enableInvitation')}
                </label>
                <button
                  onClick={() => handleBoolChange('enable_invitation', !config.enable_invitation)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    config.enable_invitation ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.enable_invitation ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </Card>

          {/* Credit Packages Section */}
          <Card className="p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Package className="mr-2 text-indigo-500" size={20} />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground-primary">
                    {t('sections.packages')}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-foreground-tertiary">
                    {t('sections.packagesDesc')}
                  </p>
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
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-foreground-primary mb-3">
                    {pkg.name} ({pkg.id})
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">
                        {t('packageFields.credits')}
                      </label>
                      <Input
                        type="number"
                        value={pkg.credits}
                        onChange={e => handlePackageChange(index, 'credits', e.target.value)}
                        min={0}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">
                        {t('packageFields.bonusCredits')}
                      </label>
                      <Input
                        type="number"
                        value={pkg.bonus_credits}
                        onChange={e => handlePackageChange(index, 'bonus_credits', e.target.value)}
                        min={0}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">
                        {t('packageFields.priceCny')}
                      </label>
                      <Input
                        type="number"
                        value={pkg.price_cny}
                        onChange={e => handlePackageChange(index, 'price_cny', e.target.value)}
                        min={0}
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">
                        {t('packageFields.priceUsd')}
                      </label>
                      <Input
                        type="number"
                        value={pkg.price_usd}
                        onChange={e => handlePackageChange(index, 'price_usd', e.target.value)}
                        min={0}
                        step="0.01"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
      </main>
    </div>
  );
};
