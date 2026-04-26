import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function createMockElectronAPI(overrides = {}) {
  return {
    getBackendPort: vi.fn().mockResolvedValue(15000),
    getPlatform: vi.fn().mockReturnValue('win32'),
    checkForUpdates: vi.fn().mockResolvedValue(null),
    getAppVersion: vi.fn().mockResolvedValue('0.3.0'),
    openExternal: vi.fn(),
    minimizeWindow: vi.fn(),
    maximizeWindow: vi.fn(),
    closeWindow: vi.fn(),
    ...overrides,
  };
}

describe('API client desktop detection', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete (window as any).electronAPI;
    delete (window as any).__BACKEND_PORT__;
    vi.restoreAllMocks();
  });

  it('sets empty baseURL via interceptor in web mode', async () => {
    delete (window as any).electronAPI;
    const { apiClient } = await import('../api/client');
    const interceptors = apiClient.interceptors.request as any;
    const handlers = interceptors.handlers.filter((h: any) => h !== null);
    const config = { baseURL: undefined, headers: {} } as any;
    const result = handlers[0].fulfilled(config);
    expect(result.baseURL).toBe('');
  });

  it('sets localhost baseURL via interceptor when port is available', async () => {
    (window as any).__BACKEND_PORT__ = 15000;
    (window as any).electronAPI = createMockElectronAPI();
    const { apiClient } = await import('../api/client');
    const interceptors = apiClient.interceptors.request as any;
    const handlers = interceptors.handlers.filter((h: any) => h !== null);
    const config = { baseURL: undefined, headers: {} } as any;
    const result = handlers[0].fulfilled(config);
    expect(result.baseURL).toBe('http://localhost:15000');
  });

  it('falls back to port 5000 when __BACKEND_PORT__ not yet set', async () => {
    (window as any).electronAPI = createMockElectronAPI();
    const { apiClient } = await import('../api/client');
    delete (window as any).__BACKEND_PORT__;
    const interceptors = apiClient.interceptors.request as any;
    const handlers = interceptors.handlers.filter((h: any) => h !== null);
    const config = { baseURL: undefined, headers: {} } as any;
    const result = handlers[0].fulfilled(config);
    expect(result.baseURL).toBe('http://localhost:5000');
  });

  it('calls getBackendPort on module load in desktop mode', async () => {
    const mockGetPort = vi.fn().mockResolvedValue(15000);
    (window as any).electronAPI = createMockElectronAPI({ getBackendPort: mockGetPort });
    await import('../api/client');
    expect(mockGetPort).toHaveBeenCalled();
  });
});
