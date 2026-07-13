export const OPENAI_OAUTH_POLL_INTERVAL_MS = 1000;
export const OPENAI_OAUTH_TIMEOUT_MS = 2 * 60 * 1000;

export interface OpenAIOAuthStatus {
  connected: boolean;
  account_id: string | null;
}

export type OpenAIOAuthFailureReason = 'callback_error' | 'popup_closed' | 'timeout';

interface OpenAIOAuthMonitorOptions {
  desktop: boolean;
  popup: Window | null;
  getStatus: () => Promise<OpenAIOAuthStatus | null>;
  onConnected: (status: OpenAIOAuthStatus) => void;
  onFailure: (reason: OpenAIOAuthFailureReason, message?: string) => void;
  eventTarget?: Window;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

export interface OpenAIOAuthMonitor {
  stop: () => void;
}

/**
 * Watches an OAuth flow across both browser popups and Electron's external browser.
 * Desktop cannot rely on window.opener, so the backend status remains the source of truth.
 */
export function startOpenAIOAuthMonitor({
  desktop,
  popup,
  getStatus,
  onConnected,
  onFailure,
  eventTarget = window,
  pollIntervalMs = OPENAI_OAUTH_POLL_INTERVAL_MS,
  timeoutMs = OPENAI_OAUTH_TIMEOUT_MS,
}: OpenAIOAuthMonitorOptions): OpenAIOAuthMonitor {
  let stopped = false;
  let checking = false;
  let callbackSucceeded = false;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    eventTarget.removeEventListener('message', onMessage);
    eventTarget.removeEventListener('focus', onFocus);
    clearInterval(pollTimer);
    clearTimeout(timeoutTimer);
  };

  const finishFailure = (reason: OpenAIOAuthFailureReason, message?: string) => {
    if (stopped) return;
    stop();
    onFailure(reason, message);
  };

  const checkStatus = async () => {
    if (stopped || checking) return;
    checking = true;
    try {
      const status = await getStatus();
      if (!stopped && status?.connected) {
        stop();
        onConnected(status);
      }
    } catch {
      // Transient status failures are retried until the OAuth deadline.
    } finally {
      checking = false;
    }
  };

  function onMessage(event: MessageEvent) {
    if (event.data?.type !== 'openai-oauth-callback') return;
    if (!event.data.success) {
      finishFailure('callback_error', event.data.message);
      return;
    }
    callbackSucceeded = true;
    void checkStatus();
  }

  function onFocus() {
    if (desktop) void checkStatus();
  }

  const pollTimer = setInterval(() => {
    if (!desktop && popup?.closed && !callbackSucceeded) {
      finishFailure('popup_closed');
      return;
    }
    if (desktop || callbackSucceeded) void checkStatus();
  }, pollIntervalMs);

  const timeoutTimer = setTimeout(() => {
    finishFailure('timeout');
  }, timeoutMs);

  eventTarget.addEventListener('message', onMessage);
  if (desktop) eventTarget.addEventListener('focus', onFocus);
  if (desktop) void checkStatus();

  return { stop };
}
