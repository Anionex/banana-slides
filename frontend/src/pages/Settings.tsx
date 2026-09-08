import { SettingsAdvanced, SettingsServiceRow, SettingsActions } from '@/components/settings/SettingsLayout';
import { SettingsPageFrame } from '@/components/settings/SettingsPageFrame';
import { SettingsProviderPicker } from '@/components/settings/SettingsProviderPicker';
import { SettingsApiGuidance } from '@/components/settings/SettingsApiGuidance';
import { SettingsField } from '@/components/settings/SettingsField';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Key, Image, Zap, Save, RotateCcw, Globe, FileText, Brain, ArrowUp, ArrowUpRight, Link2, Volume2, Info, RefreshCw, CheckCircle, Lightbulb } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { appVersion } from '@/utils/appVersion';
import { isDesktop } from '@/utils';
import { startOpenAIOAuthMonitor } from '@/utils/openaiOAuthMonitor';
import { DataStorageSettings } from '@/components/settings/DataStorageSettings';
import type {
  DesktopAutoUpdateSettings,
  DesktopUpdateCheckResult,
  DesktopUpdateElectronApi,
} from '@/types/desktopUpdate';

// 组件内翻译
import { settingsI18n } from '@/components/settings/settingsI18n';
import { Button, Input, Loading, Markdown, Modal, useToast, useConfirm } from '@/components/shared';
import * as api from '@/api/endpoints';
import type { OutputLanguage, UpdateCheckInfo } from '@/api/endpoints';
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
  link?: string;  // 申请链接 URL
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

const INFERERA_AFFILIATE_URL = 'https://api.inferera.com/?aff=17EC';
const APIMART_SIGNUP_URL = 'https://go.apimart.ai/gh-banana-slides';
const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const APIMART_BASE_URL = 'https://api.apimart.ai/v1';
const VOLCENGINE_AGENTPLANS_CN_URL = 'https://www.volcengine.com/activity/ai618?utm_campaign=hw&utm_content=hw&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides';
const VOLCENGINE_AGENTPLANS_EN_URL = 'https://www.byteplus.com/en/product/modelark?utm_campaign=hw&utm_content=banana-slides&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=banana-slides';

// LazyLLM 支持的厂商列表
const LAZYLLM_SOURCES = [
  { value: 'qwen', label: 'Qwen (通义千问)' },
  { value: 'doubao', label: 'Doubao (火山引擎)' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'glm', label: 'GLM (智谱)' },
  { value: 'siliconflow', label: 'SiliconFlow' },
  { value: 'sensenova', label: 'SenseNova (商汤)' },
  { value: 'minimax', label: 'MiniMax' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'kimi', label: 'Kimi' },
  { value: 'ppio', label: 'PPIO (派欧云)' },
  { value: 'aiping', label: 'AIPing (爱拼)' },
];

// 所有可用的提供商选项（Gemini/OpenAI/Codex + LazyLLM 厂商）
const getAllProviderSources = (isZh: boolean) => [
  { value: 'gemini', label: 'Gemini' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'volcengine', label: isZh ? '火山 Agent Plan' : 'Volcengine Agent Plan' },
  { value: 'doubao', label: isZh ? 'Doubao（豆包）' : 'Doubao / ModelArk' },
  { value: 'codex', label: 'Codex (OpenAI OAuth)' },
  ...LAZYLLM_SOURCES.filter(s => !['openai', 'doubao', 'ppio', 'aiping'].includes(s.value)), // avoid duplicate or non-partner providers
];

// 需要 API Key + Base URL 的提供商（非 LazyLLM 厂商）
const API_KEY_PROVIDERS = new Set(['gemini', 'openai', 'volcengine']);
const APIMART_RECOMMENDED_MODELS = {
  text: 'gpt-5.6-sol',
  image: 'gpt-image-2',
  caption: 'gpt-5.6-luna',
};
const isApimartBaseUrl = (url: string) =>
  url.trim().replace(/\/+$/, '') === APIMART_BASE_URL;
// 火山 Agent Plans（OpenAI 兼容）: 专属 Base URL 与模型名
const VOLCENGINE_AGENTPLANS_BASE_URL = 'https://ark.cn-beijing.volces.com/api/plan/v3';
const VOLCENGINE_AGENTPLANS_RECOMMENDED_MODELS = {
  text: 'doubao-seed-2.1-turbo',
  caption: 'doubao-seed-2.1-turbo',
  image: 'doubao-seedream-5.0-lite',
};
// 火山方舟（标准 ModelArk, LazyLLM Doubao 路径）: 使用端点 ID 格式
const VOLCENGINE_MODELARK_RECOMMENDED_MODELS = {
  text: 'doubao-seed-2-1-pro-260628',
  caption: 'doubao-seed-2-1-pro-260628',
  image: 'doubao-seedream-5-0-260128',
};
// 各 provider 的默认端点: 切换到 Agent Plans 时用于识别并清除过时默认值
const KNOWN_DEFAULT_BASE_URLS = new Set([
  '',
  'https://api.inferera.com/v1',
  'https://api.openai.com/v1',
  APIMART_BASE_URL,
  'https://api.inferera.com/gemini',
  'https://generativelanguage.googleapis.com',
  'https://ark.cn-beijing.volces.com/api/v3',
  'https://api.anthropic.com',
]);
// 离开 Agent Plans 时必须清空的火山默认端点（对 openai/gemini 等是过时值）
const VOLCENGINE_DEFAULT_BASE_URLS = new Set([
  'https://ark.cn-beijing.volces.com/api/plan/v3',
  'https://ark.cn-beijing.volces.com/api/v3',
]);

// LazyLLM 厂商名集合
const LAZYLLM_VENDOR_SET = new Set(LAZYLLM_SOURCES.map(s => s.value));

// LazyLLM 0.7.x vendors that actually register an image-generation (text2image)
// supplier; image-model source options are filtered to this set so a selection
// cannot point at a vendor without image capability.
const IMAGE_CAPABLE_LAZYLLM_SOURCES = new Set([
  'qwen', 'doubao', 'siliconflow', 'aiping', 'glm', 'minimax',
]);

// Whether a source value can appear in the image-model source dropdown:
// real OpenAI provider plus LazyLLM vendors that register a text2image
// supplier. Non-LazyLLM sources (gemini/volcengine/codex) always pass.
const isImageModelSourceSelectable = (value: string) =>
  value === 'openai'
  || !LAZYLLM_VENDOR_SET.has(value)
  || IMAGE_CAPABLE_LAZYLLM_SOURCES.has(value);

// 初始表单数据
const initialFormData = {
  ai_provider_format: 'gemini' as string,
  api_base_url: '',
  api_key: '',
  text_model: '',
  image_model: '',
  image_caption_model: '',
  mineru_api_base: '',
  mineru_token: '',
  image_resolution: '2K',
  enable_image_quality_control: false,
  max_description_workers: 5,
  max_image_workers: 8,
  output_language: 'zh' as OutputLanguage,
  // 推理模式配置（分别控制文本和图像）
  enable_text_reasoning: false,
  text_thinking_budget: 1024,
  enable_image_reasoning: false,
  image_thinking_budget: 1024,
  baidu_api_key: '',
  // LazyLLM 配置
  text_model_source: '',
  image_model_source: '',
  image_caption_model_source: '',
  lazyllm_api_keys: {} as Record<string, string>,
  // Per-model API credentials (for gemini/openai per-model overrides)
  text_api_key: '',
  text_api_base_url: '',
  image_api_key: '',
  image_api_base_url: '',
  image_caption_api_key: '',
  image_caption_api_base_url: '',
  openai_image_api_protocol: 'auto',
  // ElevenLabs TTS
  elevenlabs_api_key: '',
};

const isLazyllmVendor = (vendor: string) =>
  LAZYLLM_VENDOR_SET.has(vendor) && vendor !== 'openai';

// When backend returns "lazyllm", infer specific vendor from configured keys
const resolveLazyllmVendor = (format: string, keysInfo?: Record<string, number>): string => {
  if (format !== 'lazyllm') return format;
  if (keysInfo) {
    const vendor = LAZYLLM_SOURCES.find(s => isLazyllmVendor(s.value) && keysInfo[s.value]);
    if (vendor) return vendor.value;
  }
  return LAZYLLM_SOURCES.find(s => isLazyllmVendor(s.value))?.value || 'deepseek';
};

