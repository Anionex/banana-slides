import React from 'react';
import { Shield, Users, Package } from 'lucide-react';
import { Card, Input, Loading } from '@/components/shared';
import {
  useAdminConfig,
  ConfigPageHeader,
  ProviderToggle,
} from './adminConfigShared';

const generalI18n = {
  zh: { title: '通用配置', subtitle: '用户策略、注册/邀请奖励、功能开关' },
  en: { title: 'General', subtitle: 'User policy, registration/invitation bonuses, feature toggles' },
};

const AdminConfigGeneral: React.FC = () => {
  const {
    config, isLoading, isSaving,
    t, ToastContainer,
    handleSave,
    handleNumberChange, handleBoolChange,
    handleFieldToggle, fieldsByCategory,
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
        title={generalI18n[lang].title}
        subtitle={generalI18n[lang].subtitle}
        icon={<Shield size={20} className="text-blue-500" />}
        onSave={handleSave}
        isSaving={isSaving}
        saveLabel={t('save')}
        savingLabel={t('saving')}
      />

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
      </main>
    </div>
  );
};

export default AdminConfigGeneral;
