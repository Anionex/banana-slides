/**
 * Pricing Page - multi-provider subscriptions + credit packs
 * 海外 SaaS 定价页
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Check,
  Coins,
  Crown,
  ExternalLink,
  Loader2,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Button, Card, useToast } from '@/components/shared';
import { useCreditsBalance, useUser } from '@/store/useAuthStore';
import {
  paymentApi,
  CreditCosts,
  CreditPackage,
  PaymentProviderDescriptor,
  PlanCatalog,
  PackageCatalog,
  SubscriptionPlan,
} from '@/api/payment';
import { refreshCredits } from '@/api/auth';

const pricingI18n = {
  zh: {
    title: '选择适合你的套餐',
    subtitle: '支持 Stripe / PayPal 双支付栈：订阅解锁每月积分，按需加购补足峰值用量。',
    currentBalance: '当前余额',
    currentPlan: '当前方案',
    freePlan: '免费版',
    plansTitle: '订阅方案',
    plansSubtitle: '稳定创作频率时，优先使用月订阅。',
    creditsTitle: '一次性积分包',
    creditsSubtitle: '适合临时冲刺、团队高峰或导出前补充额度。',
    usageGuide: '积分消耗说明',
    mostPopular: '最受欢迎',
    activePlan: '当前订阅',
    subscribe: '立即订阅',
    buyCredits: '购买积分',
    manageBilling: '管理订阅',
    redirecting: '正在跳转到支付页面...',
    loadingPricing: '加载定价中...',
    paymentError: '创建支付会话失败',
    billingError: '打开账单中心失败',
    canceled: '您已取消本次支付',
    oneTime: '一次性',
    monthlyCredits: '每月赠送积分',
    bonusCredits: '赠送积分',
    totalCredits: '到账积分',
    back: '返回',
    billedMonthly: '按月计费',
    success: '支付成功，积分已同步刷新',
    subscriptionSuccess: '订阅已创建，账单和积分状态已刷新',
    paymentMethod: '支付渠道',
    noProviderForPlan: '当前支付渠道下暂无可用套餐',
    providerUnavailable: '所选支付渠道暂不可用',
    usageItems: {
      outline: '生成大纲',
      description: '生成描述（每页）',
      image: '生成图片（每页）',
      refineOutline: '修改大纲',
      refineDescription: '修改描述',
      parseFile: '解析参考文件',
      exportEditable: '导出可编辑 PPT',
    },
  },
  en: {
    title: 'Choose the plan that fits your workflow',
    subtitle: 'Use Stripe or PayPal for subscriptions and top up with one-time credit packs during launch weeks or export spikes.',
    currentBalance: 'Current balance',
    currentPlan: 'Current plan',
    freePlan: 'Free',
    plansTitle: 'Subscription plans',
    plansSubtitle: 'Best for a predictable monthly workflow.',
    creditsTitle: 'One-time credit packs',
    creditsSubtitle: 'Perfect for launch sprints, team peaks, and extra export volume.',
    usageGuide: 'Credit usage guide',
    mostPopular: 'Most popular',
    activePlan: 'Active plan',
    subscribe: 'Subscribe',
    buyCredits: 'Buy credits',
    manageBilling: 'Manage billing',
    redirecting: 'Redirecting to checkout...',
    loadingPricing: 'Loading pricing...',
    paymentError: 'Failed to create checkout session',
    billingError: 'Failed to open billing portal',
    canceled: 'Payment was canceled',
    oneTime: 'One-time',
    monthlyCredits: 'Monthly credits',
    bonusCredits: 'Bonus credits',
    totalCredits: 'Credits received',
    back: 'Back',
    billedMonthly: 'Billed monthly',
    success: 'Payment succeeded and credits were refreshed',
    subscriptionSuccess: 'Subscription created and billing state refreshed',
    paymentMethod: 'Payment provider',
    noProviderForPlan: 'No products are available for the selected provider yet',
    providerUnavailable: 'The selected payment provider is not available',
    usageItems: {
      outline: 'Generate outline',
      description: 'Generate description (per page)',
      image: 'Generate image (per page)',
      refineOutline: 'Refine outline',
      refineDescription: 'Refine description',
      parseFile: 'Parse reference file',
      exportEditable: 'Export editable PPT',
    },
  },
};

const DEFAULT_CREDIT_COSTS: CreditCosts = {
  generate_outline: 5,
  generate_description: 1,
  generate_image: 8,
  edit_image: 8,
  generate_material: 10,
  refine_outline: 2,
  refine_description: 1,
  parse_file: 5,
  export_editable: 15,
};

const packageIcons: Record<string, React.ReactNode> = {
  starter: <Coins className="w-7 h-7" />,
  basic: <Zap className="w-7 h-7" />,
  standard: <Sparkles className="w-7 h-7" />,
  pro: <Crown className="w-7 h-7" />,
  enterprise: <Building2 className="w-7 h-7" />,
};

const planIcons: Record<string, React.ReactNode> = {
  pro_monthly: <Sparkles className="w-7 h-7" />,
  team_monthly: <Building2 className="w-7 h-7" />,
  enterprise_monthly: <Crown className="w-7 h-7" />,
};

function ProviderPills({
  providers,
  selected,
  onSelect,
}: {
  providers: PaymentProviderDescriptor[];
  selected: string | null;
  onSelect: (name: string) => void;
}) {
  if (providers.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-4 justify-center">
      {providers.map((provider) => {
        const active = provider.name === selected;
        return (
          <button
            key={provider.name}
            onClick={() => onSelect(provider.name)}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors border ${
              active
                ? 'bg-banana text-white border-banana'
                : 'bg-white dark:bg-background-secondary text-gray-600 dark:text-foreground-secondary border-gray-200 dark:border-border-primary hover:border-banana/50'
            }`}
            type="button"
          >
            {provider.label}
          </button>
        );
      })}
    </div>
  );
}

export const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { show, ToastContainer } = useToast();
  const creditsBalance = useCreditsBalance();
  const user = useUser();

  const [packageCatalog, setPackageCatalog] = useState<PackageCatalog | null>(null);
  const [planCatalog, setPlanCatalog] = useState<PlanCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchasingPackage, setPurchasingPackage] = useState<string | null>(null);
  const [purchasingPlan, setPurchasingPlan] = useState<string | null>(null);
  const [openingBilling, setOpeningBilling] = useState(false);
  const [creditCosts, setCreditCosts] = useState<CreditCosts>(DEFAULT_CREDIT_COSTS);
  const [selectedPackageProvider, setSelectedPackageProvider] = useState<string | null>(null);
  const [selectedSubscriptionProvider, setSelectedSubscriptionProvider] = useState<string | null>(null);

  const t = (key: string, vars?: Record<string, any>) => {
    const lang = i18n.language?.startsWith('zh') ? 'zh' : 'en';
    const keys = key.split('.');
    let value: any = pricingI18n[lang];
    for (const k of keys) {
      value = value?.[k];
    }
    if (typeof value === 'string' && vars) {
      return value.replace(/\{(\w+)\}/g, (_, token) => String(vars[token] ?? ''));
    }
    return value || key;
  };

  const currentPlanSlug = user?.subscription_plan || 'free';

  const packageProviders = useMemo(
    () => (packageCatalog?.enabled_providers || []).filter((provider) => provider.supports_one_time),
    [packageCatalog],
  );

  const subscriptionProviders = useMemo(
    () => (planCatalog?.enabled_providers || []).filter((provider) => provider.supports_subscription),
    [planCatalog],
  );

  const availablePackages = useMemo(
    () => (packageCatalog?.packages || []).filter((pkg) => !selectedPackageProvider || (pkg.supported_providers || []).includes(selectedPackageProvider)),
    [packageCatalog, selectedPackageProvider],
  );

  const availablePlans = useMemo(
    () => (planCatalog?.plans || []).filter((plan) => !selectedSubscriptionProvider || (plan.supported_providers || []).includes(selectedSubscriptionProvider)),
    [planCatalog, selectedSubscriptionProvider],
  );

  const billingPortalProvider = useMemo(() => {
    const candidates = planCatalog?.enabled_providers || [];
    const preferred = user?.billing_provider || selectedSubscriptionProvider;
    const match = candidates.find((provider) => provider.name === preferred && provider.supports_billing_portal);
    if (match) return match;
    return candidates.find((provider) => provider.supports_billing_portal) || null;
  }, [planCatalog, selectedSubscriptionProvider, user?.billing_provider]);

  const usageCostItems = useMemo(() => [
    { key: 'outline', cost: creditCosts.generate_outline },
    { key: 'description', cost: creditCosts.generate_description },
    { key: 'image', cost: creditCosts.generate_image },
    { key: 'refineOutline', cost: creditCosts.refine_outline },
    { key: 'refineDescription', cost: creditCosts.refine_description },
    { key: 'parseFile', cost: creditCosts.parse_file },
    { key: 'exportEditable', cost: creditCosts.export_editable },
  ], [creditCosts]);

  useEffect(() => {
    const loadPricing = async () => {
      setLoading(true);
      setError(null);
      try {
        const [packagesData, plansData, costs] = await Promise.all([
          paymentApi.getPackages(),
          paymentApi.getPlans(),
          paymentApi.getCreditCosts().catch(() => DEFAULT_CREDIT_COSTS),
        ]);
        setPackageCatalog(packagesData);
        setPlanCatalog(plansData);
        setCreditCosts(costs);

        const defaultPackageProvider = packagesData.enabled_providers.find((provider) => provider.name === packagesData.default_provider && provider.supports_one_time)
          || packagesData.enabled_providers.find((provider) => provider.supports_one_time)
          || null;
        const defaultSubscriptionProvider = plansData.enabled_providers.find((provider) => provider.name === plansData.default_provider && provider.supports_subscription)
          || plansData.enabled_providers.find((provider) => provider.supports_subscription)
          || null;
        setSelectedPackageProvider(defaultPackageProvider?.name || null);
        setSelectedSubscriptionProvider(defaultSubscriptionProvider?.name || null);
      } catch (err: any) {
        setError(err?.message || t('loadingPricing'));
      } finally {
        setLoading(false);
      }
    };

    loadPricing();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const syncAfterPayment = async (message: string) => {
      await refreshCredits();
      show({ message, type: 'success' });
      window.history.replaceState({}, '', '/pricing');
    };

    if (params.get('success') === 'true') {
      void syncAfterPayment(t('success'));
      return;
    }

    if (params.get('subscription') === 'success') {
      void syncAfterPayment(t('subscriptionSuccess'));
      return;
    }

    if (params.get('canceled') === 'true' || params.get('subscription') === 'canceled') {
      show({ message: t('canceled'), type: 'warning' });
      window.history.replaceState({}, '', '/pricing');
    }
  }, [show]);

  const handlePackageCheckout = async (pkg: CreditPackage) => {
    if (!selectedPackageProvider) {
      show({ message: t('providerUnavailable'), type: 'error' });
      return;
    }
    setPurchasingPackage(pkg.id);
    try {
      const result = await paymentApi.createOrder(pkg.id, { provider: selectedPackageProvider });
      if (!result.success || !result.payment_url) {
        throw new Error(result.error_message || t('paymentError'));
      }
      show({ message: t('redirecting'), type: 'info' });
      window.location.href = result.payment_url;
    } catch (err: any) {
      show({ message: err?.message || t('paymentError'), type: 'error' });
    } finally {
      setPurchasingPackage(null);
    }
  };

  const handleSubscriptionCheckout = async (plan: SubscriptionPlan) => {
    if (!selectedSubscriptionProvider) {
      show({ message: t('providerUnavailable'), type: 'error' });
      return;
    }
    setPurchasingPlan(plan.id);
    try {
      const result = await paymentApi.createSubscription(plan.id, selectedSubscriptionProvider);
      if (!result.success || !result.payment_url) {
        throw new Error(result.error_message || t('paymentError'));
      }
      show({ message: t('redirecting'), type: 'info' });
      window.location.href = result.payment_url;
    } catch (err: any) {
      show({ message: err?.message || t('paymentError'), type: 'error' });
    } finally {
      setPurchasingPlan(null);
    }
  };

  const handleOpenBillingPortal = async () => {
    if (!billingPortalProvider) {
      show({ message: t('billingError'), type: 'error' });
      return;
    }
    setOpeningBilling(true);
    try {
      const { url } = await paymentApi.createBillingPortal(`${window.location.origin}/settings`, billingPortalProvider.name);
      window.location.href = url;
    } catch (err: any) {
      show({ message: err?.message || t('billingError'), type: 'error' });
    } finally {
      setOpeningBilling(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50/30 to-pink-50/50 dark:from-background-primary dark:via-background-primary dark:to-background-primary">
      <ToastContainer />

      <nav className="sticky top-0 z-50 h-16 bg-white/80 dark:bg-background-primary backdrop-blur-xl border-b border-gray-200/50 dark:border-border-primary">
        <div className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between">
          <button
            onClick={() => navigate('/app')}
            className="flex items-center gap-2 text-gray-600 dark:text-foreground-secondary hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            <span>{t('back')}</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 rounded-full">
              <Coins size={18} className="text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                {t('currentBalance')}: {creditsBalance}
              </span>
            </div>
            {billingPortalProvider && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleOpenBillingPortal}
                disabled={openingBilling}
                loading={openingBilling}
                className="hidden sm:inline-flex"
              >
                {t('manageBilling')}
              </Button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 dark:bg-background-elevated border border-gray-200 dark:border-border-primary text-sm text-gray-600 dark:text-foreground-secondary mb-6">
            <span>{t('currentPlan')}:</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {currentPlanSlug === 'free' ? t('freePlan') : currentPlanSlug}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            {t('title')}
          </h1>
          <p className="text-lg text-gray-600 dark:text-foreground-secondary max-w-3xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-banana" />
            <p className="text-gray-600 dark:text-foreground-secondary">{t('loadingPricing')}</p>
          </div>
        )}

        {!loading && error && (
          <Card className="p-6 mb-8 border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/60">
            <div className="flex items-start gap-3 text-red-700 dark:text-red-300">
              <AlertCircle className="w-5 h-5 mt-0.5" />
              <div>
                <p className="font-medium">{error}</p>
              </div>
            </div>
          </Card>
        )}

        {!loading && !error && (
          <div className="space-y-12">
            <section>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('plansTitle')}</h2>
                <p className="mt-2 text-gray-600 dark:text-foreground-secondary">{t('plansSubtitle')}</p>
                <p className="mt-4 text-sm text-gray-500 dark:text-foreground-tertiary">{t('paymentMethod')}</p>
                <ProviderPills
                  providers={subscriptionProviders}
                  selected={selectedSubscriptionProvider}
                  onSelect={setSelectedSubscriptionProvider}
                />
              </div>

              {availablePlans.length === 0 ? (
                <Card className="p-8 text-center text-gray-500 dark:text-foreground-tertiary">
                  {t('noProviderForPlan')}
                </Card>
              ) : (
                <div className="grid md:grid-cols-3 gap-6">
                  {availablePlans.map((plan) => {
                    const isActivePlan = currentPlanSlug === plan.id.replace('_monthly', '');
                    const isPopular = plan.id === 'pro_monthly';
                    return (
                      <Card
                        key={plan.id}
                        className={`relative p-6 border-2 transition-all ${
                          isPopular
                            ? 'border-banana shadow-lg shadow-banana/10'
                            : 'border-gray-200 dark:border-border-primary'
                        }`}
                      >
                        {isPopular && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-banana text-white text-xs font-semibold">
                            {t('mostPopular')}
                          </div>
                        )}
                        <div className="flex items-center justify-between mb-5">
                          <div className="flex items-center gap-3 text-banana">
                            {planIcons[plan.id] || <Sparkles className="w-7 h-7" />}
                            <div>
                              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{plan.name}</h3>
                              <p className="text-sm text-gray-500 dark:text-foreground-tertiary">{t('billedMonthly')}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-3xl font-bold text-gray-900 dark:text-white">${plan.price_usd}</p>
                            <p className="text-sm text-gray-500 dark:text-foreground-tertiary">/ {plan.interval}</p>
                          </div>
                        </div>

                        <p className="text-gray-600 dark:text-foreground-secondary mb-4 min-h-[3rem]">{plan.description}</p>

                        <div className="rounded-2xl bg-gray-50 dark:bg-background-secondary p-4 mb-4">
                          <p className="text-sm text-gray-500 dark:text-foreground-tertiary mb-1">{t('monthlyCredits')}</p>
                          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{plan.monthly_credits.toLocaleString()}</p>
                        </div>

                        <ul className="space-y-3 mb-6">
                          {plan.features.map((feature) => (
                            <li key={feature} className="flex items-start gap-2 text-sm text-gray-600 dark:text-foreground-secondary">
                              <Check className="w-4 h-4 mt-0.5 text-banana" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>

                        <Button
                          type="button"
                          variant={isActivePlan ? 'secondary' : 'primary'}
                          className="w-full"
                          disabled={isActivePlan}
                          loading={purchasingPlan === plan.id}
                          onClick={() => handleSubscriptionCheckout(plan)}
                        >
                          {isActivePlan ? t('activePlan') : t('subscribe')}
                        </Button>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('creditsTitle')}</h2>
                <p className="mt-2 text-gray-600 dark:text-foreground-secondary">{t('creditsSubtitle')}</p>
                <p className="mt-4 text-sm text-gray-500 dark:text-foreground-tertiary">{t('paymentMethod')}</p>
                <ProviderPills
                  providers={packageProviders}
                  selected={selectedPackageProvider}
                  onSelect={setSelectedPackageProvider}
                />
              </div>

              {availablePackages.length === 0 ? (
                <Card className="p-8 text-center text-gray-500 dark:text-foreground-tertiary">
                  {t('noProviderForPlan')}
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {availablePackages.map((pkg) => {
                    const totalCredits = pkg.total_credits || (pkg.credits + (pkg.bonus_credits || 0));
                    return (
                      <Card key={pkg.id} className="p-6 border border-gray-200 dark:border-border-primary">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3 text-banana">
                            {packageIcons[pkg.id] || <Coins className="w-7 h-7" />}
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{pkg.name}</h3>
                              <p className="text-sm text-gray-500 dark:text-foreground-tertiary">{t('oneTime')}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-3xl font-bold text-gray-900 dark:text-white">${pkg.price_usd}</p>
                          </div>
                        </div>

                        <p className="text-gray-600 dark:text-foreground-secondary mb-4 min-h-[3rem]">{pkg.description}</p>

                        <div className="grid grid-cols-3 gap-3 mb-5 text-center">
                          <div className="rounded-xl bg-gray-50 dark:bg-background-secondary p-3">
                            <p className="text-xs text-gray-500 dark:text-foreground-tertiary mb-1">{t('oneTime')}</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{pkg.credits.toLocaleString()}</p>
                          </div>
                          <div className="rounded-xl bg-gray-50 dark:bg-background-secondary p-3">
                            <p className="text-xs text-gray-500 dark:text-foreground-tertiary mb-1">{t('bonusCredits')}</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{(pkg.bonus_credits || 0).toLocaleString()}</p>
                          </div>
                          <div className="rounded-xl bg-gray-50 dark:bg-background-secondary p-3">
                            <p className="text-xs text-gray-500 dark:text-foreground-tertiary mb-1">{t('totalCredits')}</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{totalCredits.toLocaleString()}</p>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="primary"
                          className="w-full"
                          loading={purchasingPackage === pkg.id}
                          onClick={() => handlePackageCheckout(pkg)}
                        >
                          {t('buyCredits')}
                        </Button>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('usageGuide')}</h2>
              </div>
              <Card className="p-6 border border-gray-200 dark:border-border-primary">
                <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {usageCostItems.map((item) => (
                    <div key={item.key} className="rounded-2xl bg-gray-50 dark:bg-background-secondary p-4">
                      <p className="text-sm text-gray-500 dark:text-foreground-tertiary mb-1">{t(`usageItems.${item.key}`)}</p>
                      <p className="text-2xl font-semibold text-gray-900 dark:text-white">{item.cost}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </section>

            {billingPortalProvider && (
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="secondary"
                  icon={<ExternalLink size={16} />}
                  onClick={handleOpenBillingPortal}
                  loading={openingBilling}
                >
                  {t('manageBilling')}
                </Button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
