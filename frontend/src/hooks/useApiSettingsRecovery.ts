import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ToastOptions } from '@/components/shared/Toast';
import { isApiSettingsError } from '@/utils';

export const API_ERROR_RECOVERY = 'api-error' as const;

export interface ApiSettingsRecoveryState {
  from: string;
  recovery: typeof API_ERROR_RECOVERY;
}

export function useApiSettingsRecovery() {
  const navigate = useNavigate();
  const location = useLocation();
  const { i18n } = useTranslation();
  const isZh = i18n.language?.startsWith('zh') ?? true;

  const openApiSettings = useCallback(() => {
    const from = `${location.pathname}${location.search}${location.hash}`;
    const state: ApiSettingsRecoveryState = { from, recovery: API_ERROR_RECOVERY };
    navigate('/settings', { state });
  }, [location.hash, location.pathname, location.search, navigate]);

  const withApiSettingsRecovery = useCallback((error: unknown, options: ToastOptions): ToastOptions => {
    if (!isApiSettingsError(error) && !isApiSettingsError(options.message)) return options;

    return {
      ...options,
      duration: options.duration ?? 10000,
      actionLabel: isZh ? '检查 API 设置' : 'Check API Settings',
      onAction: openApiSettings,
    };
  }, [isZh, openApiSettings]);

  return { openApiSettings, withApiSettingsRecovery };
}