const GlobalVendorKeyInput: React.FC<{
  vendor: string; formData: typeof initialFormData;
  setFormData: React.Dispatch<React.SetStateAction<typeof initialFormData>>;
  settings: SettingsType | null; t: ReturnType<typeof useT>;
}> = ({ vendor, formData, setFormData, settings, t }) => {
  const vendorLabel = LAZYLLM_SOURCES.find(s => s.value === vendor)?.label || vendor.toUpperCase();
  const keyLength = settings?.lazyllm_api_keys_info?.[vendor] || 0;
  const placeholder = keyLength > 0
    ? t('settings.fields.vendorApiKeySet', { length: keyLength })
    : t('settings.fields.vendorApiKeyPlaceholder', { vendor: vendorLabel });
  return (
    <div className="pl-3 border-l-2 border-amber-300 dark:border-amber-600">
      <Input
        label={t('settings.fields.vendorApiKey', { vendor: vendorLabel })}
        type="password"
        placeholder={placeholder}
        value={formData.lazyllm_api_keys[vendor] || ''}
        onChange={(e) => {
          setFormData(prev => ({
            ...prev,
            lazyllm_api_keys: { ...prev.lazyllm_api_keys, [vendor]: e.target.value }
          }));
        }}
      />
      <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">{t('settings.fields.vendorApiKeyDesc')}</p>
    </div>
  );
};

type SettingsTranslator = ReturnType<typeof useT>;

interface UpdateResultView {
  status: 'up_to_date' | 'update_available' | 'downloading' | 'update_downloaded' | 'unknown';
  updateAvailable: boolean;
  version: string;
  downloadUrl?: string;
  canAutoUpdate?: boolean;
  progress?: number;
  notes?: string;
}

function getLatestVersion(info: UpdateCheckInfo): string {
  const sha = info.latest?.sha;
  if (sha) {
    return sha.length > 7 ? sha.slice(0, 7) : sha;
  }
  return info.latest?.tag || '';
}

function toUpdateResultView(info: UpdateCheckInfo): UpdateResultView {
  return {
    status: info.status,
    updateAvailable: info.update_available,
    version: getLatestVersion(info),
  };
}

function toDesktopUpdateResultView(info: DesktopUpdateCheckResult): UpdateResultView {
  if (
    (
      info.status === 'update_available'
      || info.status === 'downloading'
      || info.status === 'update_downloaded'
      || info.status === 'error'
    )
    && info.update
  ) {
    return {
      status: info.status === 'error' ? 'update_available' : info.status,
      updateAvailable: true,
      version: info.update.version,
      downloadUrl: info.update.url,
      canAutoUpdate: info.canAutoUpdate,
      progress: info.progress?.percent,
      notes: info.update.notes,
    };
  }

  if (info.status !== 'up_to_date') {
    return {
      status: 'unknown',
      updateAvailable: false,
      version: info.latestVersion,
    };
  }

  return {
    status: 'up_to_date',
    updateAvailable: false,
    version: info.latestVersion,
  };
}

function formatUpdateMessage(t: SettingsTranslator, info: UpdateResultView): string {
  if (info.status === 'up_to_date') return t('settings.about.upToDate');
  if (info.status === 'update_available') return t('settings.about.updateAvailable', { version: info.version });
  if (info.status === 'downloading') {
    return t('settings.about.updateDownloading', {
      version: info.version,
      progress: String(Math.round(info.progress || 0)),
    });
  }
  if (info.status === 'update_downloaded') return t('settings.about.updateReady', { version: info.version });
  return t('settings.about.unknown');
}

