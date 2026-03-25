/**
 * Pricing Page - Credit packages purchase page
 * 积分购买页面
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  ArrowLeft, 
  Coins, 
  Sparkles, 
  Check, 
  Zap, 
  Crown, 
  Building2,
  CreditCard,
  Loader2,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { Button, Card, useToast } from '@/components/shared';
import { useCreditsBalance } from '@/store/useAuthStore';
import { paymentApi, CreditPackage, CreditCosts } from '@/api/payment';

// 页面翻译
const pricingI18n = {
  zh: {
    title: '购买积分',
    subtitle: '选择适合您的积分套餐，开始创作精美PPT',
    currentBalance: '当前余额',
    credits: '积分',
    selectPackage: '选择套餐',
    popular: '最受欢迎',
    bonus: '赠送',
    buyNow: '立即购买',
    payWith: '支付方式',
    wechat: '微信支付',
    alipay: '支付宝',
    processing: '处理中...',
    redirecting: '正在跳转支付页面...',
    paymentError: '创建订单失败',
    loadError: '加载套餐失败',
    retry: '重试',
    usageGuide: '积分消耗说明',
    usageItems: {
      outline: '生成大纲',
      description: '生成描述（每页）',
      image1k: '生成图片 1K（每页）',
      image2k: '生成图片 2K（每页）',
      image4k: '生成图片 4K（每页）',
      refineOutline: '修改大纲',
      refineDescription: '修改描述',
      parseFile: '解析参考文件',
      exportEditable: '导出可编辑PPT',
    },
    back: '返回',
  },
  en: {
    title: 'Buy Credits',
    subtitle: 'Choose a credit package that suits your needs',
    currentBalance: 'Current Balance',
    credits: 'credits',
    selectPackage: 'Select Package',
    popular: 'Popular',
    bonus: 'Bonus',
    buyNow: 'Buy Now',
    payWith: 'Payment Method',
    wechat: 'WeChat Pay',
    alipay: 'Alipay',
    processing: 'Processing...',
    redirecting: 'Redirecting to payment...',
    paymentError: 'Failed to create order',
    loadError: 'Failed to load packages',
    retry: 'Retry',
    usageGuide: 'Credit Usage Guide',
    usageItems: {
      outline: 'Generate outline',
      description: 'Generate description (per page)',
      image1k: 'Generate image 1K (per page)',
      image2k: 'Generate image 2K (per page)',
      image4k: 'Generate image 4K (per page)',
      refineOutline: 'Refine outline',
      refineDescription: 'Refine description',
      parseFile: 'Parse reference file',
      exportEditable: 'Export editable PPT',
    },
    back: 'Back',
  },
};

// 积分消耗说明：key 对应后端字段，label 对应 i18n key
const USAGE_ITEMS: { key: keyof CreditCosts; label: string }[] = [
  { key: 'generate_outline', label: 'outline' },
  { key: 'generate_description', label: 'description' },
  { key: 'generate_image_1k', label: 'image1k' },
  { key: 'generate_image_2k', label: 'image2k' },
  { key: 'generate_image_4k', label: 'image4k' },
  { key: 'refine_outline', label: 'refineOutline' },
  { key: 'refine_description', label: 'refineDescription' },
  { key: 'parse_file', label: 'parseFile' },
  { key: 'export_editable', label: 'exportEditable' },
];

const DEFAULT_CREDIT_COSTS: CreditCosts = {
  generate_outline: 5,
  generate_description: 1,
  generate_image_1k: 8,
  generate_image_2k: 8,
  generate_image_4k: 8,
  edit_image: 8,
  generate_material: 10,
  refine_outline: 2,
  refine_description: 1,
  parse_file: 5,
  export_editable: 15,
};

// 套餐图标映射
const packageIcons: Record<string, React.ReactNode> = {
  starter: <Coins className="w-8 h-8" />,
  basic: <Zap className="w-8 h-8" />,
  standard: <Sparkles className="w-8 h-8" />,
  pro: <Crown className="w-8 h-8" />,
  enterprise: <Building2 className="w-8 h-8" />,
};

export const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { show, ToastContainer } = useToast();
  const creditsBalance = useCreditsBalance();
  
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [creditCosts, setCreditCosts] = useState<CreditCosts>(DEFAULT_CREDIT_COSTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [paymentType, setPaymentType] = useState<'wechat' | 'alipay'>('wechat');
  const [purchasing, setPurchasing] = useState(false);
  
  // 获取翻译
  const t = (key: string) => {
    const lang = i18n.language?.startsWith('zh') ? 'zh' : 'en';
    const keys = key.split('.');
    let value: any = pricingI18n[lang];
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  };

  // 加载套餐列表和积分消耗配置
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [data, costs] = await Promise.all([
          paymentApi.getPackages(),
          paymentApi.getCreditCosts().catch(() => DEFAULT_CREDIT_COSTS),
        ]);
        setPackages(data);
        setCreditCosts(costs);
        const popularPackage = data.find(p => p.id === 'standard');
        if (popularPackage) {
          setSelectedPackage(popularPackage.id);
        }
      } catch (err: any) {
        console.error('Failed to load packages:', err);
        setError(err.response?.data?.message || err.message || t('loadError'));
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // 处理购买
  const handlePurchase = async () => {
    if (!selectedPackage) {
      show({ message: t('selectPackage'), type: 'warning' });
      return;
    }

    setPurchasing(true);
    try {
      const returnUrl = `${window.location.origin}/pricing?success=true`;
      const result = await paymentApi.createOrder(selectedPackage, paymentType, returnUrl);
      
      if (result.success && result.payment_url) {
        show({ message: t('redirecting'), type: 'info' });
        // 跳转到支付页面
        window.location.href = result.payment_url;
      } else {
        throw new Error(result.error_message || t('paymentError'));
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      show({ message: `${t('paymentError')}: ${err.message}`, type: 'error' });
    } finally {
      setPurchasing(false);
    }
  };

  // 检查URL参数，显示支付成功提示
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      show({ message: '支付成功！积分已到账', type: 'success' });
      // 清除URL参数
      window.history.replaceState({}, '', '/pricing');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50/30 to-pink-50/50 dark:from-background-primary dark:via-background-primary dark:to-background-primary">
      {/* 导航栏 */}
      <nav className="sticky top-0 z-50 h-16 bg-white/80 dark:bg-background-primary backdrop-blur-xl border-b border-gray-200/50 dark:border-border-primary">
        <div className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between">
          <button
            onClick={() => navigate('/app')}
            className="flex items-center gap-2 text-gray-600 dark:text-foreground-secondary hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            <span>{t('back')}</span>
          </button>
          
          {/* 当前积分余额 */}
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 rounded-full">
            <Coins size={18} className="text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
              {t('currentBalance')}: {creditsBalance} {t('credits')}
            </span>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-12">
        {/* 标题 */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {t('title')}
          </h1>
          <p className="text-lg text-gray-600 dark:text-foreground-secondary">
            {t('subtitle')}
          </p>
        </div>

        {/* 加载状态 */}
        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-banana" />
          </div>
        )}

        {/* 错误状态 */}
        {error && (
          <div className="flex flex-col items-center py-20 gap-4">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <p className="text-gray-600 dark:text-foreground-secondary">{error}</p>
            <Button onClick={() => window.location.reload()}>
              {t('retry')}
            </Button>
          </div>
        )}

        {/* 套餐列表 */}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-12">
            {packages.map((pkg) => {
              const isSelected = selectedPackage === pkg.id;
              const isPopular = pkg.id === 'standard';
              
              return (
                <Card
                  key={pkg.id}
                  onClick={() => setSelectedPackage(pkg.id)}
                  className={`relative p-6 cursor-pointer transition-all duration-300 ${
                    isSelected
                      ? 'ring-2 ring-banana shadow-xl dark:shadow-banana/20 scale-105'
                      : 'hover:shadow-lg dark:hover:shadow-none hover:scale-102'
                  } ${isPopular ? 'border-banana' : ''}`}
                >
                  {/* 热门标签 */}
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="px-3 py-1 bg-gradient-to-r from-banana to-orange-400 text-black text-xs font-bold rounded-full">
                        {t('popular')}
                      </span>
                    </div>
                  )}

                  {/* 选中指示器 */}
                  {isSelected && (
                    <div className="absolute top-4 right-4">
                      <div className="w-6 h-6 bg-banana rounded-full flex items-center justify-center">
                        <Check size={14} className="text-black" />
                      </div>
                    </div>
                  )}

                  {/* 图标 */}
                  <div className={`mb-4 ${isSelected ? 'text-banana' : 'text-gray-400 dark:text-foreground-tertiary'}`}>
                    {packageIcons[pkg.id] || <Coins className="w-8 h-8" />}
                  </div>

                  {/* 套餐名称 */}
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    {pkg.name}
                  </h3>

                  {/* 积分数量 */}
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">
                      {pkg.credits}
                    </span>
                    {pkg.bonus_credits > 0 && (
                      <span className="ml-2 text-sm text-green-600 dark:text-green-400 font-medium">
                        +{pkg.bonus_credits} {t('bonus')}
                      </span>
                    )}
                  </div>

                  {/* 价格 */}
                  <div className="mb-4">
                    <span className="text-2xl font-bold text-banana">
                      ¥{pkg.price_cny}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-foreground-tertiary ml-2">
                      / ${pkg.price_usd}
                    </span>
                  </div>

                  {/* 描述 */}
                  <p className="text-sm text-gray-600 dark:text-foreground-tertiary">
                    {pkg.description}
                  </p>
                </Card>
              );
            })}
          </div>
        )}

        {/* 支付区域 */}
        {!loading && !error && selectedPackage && (
          <Card className="max-w-md mx-auto p-6 mb-12">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <CreditCard size={20} />
              {t('payWith')}
            </h3>

            {/* 支付方式选择 */}
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setPaymentType('wechat')}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                  paymentType === 'wechat'
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-200 dark:border-border-primary hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#07C160">
                    <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18z"/>
                    <path d="M23.906 14.945c0-3.468-3.35-6.283-7.474-6.283-4.2 0-7.54 2.815-7.54 6.283 0 3.477 3.34 6.283 7.54 6.283.82 0 1.613-.113 2.352-.314a.646.646 0 01.564.08l1.525.93a.266.266 0 00.127.042.233.233 0 00.232-.238c0-.056-.02-.114-.037-.168l-.3-1.152a.476.476 0 01.167-.52c1.585-1.186 2.844-2.93 2.844-4.943zm-10.22-1.093c-.503 0-.918-.414-.918-.93 0-.516.415-.93.918-.93.506 0 .918.414.918.93 0 .516-.412.93-.918.93zm5.434 0c-.503 0-.918-.414-.918-.93 0-.516.415-.93.918-.93.506 0 .918.414.918.93 0 .516-.412.93-.918.93z"/>
                  </svg>
                  <span className={paymentType === 'wechat' ? 'text-green-700 dark:text-green-400 font-medium' : 'text-gray-600 dark:text-foreground-secondary'}>
                    {t('wechat')}
                  </span>
                </div>
              </button>

              <button
                onClick={() => setPaymentType('alipay')}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                  paymentType === 'alipay'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-border-primary hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#1677FF">
                    <path d="M20.097 17.508c-.557-.322-3.015-1.54-4.74-2.448.658-1.143 1.183-2.478 1.532-3.936H13.5V9.568h4.5V8.75h-4.5v-2.5h-2.25v2.5H6.75v.818h4.5v1.556H7.5v.75h7.174a12.48 12.48 0 01-.968 2.537c-2.062-.805-4.05-1.253-5.325-.792-.941.34-1.614 1.056-1.784 1.94-.313 1.625.818 3.168 2.766 3.467 2.152.33 4.215-.55 5.678-2.163 1.977 1.01 5.39 2.585 5.987 2.884a9.99 9.99 0 01-9.028 5.69c-5.523 0-10-4.478-10-10 0-5.523 4.477-10 10-10s10 4.477 10 10a9.97 9.97 0 01-1.903 5.87zM9.75 17.883c-1.31 0-2.065-.814-1.875-1.56.19-.746.875-1.134 1.875-1.134.999 0 2.25.388 3.56 1.002-1.06 1.136-2.249 1.692-3.56 1.692z"/>
                  </svg>
                  <span className={paymentType === 'alipay' ? 'text-blue-700 dark:text-blue-400 font-medium' : 'text-gray-600 dark:text-foreground-secondary'}>
                    {t('alipay')}
                  </span>
                </div>
              </button>
            </div>

            {/* 购买按钮 */}
            <Button
              size="lg"
              onClick={handlePurchase}
              loading={purchasing}
              disabled={purchasing}
              className="w-full"
            >
              {purchasing ? t('processing') : (
                <>
                  {t('buyNow')}
                  <ExternalLink size={16} className="ml-2" />
                </>
              )}
            </Button>
          </Card>
        )}

        {/* 积分消耗说明 */}
        <Card className="max-w-2xl mx-auto p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Sparkles size={20} className="text-banana" />
            {t('usageGuide')}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {USAGE_ITEMS.map(({ key, label }) => (
              <div
                key={key}
                className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-background-tertiary rounded-lg"
              >
                <span className="text-gray-700 dark:text-foreground-secondary">
                  {t(`usageItems.${label}`)}
                </span>
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  {creditCosts[key]} {t('credits')}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </main>

      <ToastContainer />
    </div>
  );
};

export default PricingPage;
