import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ToastOptions } from '@/components/shared/Toast';
import { isApiSettingsError } from '@/utils';

export const API_ERROR_RECOVERY = 'api-error' as const;
const OUTLINE_RECOVERY_SUPPRESSION_KEY = 'banana-outline-api-recovery-suppression';
const RECOVERY_SUPPRESSION_TTL_MS = 30 * 60 * 1000;

export interface ApiSettingsRecoveryState {
  from: string;
  recovery: typeof API_ERROR_RECOVERY;
  sourceState?: Record<string, unknown>;
}

function markOutlineRecoverySuppression(path: string) {
  if (!/\/outline(?:[?#]|$)/.test(path)) return;

  try {
    sessionStorage.setItem(OUTLINE_RECOVERY_SUPPRESSION_KEY, JSON.stringify({
      path,
      createdAt: Date.now(),
    }));
  } catch {
    // Route state still suppresses retries for the explicit Settings actions.
  }
}

export function consumeOutlineRecoverySuppression(path: string): boolean {
  try {
    const raw = sessionStorage.getItem(OUTLINE_RECOVERY_SUPPRESSION_KEY);
    if (!raw) return false;

    sessionStorage.removeItem(OUTLINE_RECOVERY_SUPPRESSION_KEY);
    const parsed = JSON.parse(raw) as { path?: unknown; createdAt?: unknown };
    return parsed.path === path
      && typeof parsed.createdAt === 'number'
      && Date.now() - parsed.createdAt <= RECOVERY_SUPPRESSION_TTL_MS;
  } catch {
    return false;
  }
}

export function useApiSettingsRecovery() {
  const navigate = useNavigate();
  const location = useLocation();
  const { i18n } = useTranslation();
  const isZh = i18n.language?.startsWith('zh') ?? true;

  const openApiSettings = useCallback(() => {
    const from = `${location.pathname}${location.search}${location.hash}`;
    markOutlineRecoverySuppression(from);
    const sourceState = location.state
      && typeof location.state === 'object'
      && !Array.isArray(location.state)
      ? location.state as Record<string, unknown>
      : undefined;
    const state: ApiSettingsRecoveryState = {
      from,
      recovery: API_ERROR_RECOVERY,
      ...(sourceState ? { sourceState } : {}),
    };
    navigate('/settings', { state });
  }, [location.hash, location.pathname, location.search, location.state, navigate]);

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
