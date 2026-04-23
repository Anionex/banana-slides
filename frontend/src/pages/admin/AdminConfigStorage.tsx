import React from 'react';
import { Database, Image, Plus, Trash2 } from 'lucide-react';
import { Button, Card, Input, Loading } from '@/components/shared';
import {
  useAdminConfig,
  ConfigPageHeader,
  ProviderToggle,
  SecretPlaceholder,
  STORAGE_BACKEND_OPTIONS,
  type SystemConfig,
} from './adminConfigShared';

const storageI18n = {
  zh: { title: '存储与 AI', subtitle: '对象存储与文生图渠道池' },
  en: { title: 'Storage & AI', subtitle: 'Object storage and image provider pool' },
};

const AdminConfigStorage: React.FC = () => {
  const {
    config, isLoading, isSaving,
    t, ToastContainer,
    updateConfig, handleSave,
    handleStorageField,
    handleAddChannel, handleRemoveChannel, handleChannelChange,
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
        title={storageI18n[lang].title}
        subtitle={storageI18n[lang].subtitle}
        icon={<Database size={20} className="text-cyan-500" />}
        onSave={handleSave}
        isSaving={isSaving}
        saveLabel={t('save')}
        savingLabel={t('saving')}
      />

      <main className="max-w-5xl mx-auto px-6 py-8">
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
                  <Input type="password" value={config.storage_provider_configs.r2.access_key_id} onChange={(e) => handleStorageField('r2', 'access_key_id', e.target.value)} placeholder={SecretPlaceholder(config.storage_provider_configs.r2.access_key_id_length)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Secret Access Key</label>
                  <Input type="password" value={config.storage_provider_configs.r2.secret_access_key} onChange={(e) => handleStorageField('r2', 'secret_access_key', e.target.value)} placeholder={SecretPlaceholder(config.storage_provider_configs.r2.secret_access_key_length)} />
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
                  <Input type="password" value={config.storage_provider_configs.oss.access_key_id} onChange={(e) => handleStorageField('oss', 'access_key_id', e.target.value)} placeholder={SecretPlaceholder(config.storage_provider_configs.oss.access_key_id_length)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-foreground-tertiary mb-1">Access Key Secret</label>
                  <Input type="password" value={config.storage_provider_configs.oss.access_key_secret} onChange={(e) => handleStorageField('oss', 'access_key_secret', e.target.value)} placeholder={SecretPlaceholder(config.storage_provider_configs.oss.access_key_secret_length)} />
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

export default AdminConfigStorage;
