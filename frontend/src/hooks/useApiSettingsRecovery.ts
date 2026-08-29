import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ToastOptions } from '@/components/shared/Toast';
import { isApiSettingsError } from '@/utils';

export const API_ERROR_RECOVERY = 'api-error' as const;
const OUTLINE_RECOVERY_SUPPRESSION_KEY = 'banana-outline-api-recovery-suppression';
const RECOVERY_SUPPRESSION_TTL_MS = 30 * 60 * 1000;

export interface ApiSettingsRecoveryState {
  from: string;
  fromState?: unknown;
  openedFrom: string;
  recovery: typeof API_ERROR_RECOVERY;
}

interface OutlineRecoverySuppression {
  path: string;
  createdAt: number;
}

let inMemoryOutlineRecoverySuppression: OutlineRecoverySuppression | null = null;

function getCurrentRoutePath(): string {
  if (typeof window === 'undefined') return '/';
  if (window.location.hash.startsWith('#/')) {
    return window.location.hash.slice(1);
  }
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function getCurrentRouteState(): unknown {
  if (typeof window === 'undefined') return undefined;
  return window.history.state?.usr;
}

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

  try {
    const raw = sessionStorage.getItem(OUTLINE_RECOVERY_SUPPRESSION_KEY);
    if (raw) {
      suppression = JSON.parse(raw) as OutlineRecoverySuppression;
    }
  } catch {
    try {
      sessionStorage.removeItem(OUTLINE_RECOVERY_SUPPRESSION_KEY);
    } catch {
      // The in-memory marker can still be used.
    }
  }

  if (!suppression || typeof suppression.path !== 'string' || typeof suppression.createdAt !== 'number') {
    inMemoryOutlineRecoverySuppression = null;
    try {
      sessionStorage.removeItem(OUTLINE_RECOVERY_SUPPRESSION_KEY);
    } catch {
      // Nothing else to clean up.
    }
    return false;
  }

  const expired = Date.now() - suppression.createdAt > RECOVERY_SUPPRESSION_TTL_MS;
  if (!expired && suppression.path !== path) return false;

  inMemoryOutlineRecoverySuppression = null;
  try {
    sessionStorage.removeItem(OUTLINE_RECOVERY_SUPPRESSION_KEY);
  } catch {
    // The in-memory marker is already cleared.
  }
  return !expired;
}

export function useApiSettingsRecovery() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isZh = i18n.language?.startsWith('zh') ?? true;

  const openApiSettings = useCallback((fromOverride?: string, fromStateOverride?: unknown) => {
    const currentPath = getCurrentRoutePath();
    const from = fromOverride?.startsWith('/') && !fromOverride.startsWith('//')
      ? fromOverride
      : currentPath;
    markOutlineRecoverySuppression(from);
    const state: ApiSettingsRecoveryState = {
      from,
      fromState: fromStateOverride !== undefined ? fromStateOverride : getCurrentRouteState(),
      openedFrom: currentPath,
      recovery: API_ERROR_RECOVERY,
    };
    navigate('/settings', { state });
  }, [navigate]);

  const withApiSettingsRecovery = useCallback((
    error: unknown,
    options: ToastOptions,
    recoveryFrom?: string,
    recoveryState?: unknown,
  ): ToastOptions => {
    if (!isApiSettingsError(error) && !isApiSettingsError(options.message)) return options;

    return {
      ...options,
      duration: options.duration ?? 10000,
      actionLabel: isZh ? '检查 API 设置' : 'Check API Settings',
      onAction: () => openApiSettings(recoveryFrom, recoveryState),
    };
  }, [isZh, openApiSettings]);

  return { openApiSettings, withApiSettingsRecovery };
}