export const SettingsAbout: React.FC<{ t: SettingsTranslator }> = ({ t }) => {
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateActionPending, setUpdateActionPending] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateResultView | null>(null);
  const [updateError, setUpdateError] = useState('');
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [automaticUpdatesEnabled, setAutomaticUpdatesEnabled] = useState(true);
  const [automaticUpdatesSupported, setAutomaticUpdatesSupported] = useState(true);
  const [automaticUpdatesLoading, setAutomaticUpdatesLoading] = useState(isDesktop);
  const [automaticUpdatesSaving, setAutomaticUpdatesSaving] = useState(false);
  const [automaticUpdatesError, setAutomaticUpdatesError] = useState('');

  const desktopUpdateApi = isDesktop
    ? (window as typeof window & { electronAPI?: DesktopUpdateElectronApi }).electronAPI
    : undefined;

  useEffect(() => {
    if (!desktopUpdateApi) return;
    let disposed = false;
    const applySettings = (settings: DesktopAutoUpdateSettings) => {
      if (!disposed) {
        setAutomaticUpdatesEnabled(settings.automaticUpdatesEnabled);
        setAutomaticUpdatesSupported(settings.canAutoUpdate !== false);
      }
    };
    const applyUpdateState = (state: DesktopUpdateCheckResult) => {
      if (!disposed) setUpdateInfo(toDesktopUpdateResultView(state));
    };
    const unsubscribe = desktopUpdateApi.onUpdateStatus?.(applyUpdateState);

    if (desktopUpdateApi.getAutoUpdateSettings) {
      desktopUpdateApi.getAutoUpdateSettings()
        .then(applySettings)
        .catch((error) => {
          if (!disposed) setAutomaticUpdatesError(error?.message || t('settings.about.automaticUpdatesSaveFailed'));
        })
        .finally(() => {
          if (!disposed) setAutomaticUpdatesLoading(false);
        });
    } else {
      setAutomaticUpdatesLoading(false);
    }

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [desktopUpdateApi, t]);

  const handleAutomaticUpdatesChange = async () => {
    if (!desktopUpdateApi?.setAutomaticUpdatesEnabled || automaticUpdatesSaving) return;
    const nextEnabled = !automaticUpdatesEnabled;
    setAutomaticUpdatesSaving(true);
    setAutomaticUpdatesError('');
    try {
      const settings = await desktopUpdateApi.setAutomaticUpdatesEnabled(nextEnabled);
      setAutomaticUpdatesEnabled(settings.automaticUpdatesEnabled);
    } catch (error: any) {
      setAutomaticUpdatesError(error?.message || t('settings.about.automaticUpdatesSaveFailed'));
    } finally {
      setAutomaticUpdatesSaving(false);
    }
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateError('');
    try {
      if (isDesktop) {
        const response = await desktopUpdateApi!.checkForUpdates();
        setUpdateInfo(toDesktopUpdateResultView(response));
      } else {
        const response = await api.checkForUpdates();
        setUpdateInfo(response.data ? toUpdateResultView(response.data) : null);
      }
      setUpdateDialogOpen(true);
    } catch (error: any) {
      setUpdateInfo(null);
      setUpdateError(error?.response?.data?.error?.message || error?.message || t('settings.about.failed'));
      setUpdateDialogOpen(true);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleDesktopUpdateAction = async () => {
    if (!desktopUpdateApi || !updateInfo || updateActionPending) return;
    setUpdateActionPending(true);
    setUpdateError('');
    try {
      if (updateInfo.status === 'update_downloaded' && desktopUpdateApi.installUpdate) {
        const result = await desktopUpdateApi.installUpdate();
        if (!result.success) throw new Error(result.error || 'UPDATE_INSTALL_FAILED');
      } else if (updateInfo.canAutoUpdate && desktopUpdateApi.downloadUpdate) {
        const response = await desktopUpdateApi.downloadUpdate();
        setUpdateInfo(toDesktopUpdateResultView(response));
      } else if (updateInfo.downloadUrl) {
        await desktopUpdateApi.openExternal(updateInfo.downloadUrl);
      }
    } catch (error: any) {
      setUpdateError(error?.message || t('settings.about.failed'));
    } finally {
      setUpdateActionPending(false);
    }
  };

  const showSuccessCheck = updateInfo?.status === 'up_to_date';

  return (
    <>
      <div className="pt-4 border-t border-gray-200 dark:border-border-primary">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground-primary mb-3 flex items-center">
          <Info size={20} />
          <span className="ml-2">{t('settings.sections.about')}</span>
        </h2>
        {isDesktop && (
          <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-border-primary dark:bg-background-secondary">
            <div className="min-w-0">
              <div className="font-medium text-gray-900 dark:text-foreground-primary">
                {automaticUpdatesSupported
                  ? t('settings.about.automaticUpdates')
                  : t('settings.about.automaticUpdateChecks')}
              </div>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-foreground-tertiary">
                {automaticUpdatesSupported
                  ? t('settings.about.automaticUpdatesDesc')
                  : t('settings.about.automaticUpdateChecksDesc')}
              </p>
              {automaticUpdatesError && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {t('settings.about.automaticUpdatesSaveFailed')}: {automaticUpdatesError}
                </p>
              )}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={automaticUpdatesEnabled}
              aria-label={automaticUpdatesSupported
                ? t('settings.about.automaticUpdates')
                : t('settings.about.automaticUpdateChecks')}
              disabled={automaticUpdatesLoading || automaticUpdatesSaving || !desktopUpdateApi?.setAutomaticUpdatesEnabled}
              onClick={handleAutomaticUpdatesChange}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-banana-500 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-50 ${
                automaticUpdatesEnabled ? 'bg-banana-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform ${
                  automaticUpdatesEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        )}
        <div className="flex flex-col gap-3 text-sm text-gray-600 dark:text-foreground-tertiary sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div title={appVersion.detail} aria-label={`${t('settings.about.version')} ${appVersion.detail}`}>
              {t('settings.about.version')}: {appVersion.display}
            </div>
            <a
              href="https://github.com/Anionex/banana-slides"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-banana-700 dark:text-banana hover:underline"
            >
              {t('settings.about.source')}
            </a>
            {updateInfo && (
              <div className={updateInfo.updateAvailable ? 'text-orange-600 dark:text-orange-400' : 'text-gray-600 dark:text-foreground-tertiary'}>
                <div>{formatUpdateMessage(t, updateInfo)}</div>
              </div>
            )}
            {updateError && (
              <div className="text-red-600 dark:text-red-400">
                {t('settings.about.failed')}: {updateError}
              </div>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={16} className={checkingUpdate ? 'animate-spin' : ''} />}
            onClick={handleCheckUpdate}
            loading={checkingUpdate}
          >
            {checkingUpdate ? t('settings.about.checking') : t('settings.about.checkUpdate')}
          </Button>
        </div>
      </div>

      <Modal isOpen={updateDialogOpen} onClose={() => setUpdateDialogOpen(false)} title={t('settings.about.resultTitle')}>
        <div className="space-y-4">
          {updateInfo && (
            <div className="space-y-2 text-sm text-gray-700 dark:text-foreground-secondary">
              <div className="flex flex-col items-center gap-3 py-2 text-center">
                {showSuccessCheck && (
                  <CheckCircle
                    size={44}
                    data-testid="update-success-icon"
                    className="text-green-600 dark:text-green-400"
                    aria-hidden="true"
                  />
                )}
                {updateInfo.updateAvailable && (
                  <ArrowUp
                    size={44}
                    data-testid="update-available-icon"
                    className="text-orange-600 dark:text-orange-400"
                    aria-hidden="true"
                  />
                )}
                <p className={updateInfo.updateAvailable
                  ? 'text-xl font-semibold text-orange-600 dark:text-orange-400'
                  : 'text-xl font-semibold text-gray-900 dark:text-foreground-primary'
                }>
                  {formatUpdateMessage(t, updateInfo)}
                </p>
              </div>
              {updateInfo.updateAvailable && updateInfo.notes?.trim() && (
                <section aria-label={t('settings.about.summary')} className="space-y-2">
                  <h3 className="font-semibold text-gray-900 dark:text-foreground-primary">
                    {t('settings.about.summary')}
                  </h3>
                  <div className="max-h-52 overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-border-primary dark:bg-background-secondary">
                    <Markdown>{updateInfo.notes.trim()}</Markdown>
                  </div>
                </section>
              )}
              {updateInfo.updateAvailable && updateInfo.downloadUrl && (
                <button
                  type="button"
                  onClick={() => desktopUpdateApi?.openExternal(updateInfo.downloadUrl!)}
                  className="inline-flex items-center gap-1.5 font-medium text-banana-700 hover:text-banana-800 hover:underline dark:text-banana-300 dark:hover:text-banana-200"
                >
                  {t('settings.about.changelog')}
                  <ArrowUpRight size={15} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
          {updateError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {t('settings.about.failed')}: {updateError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            {isDesktop && updateInfo?.updateAvailable && updateInfo.status !== 'downloading' && (
              <Button
                size="sm"
                onClick={handleDesktopUpdateAction}
                loading={updateActionPending}
              >
                {updateInfo.status === 'update_downloaded'
                  ? t('settings.about.restart')
                  : updateInfo.canAutoUpdate
                    ? t('settings.about.download')
                    : t('settings.about.fallbackDownload')}
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => setUpdateDialogOpen(false)}>
              {updateInfo?.updateAvailable ? t('settings.about.later') : t('settings.about.close')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

const formDataFromSettings = (data: SettingsType): typeof initialFormData => {
  const providerFormat = resolveLazyllmVendor(data.ai_provider_format || 'gemini', data.lazyllm_api_keys_info).toLowerCase();
  const textModelSource = (data.text_model_source || '').toLowerCase();
  const imageModelSource = (data.image_model_source || '').toLowerCase();
  const imageCaptionModelSource = (data.image_caption_model_source || '').toLowerCase();

  return {
    ai_provider_format: providerFormat,
    api_base_url: data.api_base_url || '',
    api_key: '',
    image_resolution: data.image_resolution || '2K',
    enable_image_quality_control: data.enable_image_quality_control ?? false,
    max_description_workers: data.max_description_workers || 5,
    max_image_workers: data.max_image_workers || 8,
    text_model: data.text_model || '',
    image_model: data.image_model || '',
    mineru_api_base: data.mineru_api_base || '',
    mineru_token: '',
    image_caption_model: data.image_caption_model || '',
    output_language: data.output_language || 'zh',
    enable_text_reasoning: data.enable_text_reasoning || false,
    text_thinking_budget: data.text_thinking_budget || 1024,
    enable_image_reasoning: data.enable_image_reasoning || false,
    image_thinking_budget: data.image_thinking_budget || 1024,
    baidu_api_key: '',
    text_model_source: textModelSource,
    image_model_source: imageModelSource,
    image_caption_model_source: imageCaptionModelSource,
    lazyllm_api_keys: {},
    text_api_key: '',
    text_api_base_url: data.text_api_base_url || '',
    image_api_key: '',
    image_api_base_url: data.image_api_base_url || '',
    image_caption_api_key: '',
    image_caption_api_base_url: data.image_caption_api_base_url || '',
    openai_image_api_protocol: data.openai_image_api_protocol || 'auto',
    elevenlabs_api_key: '',
  };
};

// Settings 组件 - 纯嵌入模式（可复用）
export const Settings: React.FC = () => {
  const t = useT(settingsI18n);
  const { i18n } = useTranslation();
  const isZh = i18n.language?.startsWith('zh') ?? true;
  const { show, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    show({ message: '链接已复制到剪贴板', type: 'success' });
  };

  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [serviceTestStates, setServiceTestStates] = useState<Record<string, ServiceTestState>>({});
  const [oauthConnecting, setOauthConnecting] = useState(false);
  const [manualCallbackUrl, setManualCallbackUrl] = useState('');
  const [manualCallbackOpen, setManualCallbackOpen] = useState(false);
  const [manualCallbackSubmitting, setManualCallbackSubmitting] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const oauthMonitorStopRef = useRef<(() => void) | null>(null);
  const oauthAttemptRef = useRef(0);
  const allProviderSources = getAllProviderSources(isZh);
  const globalProviderSources = [
    allProviderSources[0],
    { value: 'apimart', label: 'APIMart' },
    allProviderSources[2],
    allProviderSources[1],
    ...allProviderSources.slice(3),
  ];
  const volcengineAgentPlansUrl = isZh ? VOLCENGINE_AGENTPLANS_CN_URL : VOLCENGINE_AGENTPLANS_EN_URL;
  const volcengineLogoUrl = isZh ? '/volcengine/huoshan.png' : '/volcengine/byteplus.png';
  const usesVolcengineCampaignPromo = formData.ai_provider_format === 'volcengine' || formData.ai_provider_format === 'doubao';
  const usesApimartProvider = formData.ai_provider_format === 'openai' && isApimartBaseUrl(formData.api_base_url);
  const selectedGlobalProvider = usesApimartProvider ? 'apimart' : formData.ai_provider_format;
  const activeVolcenginePromoKey = formData.ai_provider_format === 'doubao'
    ? 'settings.doubaoVolcenginePromo'
    : 'settings.volcenginePromo';
  const activeApiKeyHelpKey = formData.ai_provider_format === 'volcengine'
    ? 'settings.volcengineKeyHelp'
    : formData.ai_provider_format === 'doubao'
      ? 'settings.doubaoKeyHelp'
      : usesApimartProvider
        ? 'settings.apimartKeyHelp'
        : 'settings.apiKeyHelp';
  const activeApiKeyHelpUrl = usesApimartProvider ? APIMART_SIGNUP_URL : INFERERA_AFFILIATE_URL;
  const activeApiKeyTipKey = usesApimartProvider ? 'settings.apimartApiKeyTip' : 'settings.apiKeyTip';
  const stopOAuthMonitor = useCallback(() => {
    oauthAttemptRef.current += 1;
    oauthMonitorStopRef.current?.();
    oauthMonitorStopRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stopOAuthMonitor();
    };
  }, [stopOAuthMonitor]);

  useEffect(() => {
    if (settings) {
      try {
        sessionStorage.setItem('banana-settings', JSON.stringify(settings));
      } catch (error) {
        console.warn('Failed to persist settings in sessionStorage:', error);
      }
    }
  }, [settings]);

  const applyOAuthStatus = useCallback((connected: boolean, accountId: string | null) => {
    setSettings(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        openai_oauth_connected: connected,
        openai_oauth_account_id: accountId,
      };
    });
  }, []);

  const handleOAuthLogin = async () => {
    stopOAuthMonitor();
    const attemptId = oauthAttemptRef.current;
    setOauthConnecting(true);
    try {
      const resp = await api.getOpenAIOAuthUrl();
      if (attemptId !== oauthAttemptRef.current) return;
      if (resp.success && resp.data?.auth_url) {
        if (resp.data.callback_server_available === false) {
          setManualCallbackOpen(true);
          show({ message: t('settings.openaiOAuth.callbackPortBusy'), type: 'warning' });
        }
        const popup = window.open(resp.data.auth_url, 'openai-oauth', 'width=600,height=700');
        if ((!popup || popup.closed) && !isDesktop) {
          setOauthConnecting(false);
          show({ message: t('settings.openaiOAuth.popupBlocked'), type: 'error' });
          return;
        }

        const monitor = startOpenAIOAuthMonitor({
          desktop: isDesktop,
          popup,
          getStatus: async () => {
            const statusResp = await api.getOpenAIOAuthStatus();
            return statusResp.success && statusResp.data ? statusResp.data : null;
          },
          onConnected: status => {
            oauthMonitorStopRef.current = null;
            setOauthConnecting(false);
            applyOAuthStatus(true, status.account_id || null);
            show({ message: t('settings.openaiOAuth.manualCallbackSuccess'), type: 'success' });
          },
          onFailure: (reason, message) => {
            oauthMonitorStopRef.current = null;
            setOauthConnecting(false);
            const errorMessage = reason === 'timeout'
              ? t('settings.openaiOAuth.connectTimeout')
              : message || t('settings.openaiOAuth.connectFailed');
            show({ message: errorMessage, type: 'error' });
          },
        });
        oauthMonitorStopRef.current = monitor.stop;
      } else {
        setOauthConnecting(false);
        show({ message: t('settings.openaiOAuth.connectFailed'), type: 'error' });
      }
    } catch {
      if (attemptId !== oauthAttemptRef.current) return;
      stopOAuthMonitor();
      setOauthConnecting(false);
      show({ message: t('settings.openaiOAuth.connectFailed'), type: 'error' });
    }
  };

  const handleOAuthDisconnect = async () => {
    try {
      const resp = await api.disconnectOpenAIOAuth();
      if (resp.success) {
        setSettings(prev => prev ? {
          ...prev,
          openai_oauth_connected: false,
          openai_oauth_account_id: null,
        } : prev);
        show({ message: t('settings.openaiOAuth.disconnectSuccess'), type: 'success' });
      }
    } catch {
      show({ message: t('settings.openaiOAuth.disconnectFailed'), type: 'error' });
    }
  };

  const handleManualCallback = async () => {
    if (!manualCallbackUrl.trim()) return;
    setManualCallbackSubmitting(true);
    try {
      const resp = await api.submitOAuthManualCallback(manualCallbackUrl.trim());
      if (resp.success) {
        stopOAuthMonitor();
        setOauthConnecting(false);
        setManualCallbackUrl('');
        setManualCallbackOpen(false);
        applyOAuthStatus(true, resp.data?.account_id || null);
        show({ message: t('settings.openaiOAuth.manualCallbackSuccess'), type: 'success' });
      } else {
        show({ message: t('settings.openaiOAuth.connectFailed'), type: 'error' });
      }
    } catch {
      show({ message: t('settings.openaiOAuth.connectFailed'), type: 'error' });
    } finally {
      setManualCallbackSubmitting(false);
    }
  };

  // 配置驱动的表单区块定义（使用翻译）
  const settingsSections: SectionConfig[] = [
    // Global API config & Model config are rendered separately above
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
          link: 'https://mineru.net/apiManage/token',
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
        {
          key: 'enable_image_quality_control',
          label: t('settings.fields.enableImageQualityControl'),
          type: 'switch',
          description: t('settings.fields.enableImageQualityControlDesc'),
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
          key: 'baidu_api_key',
          label: t('settings.fields.baiduOcrApiKey'),
          type: 'password',
          placeholder: t('settings.fields.baiduOcrApiKeyPlaceholder'),
          sensitiveField: true,
          lengthKey: 'baidu_api_key_length',
          description: t('settings.fields.baiduOcrApiKeyDesc'),
          link: 'https://console.bce.baidu.com/iam/#/iam/apikey/list',
        },
      ],
    },
    {
      title: t('settings.sections.elevenlabs'),
      icon: <Volume2 size={20} />,
      fields: [
        {
          key: 'elevenlabs_api_key',
          label: t('settings.fields.elevenLabsApiKey'),
          type: 'password',
          placeholder: t('settings.fields.elevenLabsApiKeyPlaceholder'),
          sensitiveField: true,
          lengthKey: 'elevenlabs_api_key_length',
          description: t('settings.fields.elevenLabsApiKeyDesc'),
          link: 'https://elevenlabs.io/app/settings/api-keys',
        },
      ],
    },
  ];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const response = await api.getSettings();
      if (response.data) {
        setSettings(response.data);
        setFormData(formDataFromSettings(response.data));
      }
    } catch (error: any) {
      console.error('加载设置失败:', error);
      show({
        message: t('settings.messages.loadFailed') + ': ' + (error?.message || t('settings.messages.unknownError')),
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const markOpenAIOAuthDisconnected = () => {
    setSettings(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        openai_oauth_connected: false,
        openai_oauth_account_id: null,
      };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const {
        api_key, mineru_token, baidu_api_key, elevenlabs_api_key, lazyllm_api_keys,
        text_api_key, image_api_key, image_caption_api_key,
        ...otherData
      } = formData;
      const payload: Parameters<typeof api.updateSettings>[0] = {
        ...otherData,
        ai_provider_format: otherData.ai_provider_format,
      };

      // Only send sensitive fields if user entered a new value
      if (api_key) payload.api_key = api_key;
      if (mineru_token) payload.mineru_token = mineru_token;
      if (baidu_api_key) payload.baidu_api_key = baidu_api_key;
      if (elevenlabs_api_key) payload.elevenlabs_api_key = elevenlabs_api_key;
      if (text_api_key) payload.text_api_key = text_api_key;
      if (image_api_key) payload.image_api_key = image_api_key;
      if (image_caption_api_key) payload.image_caption_api_key = image_caption_api_key;

      // Send lazyllm API keys (only non-empty values)
      const nonEmptyKeys = Object.fromEntries(
        Object.entries(lazyllm_api_keys).filter(([, v]) => v)
      );
      if (Object.keys(nonEmptyKeys).length > 0) {
        payload.lazyllm_api_keys = nonEmptyKeys;
      }

      const response = await api.updateSettings(payload);
      if (response.data) {
        setSettings(response.data);
        show({ message: t('settings.messages.saveSuccess'), type: 'success' });
        show({ message: t('settings.messages.testServiceTip'), type: 'info' });
        // Clear all sensitive fields after save
        setFormData(prev => ({
          ...prev,
          api_key: '', mineru_token: '', baidu_api_key: '', elevenlabs_api_key: '',
          lazyllm_api_keys: {},
          text_api_key: '', image_api_key: '', image_caption_api_key: '',
        }));
      }
    } catch (error: any) {
      console.error('保存设置失败:', error);
      show({
        message: t('settings.messages.saveFailed') + ': ' + (error?.response?.data?.error?.message || error?.message || t('settings.messages.unknownError')),
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    confirm(
      t('settings.messages.resetConfirm'),
      async () => {
        setIsSaving(true);
        try {
          const response = await api.resetSettings();
          if (response.data) {
            setSettings(response.data);
            setFormData(formDataFromSettings(response.data));
            show({ message: t('settings.messages.resetSuccess'), type: 'success' });
          }
        } catch (error: any) {
          console.error('重置设置失败:', error);
          show({
            message: t('settings.messages.resetFailed') + ': ' + (error?.message || t('settings.messages.unknownError')),
            type: 'error'
          });
        } finally {
          setIsSaving(false);
        }
      },
      {
        title: t('settings.messages.resetTitle'),
        confirmText: t('settings.messages.resetConfirmBtn'),
        cancelText: t('settings.messages.resetCancelBtn'),
        variant: 'warning',
      }
    );
  };

  const handleFieldChange = (key: string, value: any) => {
    setFormData(prev => {
      const next = { ...prev, [key]: value };

      // Per-model source key → its API base URL field, for stale-default replacement
      const perModelBaseKeys: Record<string, string> = {
        text_model_source: 'text_api_base_url',
        image_model_source: 'image_api_base_url',
        image_caption_model_source: 'image_caption_api_base_url',
      };

      if (key === 'ai_provider_format') {
        if (value === 'volcengine') {
          // Agent Plans 需要专属端点: 空值或其他 provider 的默认端点会被替换,
          // 用户显式填写的自定义 Base URL 保留
          if (KNOWN_DEFAULT_BASE_URLS.has(next.api_base_url)) {
            next.api_base_url = VOLCENGINE_AGENTPLANS_BASE_URL;
          }
        } else if (VOLCENGINE_DEFAULT_BASE_URLS.has(next.api_base_url)) {
          // 离开 Agent Plans: plan/v3 端点对新 provider 是过时默认值, 清空以
          // 回退到新 provider 的环境变量/默认端点, 自定义 URL 保留
          next.api_base_url = '';
        }
      } else if (perModelBaseKeys[key]) {
        const baseKey = perModelBaseKeys[key];
        if (value === 'volcengine') {
          // 单模型切到 Agent Plans 时同样替换过时的默认端点, 否则该模型的
          // {MODEL}_API_BASE 会优先于 VOLCENGINE_API_BASE 命中旧 provider 端点。
          if (KNOWN_DEFAULT_BASE_URLS.has(next[baseKey])) {
            next[baseKey] = VOLCENGINE_AGENTPLANS_BASE_URL;
          }
        } else if (VOLCENGINE_DEFAULT_BASE_URLS.has(next[baseKey])) {
          // 单模型离开 Agent Plans: 清空过时的 plan/v3 端点, 否则该模型的
          // {MODEL}_API_BASE 仍优先于新 provider 的默认端点
          next[baseKey] = '';
        }
      }

      return next;
    });
  };

  const applyVolcengineRecommendedModels = () => {
    const isAgentPlans = formData.ai_provider_format === 'volcengine';
    const provider = isAgentPlans ? 'volcengine' : 'doubao';
    const models = isAgentPlans ? VOLCENGINE_AGENTPLANS_RECOMMENDED_MODELS : VOLCENGINE_MODELARK_RECOMMENDED_MODELS;
    setFormData(prev => {
      // Agent Plans 需要专属端点: 只替换空值或已知的过时默认端点, 保留用户自定义端点,
      // 否则代理/替代端点部署下 per-model 调用会命中硬编码的 cn-beijing 地址
      const agentPlansBaseOrDefault = (current: string) =>
        KNOWN_DEFAULT_BASE_URLS.has(current) ? VOLCENGINE_AGENTPLANS_BASE_URL : current;
      // per-model 字段为空时继承全局解析后的端点（自定义代理端点同样生效）,
      // 因为 {MODEL}_API_BASE 的解析优先级高于 VOLCENGINE_API_BASE
      const resolvedGlobalBase = agentPlansBaseOrDefault(prev.api_base_url);
      const perModelBase = (current: string) =>
        KNOWN_DEFAULT_BASE_URLS.has(current) ? resolvedGlobalBase : current;
      return {
        ...prev,
        text_model: models.text,
        image_caption_model: models.caption,
        image_model: models.image,
        text_model_source: provider,
        image_caption_model_source: provider,
        image_model_source: provider,
        api_base_url: isAgentPlans ? agentPlansBaseOrDefault(prev.api_base_url) : prev.api_base_url,
        // per-model base 同样只替换过时默认值: 空值/默认值继承全局端点, 自定义值原样保留
        text_api_base_url: isAgentPlans ? perModelBase(prev.text_api_base_url) : prev.text_api_base_url,
        image_caption_api_base_url: isAgentPlans ? perModelBase(prev.image_caption_api_base_url) : prev.image_caption_api_base_url,
        image_api_base_url: isAgentPlans ? perModelBase(prev.image_api_base_url) : prev.image_api_base_url,
        openai_image_api_protocol: 'images',
      };
    });
  };

  const selectVolcenginePlan = () => {
    handleFieldChange('ai_provider_format', 'volcengine');
  };

  const selectApimartProvider = () => {
    setFormData(prev => ({
      ...prev,
      ai_provider_format: 'openai',
      api_base_url: APIMART_BASE_URL,
      text_model: prev.text_model_source ? prev.text_model : APIMART_RECOMMENDED_MODELS.text,
      image_model: prev.image_model_source ? prev.image_model : APIMART_RECOMMENDED_MODELS.image,
      image_caption_model: prev.image_caption_model_source
        ? prev.image_caption_model
        : APIMART_RECOMMENDED_MODELS.caption,
      openai_image_api_protocol: prev.image_model_source ? prev.openai_image_api_protocol : 'images',
    }));
  };

  const selectGlobalProvider = (provider: string) => {
    if (provider === 'apimart') {
      selectApimartProvider();
      return;
    }
    if (usesApimartProvider) {
      setFormData(prev => ({
        ...prev,
        ai_provider_format: provider,
        api_base_url: provider === 'openai'
          ? OPENAI_BASE_URL
          : provider === 'volcengine'
            ? VOLCENGINE_AGENTPLANS_BASE_URL
            : '',
      }));
      return;
    }
    handleFieldChange('ai_provider_format', provider);
  };

  const isApimartPlanActive = usesApimartProvider;
  const isVolcenginePlanActive = formData.ai_provider_format === 'volcengine';

  const providerPromotions = [
    {
      key: 'apimart',
      testId: 'provider-plan-apimart',
      active: isApimartPlanActive,
      name: t('settings.providerComparison.apimart.name'),
      tagline: t('settings.providerComparison.apimart.tagline'),
      suitedFor: t('settings.providerComparison.apimart.suitedFor'),
      points: [
        t('settings.providerComparison.apimart.point1'),
        t('settings.providerComparison.apimart.point2'),
        t('settings.providerComparison.apimart.point3'),
      ],
      cta: t('settings.providerComparison.apimart.cta'),
      activeLabel: t('settings.providerComparison.apimart.active'),
      note: t('settings.providerComparison.apimart.note'),
      onSelect: selectApimartProvider,
      href: APIMART_SIGNUP_URL,
      linkLabel: t('settings.providerComparison.apimart.link'),
    },
    {
      key: 'volcengine',
      testId: 'provider-plan-volcengine',
      active: isVolcenginePlanActive,
      name: t('settings.providerComparison.volcengine.name'),
      tagline: t('settings.providerComparison.volcengine.tagline'),
      suitedFor: t('settings.providerComparison.volcengine.suitedFor'),
      points: [
        t('settings.providerComparison.volcengine.point1'),
        t('settings.providerComparison.volcengine.point2'),
        t('settings.providerComparison.volcengine.point3'),
      ],
      cta: t('settings.providerComparison.volcengine.cta'),
      activeLabel: t('settings.providerComparison.volcengine.active'),
      note: t('settings.providerComparison.volcengine.note'),
      onSelect: selectVolcenginePlan,
      href: volcengineAgentPlansUrl,
      linkLabel: t('settings.providerComparison.volcengine.link'),
    },
  ];

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
      if (formData.ai_provider_format) {
        testSettings.ai_provider_format = formData.ai_provider_format;
      }
      if (formData.text_model) testSettings.text_model = formData.text_model;
      if (formData.image_model) testSettings.image_model = formData.image_model;
      if (formData.image_caption_model) testSettings.image_caption_model = formData.image_caption_model;
      if (formData.mineru_api_base) testSettings.mineru_api_base = formData.mineru_api_base;
      if (formData.mineru_token) testSettings.mineru_token = formData.mineru_token;
      if (formData.baidu_api_key) testSettings.baidu_api_key = formData.baidu_api_key;
      if (formData.image_resolution) testSettings.image_resolution = formData.image_resolution;

      // Per-model provider source overrides (always send, even empty, to clear saved values)
      testSettings.text_model_source = formData.text_model_source || '';
      testSettings.image_model_source = formData.image_model_source || '';
      testSettings.image_caption_model_source = formData.image_caption_model_source || '';

      // Per-model API credentials
      if (formData.text_api_key) testSettings.text_api_key = formData.text_api_key;
      if (formData.text_api_base_url) testSettings.text_api_base_url = formData.text_api_base_url;
      if (formData.image_api_key) testSettings.image_api_key = formData.image_api_key;
      if (formData.image_api_base_url) testSettings.image_api_base_url = formData.image_api_base_url;
      if (formData.image_caption_api_key) testSettings.image_caption_api_key = formData.image_caption_api_key;
      if (formData.image_caption_api_base_url) testSettings.image_caption_api_base_url = formData.image_caption_api_base_url;

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

      // isActive tracks whether this test round is still pending — avoids stale closure
      let isActive = true;
      // eslint-disable-next-line prefer-const
      let pollInterval: ReturnType<typeof setInterval>;
      const finish = (nextState: ServiceTestState, toastMsg: string, toastType: 'success' | 'error') => {
        if (!isActive) return;
        isActive = false;
        clearInterval(pollInterval);
        updateServiceTest(key, nextState);
        show({ message: toastMsg, type: toastType });
      };

      // 开始轮询任务状态
      pollInterval = setInterval(async () => {
        try {
          const statusResponse = await api.getTestStatus(taskId);
          const statusData = statusResponse?.data;
          if (!statusData) {
            throw new Error(t('settings.serviceTest.testFailed'));
          }
          const taskStatus = statusData.status;

          if (taskStatus === 'COMPLETED') {
            const detail = formatDetail(statusData.result || {});
            const message = statusData.message || t('settings.messages.testSuccess');
            finish({ status: 'success', message, detail }, message, 'success');
          } else if (taskStatus === 'FAILED') {
            const errorMessage = statusData.error || t('settings.serviceTest.testFailed');
            if (statusData.openai_oauth_disconnected) {
              markOpenAIOAuthDisconnected();
            }
            finish({ status: 'error', message: errorMessage }, `${t('settings.serviceTest.testFailed')}: ${errorMessage}`, 'error');
          }
          // 如果是 PENDING 或 PROCESSING，继续轮询
        } catch (pollError: any) {
          const errorMessage = pollError?.response?.data?.error?.message || pollError?.message || t('settings.serviceTest.testFailed');
          finish({ status: 'error', message: errorMessage }, `${t('settings.serviceTest.testFailed')}: ${errorMessage}`, 'error');
        }
      }, 2000); // 每2秒轮询一次

      // 设置最大轮询时间（2分钟）
      setTimeout(() => {
        finish({ status: 'error', message: t('settings.serviceTest.testTimeout') }, t('settings.serviceTest.testTimeout'), 'error');
      }, 600000); // 10 分钟，覆盖 gpt-image-2 等慢模型的生成时间

    } catch (error: any) {
      const errorMessage = error?.response?.data?.error?.message || error?.message || t('common.unknownError');
      updateServiceTest(key, { status: 'error', message: errorMessage });
      show({ message: `${t('settings.serviceTest.testFailed')}: ${errorMessage}`, type: 'error' });
    }
  };

  const renderField = (field: FieldConfig) => <SettingsField
    key={field.key} field={field} value={formData[field.key] as string | number | boolean}
    placeholder={field.sensitiveField && settings && field.lengthKey && (settings[field.lengthKey] as number) > 0
      ? t('settings.fields.apiKeySet', { length: settings[field.lengthKey] as number }) : field.placeholder || ''}
    isDisabled={(field.key === 'text_thinking_budget' && !formData.enable_text_reasoning)
      || (field.key === 'image_thinking_budget' && !formData.enable_image_reasoning)}
    onChange={value => handleFieldChange(field.key, value)} t={t}
  />;

  // 模型配置项定义：每种模型类型的 key、source key、api key/base key、标签等
  const modelConfigItems = [
    {
      modelKey: 'text_model' as keyof typeof initialFormData,
      sourceKey: 'text_model_source' as keyof typeof initialFormData,
      apiKeyKey: 'text_api_key' as keyof typeof initialFormData,
      apiBaseKey: 'text_api_base_url' as keyof typeof initialFormData,
      apiKeyLengthKey: 'text_api_key_length' as keyof SettingsType,
      label: t('settings.fields.textModel'),
      placeholder: t('settings.fields.textModelPlaceholder'),
      description: t('settings.fields.textModelDesc'),
      sourceLabel: t('settings.fields.textModelSource'),
    },
    {
      modelKey: 'image_model' as keyof typeof initialFormData,
      sourceKey: 'image_model_source' as keyof typeof initialFormData,
      apiKeyKey: 'image_api_key' as keyof typeof initialFormData,
      apiBaseKey: 'image_api_base_url' as keyof typeof initialFormData,
      apiKeyLengthKey: 'image_api_key_length' as keyof SettingsType,
      label: t('settings.fields.imageModel'),
      placeholder: t('settings.fields.imageModelPlaceholder'),
      description: t('settings.fields.imageModelDesc'),
      sourceLabel: t('settings.fields.imageModelSource'),
    },
    {
      modelKey: 'image_caption_model' as keyof typeof initialFormData,
      sourceKey: 'image_caption_model_source' as keyof typeof initialFormData,
      apiKeyKey: 'image_caption_api_key' as keyof typeof initialFormData,
      apiBaseKey: 'image_caption_api_base_url' as keyof typeof initialFormData,
      apiKeyLengthKey: 'image_caption_api_key_length' as keyof SettingsType,
      label: t('settings.fields.imageCaptionModel'),
      placeholder: t('settings.fields.imageCaptionModelPlaceholder'),
      description: t('settings.fields.imageCaptionModelDesc'),
      sourceLabel: t('settings.fields.imageCaptionModelSource'),
    },
  ];

  // 渲染单个模型配置组（模型名 + 提供商选择 + 条件凭证）
  const renderModelConfigGroup = (item: typeof modelConfigItems[0]) => {
    const sourceValue = formData[item.sourceKey] as string;
    const isApiKeyProvider = API_KEY_PROVIDERS.has(sourceValue);
    const isLazyllm = sourceValue && isLazyllmVendor(sourceValue);
    // 'openai' in source dropdown means OpenAI format (API key provider), not lazyllm openai vendor
    // lazyllm openai vendor is handled separately

    return (
      <div key={item.modelKey} className="pb-6 border-b border-gray-200 dark:border-border-primary last:border-b-0 last:pb-0 space-y-3">
        {/* 模型名称 */}
        <Input
          label={item.label}
          type="text"
          placeholder={item.placeholder}
          value={formData[item.modelKey] as string}
          onChange={(e) => handleFieldChange(item.modelKey, e.target.value)}
        />
        {item.description && (
          <p className="-mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">{item.description}</p>
        )}

        {/* 提供商选择 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">
            {item.sourceLabel}
          </label>
          <select
            data-testid={`${String(item.sourceKey)}-select`}
            value={sourceValue}
            onChange={(e) => handleFieldChange(item.sourceKey, e.target.value)}
            className="w-full h-10 px-4 rounded-lg border border-gray-200 dark:border-border-primary bg-white dark:bg-background-secondary focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent"
          >
            <option value="">{t('settings.fields.modelProviderPlaceholder')}</option>
            {allProviderSources
              .filter(option =>
                item.sourceKey !== 'image_model_source'
                || isImageModelSourceSelectable(option.value)
              )
              .map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={option.value === 'codex' && !settings?.openai_oauth_connected}
                >
                  {option.label}{option.value === 'codex' && !settings?.openai_oauth_connected ? ` (${t('settings.openaiOAuth.disconnected')})` : ''}
                </option>
              ))
              .concat(
                // A previously saved image source may no longer be selectable
                // (vendor without image capability). Keep it visible so users
                // can see the current value instead of a silently-empty
                // dropdown that would round-trip the stale value on save.
                item.sourceKey === 'image_model_source'
                && formData.image_model_source
                && (
                  !allProviderSources.some(o => o.value === formData.image_model_source)
                  || !isImageModelSourceSelectable(formData.image_model_source)
                )
                  ? [(
                    <option key={formData.image_model_source} value={formData.image_model_source}>
                      {LAZYLLM_SOURCES.find(s => s.value === formData.image_model_source)?.label || formData.image_model_source} ({t('settings.fields.imageSourceUnavailable')})
                    </option>
                  )]
                  : []
              )}
          </select>
          <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">
            {t('settings.fields.modelProviderDesc')}
          </p>
          {item.sourceKey === 'image_model_source' && sourceValue === 'sensenova' && (
            <p data-testid="sensenova-image-model-hint" className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              {t('settings.fields.sensenovaImageHint')}
            </p>
          )}
        </div>

        {/* Gemini/OpenAI/Volcengine 提供商：显示 API Key + Base URL */}
        {isApiKeyProvider && (
          <div className="space-y-3 pl-3 border-l-2 border-banana-300 dark:border-banana-600">
            <Input
              label={t('settings.fields.perModelApiBaseUrl')}
              type="text"
              placeholder={t('settings.fields.perModelApiBaseUrlPlaceholder')}
              value={formData[item.apiBaseKey] as string}
              onChange={(e) => handleFieldChange(item.apiBaseKey, e.target.value)}
            />
            <div>
              <Input
                label={t('settings.fields.perModelApiKey')}
                type="password"
                placeholder={
                  settings && (settings[item.apiKeyLengthKey] as number) > 0
                    ? t('settings.fields.perModelApiKeySet', { length: settings[item.apiKeyLengthKey] as number })
                    : t('settings.fields.perModelApiKeyPlaceholder')
                }
                value={formData[item.apiKeyKey] as string}
                onChange={(e) => handleFieldChange(item.apiKeyKey, e.target.value)}
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">
                {t('settings.fields.perModelApiKeyDesc')}
              </p>
            </div>
          </div>
        )}

        {/* Image API Protocol: for image model when effective provider is OpenAI-compatible */}
        {item.sourceKey === 'image_model_source' && (
          sourceValue === 'openai'
          || sourceValue === 'volcengine'
          || (!sourceValue && ['openai', 'volcengine'].includes(formData.ai_provider_format))
        ) && (
          <div className="pl-3 border-l-2 border-banana-300 dark:border-banana-600">
            <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">
              {t('settings.fields.imageApiProtocol')}
            </label>
            <select
              data-testid="openai-image-api-protocol-select"
              value={formData.openai_image_api_protocol}
              onChange={(e) => handleFieldChange('openai_image_api_protocol', e.target.value)}
              className="w-full h-10 px-4 rounded-lg border border-gray-200 dark:border-border-primary bg-white dark:bg-background-secondary focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent"
            >
              <option value="auto">{t('settings.fields.imageApiProtocolAuto')}</option>
              <option value="images">{t('settings.fields.imageApiProtocolImages')}</option>
              <option value="chat">{t('settings.fields.imageApiProtocolChat')}</option>
            </select>
            <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">
              {t('settings.fields.imageApiProtocolDesc')}
            </p>
          </div>
        )}

        {/* LazyLLM 厂商：显示厂商 API Key */}
        {isLazyllm && (() => {
          const vendorLabel = LAZYLLM_SOURCES.find(s => s.value === sourceValue)?.label || sourceValue.toUpperCase();
          const keyLength = settings?.lazyllm_api_keys_info?.[sourceValue] || 0;
          const placeholder = keyLength > 0
            ? t('settings.fields.vendorApiKeySet', { length: keyLength })
            : t('settings.fields.vendorApiKeyPlaceholder', { vendor: vendorLabel });
          return (
            <div className="pl-3 border-l-2 border-amber-300 dark:border-amber-600">
              <Input
                label={t('settings.fields.vendorApiKey', { vendor: vendorLabel })}
                type="password"
                placeholder={placeholder}
                value={formData.lazyllm_api_keys[sourceValue] || ''}
                onChange={(e) => {
                  setFormData(prev => ({
                    ...prev,
                    lazyllm_api_keys: { ...prev.lazyllm_api_keys, [sourceValue]: e.target.value }
                  }));
                }}
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">
                {t('settings.fields.vendorApiKeyDesc')}
              </p>
            </div>
          );
        })()}
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
        {/* 默认 API 配置区块 */}
        <div data-testid="global-api-config-section">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground-primary mb-1 flex items-center">
            <Key size={20} />
            <span className="ml-2">{t('settings.sections.apiConfig')}</span>
          </h2>
          <p className="text-sm text-gray-500 dark:text-foreground-tertiary mb-4">{t('settings.sections.apiConfigDesc')}</p>
          <div className="space-y-3">
            {/* 默认提供商胶囊选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">
                {t('settings.fields.aiProviderFormat')}
              </label>
              <SettingsProviderPicker
                label={t('settings.fields.aiProviderFormat')}
                globalProviderSources={globalProviderSources.map(option => ({ ...option,
                  disabled: option.value === 'codex' && !settings?.openai_oauth_connected,
                  hint: option.value === 'volcengine' ? t('settings.volcenginePromo.providerHint')
                    : option.value === 'apimart' ? t('settings.providerComparison.apimart.providerHint') : null,
                }))}
                selectedGlobalProvider={selectedGlobalProvider}
                providerPromotions={providerPromotions}
                selectGlobalProvider={selectGlobalProvider}
                disabledLabel={t('settings.openaiOAuth.disconnected')}
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">{t('settings.fields.aiProviderFormatDesc')}</p>
              {formData.ai_provider_format === 'sensenova' && (
                <p data-testid="sensenova-global-image-hint" className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  {t('settings.fields.sensenovaImageHint')}
                </p>
              )}
            </div>

            {/* Gemini/OpenAI/Volcengine: API Key + Base URL */}
            {API_KEY_PROVIDERS.has(formData.ai_provider_format) && (
              <div className="space-y-3 pl-3 border-l-2 border-banana-300 dark:border-banana-600">
                <Input
                  label={t('settings.fields.apiBaseUrl')}
                  type="text"
                  placeholder={t('settings.fields.apiBaseUrlPlaceholder')}
                  value={formData.api_base_url}
                  onChange={(e) => handleFieldChange('api_base_url', e.target.value)}
                />
                <p className="-mt-2 text-sm text-gray-500 dark:text-foreground-tertiary">{t('settings.fields.apiBaseUrlDesc')}</p>
                {formData.ai_provider_format === 'volcengine' &&
                  formData.api_base_url &&
                  formData.api_base_url !== VOLCENGINE_AGENTPLANS_BASE_URL && (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-700 dark:bg-amber-950/40">
                      <p className="flex-1 text-xs text-amber-800 dark:text-amber-200">{t('settings.fields.volcengineBaseUrlHint')}</p>
                      <button
                        type="button"
                        onClick={() => handleFieldChange('api_base_url', VOLCENGINE_AGENTPLANS_BASE_URL)}
                        className="shrink-0 rounded-md bg-amber-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-600"
                      >
                        {t('settings.fields.volcengineBaseUrlReset')}
                      </button>
                    </div>
                  )}
                <div>
                  <Input
                    label={t('settings.fields.apiKey')}
                    type="password"
                    placeholder={
                      settings && (settings.api_key_length as number) > 0
                        ? t('settings.fields.apiKeySet', { length: settings.api_key_length })
                        : t('settings.fields.apiKeyPlaceholder')
                    }
                    value={formData.api_key}
                    onChange={(e) => handleFieldChange('api_key', e.target.value)}
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">{t('settings.fields.apiKeyDesc')}</p>
                </div>
              </div>
            )}

            {/* LazyLLM 厂商: 厂商 API Key */}
            {isLazyllmVendor(formData.ai_provider_format) && (
              <GlobalVendorKeyInput vendor={formData.ai_provider_format} formData={formData} setFormData={setFormData} settings={settings} t={t} />
            )}
          </div>

          <SettingsApiGuidance
            t={t} usesVolcengineCampaignPromo={usesVolcengineCampaignPromo}
            providerFormat={formData.ai_provider_format} volcengineAgentPlansUrl={volcengineAgentPlansUrl}
            volcengineLogoUrl={volcengineLogoUrl} isZh={isZh} activeVolcenginePromoKey={activeVolcenginePromoKey}
            activeApiKeyHelpKey={activeApiKeyHelpKey} activeApiKeyTipKey={activeApiKeyTipKey}
            activeApiKeyHelpUrl={activeApiKeyHelpUrl} copyToClipboard={copyToClipboard}
            applyVolcengineRecommendedModels={applyVolcengineRecommendedModels}
          />
        </div>

        {/* 模型配置区块 */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground-primary mb-4 flex items-center">
            <FileText size={20} />
            <span className="ml-2">{t('settings.sections.modelConfig')}</span>
          </h2>
          <div className="space-y-4">
            {modelConfigItems.map(renderModelConfigGroup)}
          </div>
        </div>

        {/* 其余配置区块（配置驱动，排除性能配置和推理模式） */}
        <div className="space-y-8">
          {settingsSections.filter((section) =>
            section.title !== t('settings.sections.performanceConfig') &&
            section.title !== t('settings.sections.textReasoning') &&
            section.title !== t('settings.sections.imageReasoning')
          ).map((section) => (
            <div key={section.title}>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground-primary mb-4 flex items-center">
                {section.icon}
                <span className="ml-2">{section.title}</span>
              </h2>
              <div className="space-y-4">
                {section.fields.map((field) => renderField(field))}
              </div>
            </div>
          ))}
        </div>

        {/* 高级设置（折叠区域） */}
        <SettingsAdvanced open={advancedOpen} onToggle={() => setAdvancedOpen(!advancedOpen)} label={t('settings.sections.advancedSettings')}>
              {isDesktop && <DataStorageSettings />}

              {/* OpenAI OAuth 连接区块 */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground-primary mb-1 flex items-center">
                  <Link2 size={20} />
                  <span className="ml-2">{t('settings.openaiOAuth.title')}</span>
                </h2>
                <p className="text-sm text-gray-500 dark:text-foreground-tertiary mb-4">{t('settings.openaiOAuth.description')}</p>
                <div className="p-4 border border-gray-200 dark:border-border-primary rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${settings?.openai_oauth_connected ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-foreground-secondary">
                          {settings?.openai_oauth_connected ? t('settings.openaiOAuth.connected') : t('settings.openaiOAuth.disconnected')}
                        </span>
                        {settings?.openai_oauth_connected && settings?.openai_oauth_account_id && (
                          <span className="ml-2 text-sm text-gray-500 dark:text-foreground-tertiary">
                            ({settings.openai_oauth_account_id})
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      {settings?.openai_oauth_connected ? (
                        <button
                          onClick={handleOAuthDisconnect}
                          className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                        >
                          {t('settings.openaiOAuth.disconnectBtn')}
                        </button>
                      ) : (
                        <button
                          onClick={handleOAuthLogin}
                          disabled={oauthConnecting}
                          className="px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50"
                        >
                          {oauthConnecting ? t('settings.openaiOAuth.connecting') : t('settings.openaiOAuth.loginBtn')}
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-gray-500 dark:text-foreground-tertiary">{t('settings.openaiOAuth.hint')}</p>
                  {!settings?.openai_oauth_connected && (
                    <div className="mt-3">
                      <button
                        onClick={() => setManualCallbackOpen(v => !v)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {t('settings.openaiOAuth.manualCallbackLabel')}
                      </button>
                      {manualCallbackOpen && (
                        <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                          <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">{t('settings.openaiOAuth.manualCallbackHint')}</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={manualCallbackUrl}
                              onChange={(e) => setManualCallbackUrl(e.target.value)}
                              placeholder={t('settings.openaiOAuth.manualCallbackPlaceholder')}
                              className="flex-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-border-primary rounded-md bg-white dark:bg-background-secondary text-gray-900 dark:text-foreground-primary placeholder-gray-400"
                            />
                            <button
                              onClick={handleManualCallback}
                              disabled={manualCallbackSubmitting || !manualCallbackUrl.trim()}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-md hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50"
                            >
                              {t('settings.openaiOAuth.manualCallbackSubmit')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 并发性能配置 + 推理模式 */}
              {settingsSections.filter((section) =>
                section.title === t('settings.sections.performanceConfig') ||
                section.title === t('settings.sections.textReasoning') ||
                section.title === t('settings.sections.imageReasoning')
              ).map((section) => (
                <div key={section.title}>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground-primary mb-4 flex items-center">
                    {section.icon}
                    <span className="ml-2">{section.title}</span>
                  </h2>
                  <div className="space-y-4">
                    {section.fields.map((field) => renderField(field))}
                  </div>
                </div>
              ))}
        </SettingsAdvanced>

        {/* 服务测试区 */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-foreground-primary mb-2 flex items-center">
            <FileText size={20} />
            <span className="ml-2">{t('settings.serviceTest.title')}</span>
          </h2>
          <p className="text-sm text-gray-500 dark:text-foreground-tertiary">
            {t('settings.serviceTest.description')}
          </p>
          <div className="pl-4 border-l-4 border-yellow-300 dark:border-yellow-600">
            <p className="text-sm text-gray-700 dark:text-foreground-secondary flex items-start gap-1.5">
              <Lightbulb size={15} className="flex-shrink-0 mt-0.5" />
              {t('settings.serviceTest.tip')}
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
                <SettingsServiceRow key={item.key} title={t(item.titleKey)} description={t(item.descriptionKey)} action={
                  <Button variant="secondary" size="sm" loading={isLoadingTest} onClick={() => handleServiceTest(item.key, item.action, item.formatDetail)}>
                    {isLoadingTest ? t('settings.serviceTest.testing') : t('settings.serviceTest.startTest')}
                  </Button>
                }>
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
                </SettingsServiceRow>
              );
            })}
          </div>
        </div>

        {/* 操作按钮 */}
        <SettingsActions>
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
        </SettingsActions>

        <SettingsAbout t={t} />
      </div>
    </>
  );
};

// SettingsPage 组件 - 完整页面包装
export const SettingsPage: React.FC = () => <SettingsPageFrame><Settings /></SettingsPageFrame>;
