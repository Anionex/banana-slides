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
}

interface OutlineRecoverySuppression {
  path: string;
  createdAt: number;
}

let inMemoryOutlineRecoverySuppression: OutlineRecoverySuppression | null = null;

function markOutlineRecoverySuppression(path: string) {
  if (!/\/outline(?:[?#]|$)/.test(path)) return;

  const suppression = { path, createdAt: Date.now() };
  inMemoryOutlineRecoverySuppression = suppression;

  try {
    sessionStorage.setItem(OUTLINE_RECOVERY_SUPPRESSION_KEY, JSON.stringify(suppression));
  } catch {
    // The in-memory marker still covers SPA navigation when storage is unavailable.
  }
}

export function consumeOutlineRecoverySuppression(path: string): boolean {
  let suppression = inMemoryOutlineRecoverySuppression;
  inMemoryOutlineRecoverySuppression = null;

  try {
    const raw = sessionStorage.getItem(OUTLINE_RECOVERY_SUPPRESSION_KEY);
    sessionStorage.removeItem(OUTLINE_RECOVERY_SUPPRESSION_KEY);
    if (raw) {
      suppression = JSON.parse(raw) as OutlineRecoverySuppression;
    }
  } catch {
    // Fall through to the in-memory marker.
  }

  return suppression?.path === path
    && typeof suppression.createdAt === 'number'
    && Date.now() - suppression.createdAt <= RECOVERY_SUPPRESSION_TTL_MS;
}

export function useApiSettingsRecovery() {
  const navigate = useNavigate();
  const location = useLocation();
  const { i18n } = useTranslation();
  const isZh = i18n.language?.startsWith('zh') ?? true;

  const openApiSettings = useCallback(() => {
    const from = `${location.pathname}${location.search}${location.hash}`;
    markOutlineRecoverySuppression(from);
    const state: ApiSettingsRecoveryState = {
      from,
      recovery: API_ERROR_RECOVERY,
    };
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
