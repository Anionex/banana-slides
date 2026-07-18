export const OPENAI_OAUTH_POLL_INTERVAL_MS = 1000;
export const OPENAI_OAUTH_TIMEOUT_MS = 2 * 60 * 1000;
export const OPENAI_OAUTH_CALLBACK_ORIGIN = 'http://localhost:1455';

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
  checkNow: () => Promise<void>;
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
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    eventTarget.removeEventListener('message', onMessage);
    eventTarget.removeEventListener('focus', onFocus);
    if (pollTimer !== null) clearInterval(pollTimer);
    if (timeoutTimer !== null) clearTimeout(timeoutTimer);
  };

  const finishFailure = (reason: OpenAIOAuthFailureReason, message?: string) => {
    if (stopped) return;
    stop();
    onFailure(reason, message);
  };

  const checkStatus = async () => {
    if (stopped || checking) return;
    checking = true;
    let status: OpenAIOAuthStatus | null = null;
    try {
      status = await getStatus();
    } catch {
      // Transient status failures are retried until the OAuth deadline.
    } finally {
      checking = false;
    }

    if (!stopped && status?.connected) {
      stop();
      onConnected(status);
    }
  };

  function onMessage(event: MessageEvent) {
    if (event.origin !== OPENAI_OAUTH_CALLBACK_ORIGIN) return;
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

  pollTimer = setInterval(() => {
    if (!desktop && popup?.closed && !callbackSucceeded) {
      finishFailure('popup_closed');
      return;
    }
    if (desktop || callbackSucceeded) void checkStatus();
  }, pollIntervalMs);

  timeoutTimer = setTimeout(() => {
    finishFailure('timeout');
  }, timeoutMs);

  eventTarget.addEventListener('message', onMessage);
  if (desktop) eventTarget.addEventListener('focus', onFocus);
  if (desktop) void checkStatus();

  return { stop, checkNow: checkStatus };
}
