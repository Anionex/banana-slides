import React from 'react';
import { CreditCard, Package } from 'lucide-react';
import { Button, Card, Input, Loading } from '@/components/shared';
import { useAdminConfig, ConfigPageHeader } from './adminConfigShared';

const creditsI18n = {
  zh: { title: '积分与套餐', subtitle: '积分定价与套餐配置' },
  en: { title: 'Credits & Packages', subtitle: 'Credit pricing and package configuration' },
};

const AdminConfigCredits: React.FC = () => {
  const {
    config, packages, isLoading, isSaving,
    t, ToastContainer,
    handleSave,
    handleNumberChange,
    handlePackageChange, handleResetPackages,
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
        title={creditsI18n[lang].title}
        subtitle={creditsI18n[lang].subtitle}
        icon={<CreditCard size={20} className="text-purple-500" />}
        onSave={handleSave}
        isSaving={isSaving}
        saveLabel={t('save')}
        savingLabel={t('saving')}
      />

      <main className="max-w-5xl mx-auto px-6 py-8">
        <Card className="p-6 mb-6">
          <div className="flex items-center mb-4">
            <CreditCard className="mr-2 text-purple-500" size={20} />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground-primary">{t('sections.creditPricing')}</h2>
              <p className="text-sm text-gray-500 dark:text-foreground-tertiary">{t('sections.creditPricingDesc')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {([
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
            ] as const).map((item) => (
              <div key={item.key}>
                <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1">{item.label}</label>
                <Input
                  type="number"
                  value={(config as any)[item.key]}
                  onChange={(e) => handleNumberChange(item.key as any, e.target.value)}
                  min={0}
                />
              </div>
            ))}
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
      </main>
    </div>
  );
};

export default AdminConfigCredits;
