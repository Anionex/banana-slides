import React from 'react';
import { CreditCard } from 'lucide-react';
import { Card, Input, Loading } from '@/components/shared';
import {
  useAdminConfig,
  ConfigPageHeader,
  ProviderToggle,
  SecretPlaceholder,
  PAYMENT_PROVIDER_OPTIONS,
} from './adminConfigShared';

const paymentI18n = {
  zh: { title: '支付配置', subtitle: '支付渠道管理' },
  en: { title: 'Payment', subtitle: 'Payment provider configuration' },
};

const AdminConfigPayment: React.FC = () => {
  const {
    config, isLoading, isSaving,
    t, ToastContainer,
    updateConfig, handleSave,
    togglePaymentProvider, handlePaymentProviderField, handleNestedPaymentProviderField,
  } = useAdminConfig();

  const lang = (document.documentElement.lang || 'zh').startsWith('en') ? 'en' : 'zh';

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background-primary"><Loading /></div>;
  }

  if (!config) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background-primary"><p className="text-red-500">Failed to load configuration</p></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background-primary">
      <ToastContainer />
      <ConfigPageHeader
        title={paymentI18n[lang].title}
        subtitle={paymentI18n[lang].subtitle}
        icon={<CreditCard size={20} className="text-emerald-500" />}
        onSave={handleSave}
        isSaving={isSaving}
        saveLabel={t('save')}
        savingLabel={t('saving')}
      />

      <main className="max-w-5xl mx-auto px-6 py-8">
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
            {/* Stripe */}
            <div className="border dark:border-border-primary rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-foreground-primary">Stripe</h3>
                <ProviderToggle checked={config.enabled_payment_providers.includes('stripe')} onChange={() => togglePaymentProvider('stripe')} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Secret Key</label>
                  <Input type="password" value={config.payment_provider_configs.stripe.secret_key} onChange={(e) => handlePaymentProviderField('stripe', 'secret_key', e.target.value)} placeholder={SecretPlaceholder(config.payment_provider_configs.stripe.secret_key_length)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Webhook Secret</label>
                  <Input type="password" value={config.payment_provider_configs.stripe.webhook_secret} onChange={(e) => handlePaymentProviderField('stripe', 'webhook_secret', e.target.value)} placeholder={SecretPlaceholder(config.payment_provider_configs.stripe.webhook_secret_length)} />
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
                    <Input value={config.payment_provider_configs.stripe.price_ids[priceKey] || ''} onChange={(e) => handleNestedPaymentProviderField('stripe', 'price_ids', priceKey, e.target.value)} />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                {['pro_monthly', 'team_monthly', 'enterprise_monthly'].map((planKey) => (
                  <div key={planKey}>
                    <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Subscription Price · {planKey}</label>
                    <Input value={config.payment_provider_configs.stripe.subscription_price_ids[planKey] || ''} onChange={(e) => handleNestedPaymentProviderField('stripe', 'subscription_price_ids', planKey, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>

            {/* PayPal */}
            <div className="border dark:border-border-primary rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-foreground-primary">PayPal</h3>
                <ProviderToggle checked={config.enabled_payment_providers.includes('paypal')} onChange={() => togglePaymentProvider('paypal')} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Client ID</label>
                  <Input type="password" value={config.payment_provider_configs.paypal.client_id} onChange={(e) => handlePaymentProviderField('paypal', 'client_id', e.target.value)} placeholder={SecretPlaceholder(config.payment_provider_configs.paypal.client_id_length)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Client Secret</label>
                  <Input type="password" value={config.payment_provider_configs.paypal.client_secret} onChange={(e) => handlePaymentProviderField('paypal', 'client_secret', e.target.value)} placeholder={SecretPlaceholder(config.payment_provider_configs.paypal.client_secret_length)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Webhook ID</label>
                  <Input type="password" value={config.payment_provider_configs.paypal.webhook_id} onChange={(e) => handlePaymentProviderField('paypal', 'webhook_id', e.target.value)} placeholder={SecretPlaceholder(config.payment_provider_configs.paypal.webhook_id_length)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">{t('actions.providerMode')}</label>
                  <select value={config.payment_provider_configs.paypal.mode} onChange={(e) => handlePaymentProviderField('paypal', 'mode', e.target.value)} className="w-full rounded-md border border-gray-300 dark:border-border-primary bg-white dark:bg-background-secondary text-sm px-3 py-2">
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
                    <Input value={config.payment_provider_configs.paypal.plan_ids[planKey] || ''} onChange={(e) => handleNestedPaymentProviderField('paypal', 'plan_ids', planKey, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>

            {/* XunhuPay + Lemon Squeezy */}
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
                      placeholder={SecretPlaceholder(config.payment_provider_configs.xunhupay.app_secret_length || (config as any).xunhupay_app_secret_length)}
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
                    <Input type="password" value={config.payment_provider_configs.lemon_squeezy.api_key} onChange={(e) => handlePaymentProviderField('lemon_squeezy', 'api_key', e.target.value)} placeholder={SecretPlaceholder(config.payment_provider_configs.lemon_squeezy.api_key_length)} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Store ID</label>
                    <Input value={config.payment_provider_configs.lemon_squeezy.store_id} onChange={(e) => handlePaymentProviderField('lemon_squeezy', 'store_id', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Webhook Secret</label>
                    <Input type="password" value={config.payment_provider_configs.lemon_squeezy.webhook_secret} onChange={(e) => handlePaymentProviderField('lemon_squeezy', 'webhook_secret', e.target.value)} placeholder={SecretPlaceholder(config.payment_provider_configs.lemon_squeezy.webhook_secret_length)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  {['starter', 'basic', 'standard', 'pro', 'enterprise'].map((variantKey) => (
                    <div key={variantKey}>
                      <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Variant · {variantKey}</label>
                      <Input value={config.payment_provider_configs.lemon_squeezy.variant_ids[variantKey] || ''} onChange={(e) => handleNestedPaymentProviderField('lemon_squeezy', 'variant_ids', variantKey, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default AdminConfigPayment;
