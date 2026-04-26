import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('API client desktop detection', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete (window as any).electronAPI;
    delete (window as any).__BACKEND_PORT__;
    vi.restoreAllMocks();
  });

  it('uses empty baseURL in web mode (no electronAPI)', async () => {
    delete (window as any).electronAPI;
    const { apiClient } = await import('../api/client');
    expect(apiClient.defaults.baseURL).toBe('');
  });

  it('uses localhost baseURL with port in desktop mode', async () => {
    (window as any).__BACKEND_PORT__ = 15000;
    (window as any).electronAPI = {
      getBackendPort: vi.fn().mockResolvedValue(15000),
      getPlatform: vi.fn().mockReturnValue('win32'),
      checkForUpdates: vi.fn().mockResolvedValue(null),
      getAppVersion: vi.fn().mockResolvedValue('0.3.0'),
      openExternal: vi.fn(),
      minimizeWindow: vi.fn(),
      maximizeWindow: vi.fn(),
      closeWindow: vi.fn(),
    };
    const { apiClient } = await import('../api/client');
    expect(apiClient.defaults.baseURL).toBe('http://localhost:15000');
  });

  it('falls back to port 5000 when __BACKEND_PORT__ not yet set', async () => {
    (window as any).electronAPI = {
      getBackendPort: vi.fn().mockResolvedValue(15000),
      getPlatform: vi.fn().mockReturnValue('win32'),
      checkForUpdates: vi.fn().mockResolvedValue(null),
      getAppVersion: vi.fn().mockResolvedValue('0.3.0'),
      openExternal: vi.fn(),
      minimizeWindow: vi.fn(),
      maximizeWindow: vi.fn(),
      closeWindow: vi.fn(),
    };
    delete (window as any).__BACKEND_PORT__;
    const { apiClient } = await import('../api/client');
    expect(apiClient.defaults.baseURL).toBe('http://localhost:5000');
  });

  it('calls getBackendPort on module load in desktop mode', async () => {
    const mockGetPort = vi.fn().mockResolvedValue(15000);
    (window as any).electronAPI = {
      getBackendPort: mockGetPort,
      getPlatform: vi.fn().mockReturnValue('win32'),
      checkForUpdates: vi.fn().mockResolvedValue(null),
      getAppVersion: vi.fn().mockResolvedValue('0.3.0'),
      openExternal: vi.fn(),
      minimizeWindow: vi.fn(),
      maximizeWindow: vi.fn(),
      closeWindow: vi.fn(),
    };
    await import('../api/client');
    expect(mockGetPort).toHaveBeenCalled();
  });
});
