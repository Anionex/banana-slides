import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OPENAI_OAUTH_CALLBACK_ORIGIN,
  startOpenAIOAuthMonitor,
  type OpenAIOAuthStatus,
} from '@/utils/openaiOAuthMonitor';

const disconnected = { connected: false, account_id: null };
const connected = { connected: true, account_id: 'desktop@example.com' };

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('startOpenAIOAuthMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls until an Electron external-browser login is persisted', async () => {
    const getStatus = vi.fn()
      .mockResolvedValueOnce(disconnected)
      .mockResolvedValue(connected);
    const onConnected = vi.fn();
    const onFailure = vi.fn();

    startOpenAIOAuthMonitor({
      desktop: true,
      popup: null,
      getStatus,
      onConnected,
      onFailure,
    });

    await flushPromises();
    expect(getStatus).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);

    expect(onConnected).toHaveBeenCalledWith(connected);
    expect(onFailure).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('checks immediately when the desktop window regains focus', async () => {
    let currentStatus: OpenAIOAuthStatus = disconnected;
    const getStatus = vi.fn(async () => currentStatus);
    const onConnected = vi.fn();

    startOpenAIOAuthMonitor({
      desktop: true,
      popup: null,
      getStatus,
      onConnected,
      onFailure: vi.fn(),
    });
    await flushPromises();

    currentStatus = connected;
    window.dispatchEvent(new Event('focus'));
    await flushPromises();

    expect(onConnected).toHaveBeenCalledWith(connected);
  });

  it('keeps the web postMessage success path and confirms backend state', async () => {
    let currentStatus: OpenAIOAuthStatus = disconnected;
    const getStatus = vi.fn(async () => currentStatus);
    const onConnected = vi.fn();

    startOpenAIOAuthMonitor({
      desktop: false,
      popup: { closed: false } as Window,
      getStatus,
      onConnected,
      onFailure: vi.fn(),
    });
    await flushPromises();

    currentStatus = connected;
    window.dispatchEvent(new MessageEvent('message', {
      origin: OPENAI_OAUTH_CALLBACK_ORIGIN,
      data: { type: 'openai-oauth-callback', success: true },
    }));
    await flushPromises();

    expect(onConnected).toHaveBeenCalledWith(connected);
  });

  it('does not poll backend status in the web flow before a callback', async () => {
    const getStatus = vi.fn(async () => disconnected);
    const monitor = startOpenAIOAuthMonitor({
      desktop: false,
      popup: { closed: false } as Window,
      getStatus,
      onConnected: vi.fn(),
      onFailure: vi.fn(),
      pollIntervalMs: 100,
    });

    await vi.advanceTimersByTimeAsync(500);

    expect(getStatus).not.toHaveBeenCalled();
    monitor.stop();
  });

  it('ignores OAuth-shaped messages from an untrusted origin', async () => {
    const getStatus = vi.fn(async () => disconnected);
    const onFailure = vi.fn();
    const monitor = startOpenAIOAuthMonitor({
      desktop: false,
      popup: { closed: false } as Window,
      getStatus,
      onConnected: vi.fn(),
      onFailure,
    });

    window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://attacker.example',
      data: { type: 'openai-oauth-callback', success: false, message: 'Denied' },
    }));
    await flushPromises();

    expect(getStatus).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
    monitor.stop();
  });

  it('retries transient getStatus failures without failing the OAuth flow', async () => {
    const getStatus = vi.fn()
      .mockRejectedValueOnce(new Error('temporary network failure'))
      .mockResolvedValueOnce(connected);
    const onConnected = vi.fn();
    const onFailure = vi.fn();
    const monitor = startOpenAIOAuthMonitor({
      desktop: false,
      popup: { closed: false } as Window,
      getStatus,
      onConnected,
      onFailure,
    });

    await expect(monitor.checkNow()).resolves.toBeUndefined();
    expect(onConnected).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();

    await expect(monitor.checkNow()).resolves.toBeUndefined();
    expect(onConnected).toHaveBeenCalledWith(connected);
  });

  it('does not swallow errors thrown by the connected callback', async () => {
    const callbackError = new Error('connected callback failed');
    const monitor = startOpenAIOAuthMonitor({
      desktop: false,
      popup: { closed: false } as Window,
      getStatus: vi.fn(async () => connected),
      onConnected: () => {
        throw callbackError;
      },
      onFailure: vi.fn(),
    });

    await expect(monitor.checkNow()).rejects.toBe(callbackError);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ends the flow on a web callback failure and removes its timers', async () => {
    const getStatus = vi.fn(async () => disconnected);
    const onConnected = vi.fn();
    const onFailure = vi.fn();

    startOpenAIOAuthMonitor({
      desktop: false,
      popup: { closed: false } as Window,
      getStatus,
      onConnected,
      onFailure,
      pollIntervalMs: 100,
      timeoutMs: 1000,
    });
    await flushPromises();

    window.dispatchEvent(new MessageEvent('message', {
      origin: OPENAI_OAUTH_CALLBACK_ORIGIN,
      data: { type: 'openai-oauth-callback', success: false, message: 'Denied by user' },
    }));
    const callsAtFailure = getStatus.mock.calls.length;
    await vi.advanceTimersByTimeAsync(2000);

    expect(onFailure).toHaveBeenCalledWith('callback_error', 'Denied by user');
    expect(onConnected).not.toHaveBeenCalled();
    expect(getStatus).toHaveBeenCalledTimes(callsAtFailure);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ends a web flow when its popup closes before the callback', async () => {
    const popup = { closed: false } as Window;
    const onFailure = vi.fn();

    startOpenAIOAuthMonitor({
      desktop: false,
      popup,
      getStatus: vi.fn(async () => disconnected),
      onConnected: vi.fn(),
      onFailure,
      pollIntervalMs: 100,
    });
    await flushPromises();

    Object.defineProperty(popup, 'closed', { value: true });
    await vi.advanceTimersByTimeAsync(100);

    expect(onFailure).toHaveBeenCalledWith('popup_closed', undefined);
  });

  it('ends a stalled login at the configured timeout', async () => {
    const onFailure = vi.fn();

    startOpenAIOAuthMonitor({
      desktop: true,
      popup: null,
      getStatus: vi.fn(async () => disconnected),
      onConnected: vi.fn(),
      onFailure,
      pollIntervalMs: 100,
      timeoutMs: 500,
    });

    await vi.advanceTimersByTimeAsync(500);

    expect(onFailure).toHaveBeenCalledWith('timeout', undefined);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans listeners and timers when its owner unmounts', async () => {
    const getStatus = vi.fn(async () => disconnected);
    const onConnected = vi.fn();
    const onFailure = vi.fn();
    const monitor = startOpenAIOAuthMonitor({
      desktop: true,
      popup: null,
      getStatus,
      onConnected,
      onFailure,
      pollIntervalMs: 100,
      timeoutMs: 500,
    });
    await flushPromises();

    monitor.stop();
    const callsAtStop = getStatus.mock.calls.length;
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new MessageEvent('message', {
      origin: OPENAI_OAUTH_CALLBACK_ORIGIN,
      data: { type: 'openai-oauth-callback', success: true },
    }));
    await vi.advanceTimersByTimeAsync(1000);

    expect(getStatus).toHaveBeenCalledTimes(callsAtStop);
    expect(onConnected).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('lets a repeated login replace the previous monitor without stale callbacks', async () => {
    const firstConnected = vi.fn();
    const firstFailure = vi.fn();
    const first = startOpenAIOAuthMonitor({
      desktop: true,
      popup: null,
      getStatus: vi.fn(async () => disconnected),
      onConnected: firstConnected,
      onFailure: firstFailure,
      pollIntervalMs: 100,
      timeoutMs: 500,
    });
    await flushPromises();

    first.stop();
    const secondConnected = vi.fn();
    startOpenAIOAuthMonitor({
      desktop: true,
      popup: null,
      getStatus: vi.fn(async () => connected),
      onConnected: secondConnected,
      onFailure: vi.fn(),
      pollIntervalMs: 100,
      timeoutMs: 500,
    });
    await flushPromises();
    await vi.advanceTimersByTimeAsync(1000);

    expect(firstConnected).not.toHaveBeenCalled();
    expect(firstFailure).not.toHaveBeenCalled();
    expect(secondConnected).toHaveBeenCalledWith(connected);
  });
});
