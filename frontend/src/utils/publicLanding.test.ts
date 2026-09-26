import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('public landing entry', () => {
  it.each([undefined, 'false', '1'])('keeps existing deployments unchanged with flag %s', async flag => {
    vi.stubEnv('VITE_PUBLIC_LANDING', flag ?? '');
    if (flag === undefined) delete import.meta.env.VITE_PUBLIC_LANDING;
    expect((await import('./publicLanding')).publicLandingEnabled).toBe(false);
  });

  it('enables only the explicitly opted-in web entry', async () => {
    vi.stubEnv('VITE_PUBLIC_LANDING', 'true');
    const { publicLandingEnabled, isLandingPath } = await import('./publicLanding');
    expect(publicLandingEnabled).toBe(true);
    for (const path of ['/', '/landing', '/landing/']) expect(isLandingPath(path)).toBe(true);
    for (const path of ['/app', '/settings', '/admin/history', '/project/id/preview', '/landing/other']) {
      expect(isLandingPath(path)).toBe(false);
    }
  });

  it('keeps Electron on the existing entry even when the web flag is enabled', async () => {
    vi.stubEnv('VITE_PUBLIC_LANDING', 'true');
    vi.stubGlobal('window', { electronAPI: {} });
    expect((await import('./publicLanding')).publicLandingEnabled).toBe(false);
  });
});
