import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function createMockElectronAPI(overrides = {}) {
  return {
    getBackendPort: vi.fn().mockReturnValue(15000),
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
    const result = await handlers[0].fulfilled(config);
    expect(result.baseURL).toBe('');
  });

  it('sets localhost baseURL via interceptor when port is available', async () => {
    (window as any).__BACKEND_PORT__ = 15000;
    (window as any).electronAPI = createMockElectronAPI();
    const { apiClient } = await import('../api/client');
    const interceptors = apiClient.interceptors.request as any;
    const handlers = interceptors.handlers.filter((h: any) => h !== null);
    const config = { baseURL: undefined, headers: {} } as any;
    const result = await handlers[0].fulfilled(config);
    expect(result.baseURL).toBe('http://127.0.0.1:15000');
  });

  it('uses fallback port when desktop backend port is unavailable', async () => {
    (window as any).electronAPI = createMockElectronAPI({
      getBackendPort: vi.fn().mockReturnValue(undefined),
    });
    const { apiClient } = await import('../api/client');
    const interceptors = apiClient.interceptors.request as any;
    const handlers = interceptors.handlers.filter((h: any) => h !== null);
    const config = { baseURL: undefined, headers: {} } as any;
    const result = await handlers[0].fulfilled(config);
    expect(result.baseURL).toBe('http://127.0.0.1:5000');
    expect((window as any).__BACKEND_PORT__).toBe(5000);
  });

  it('calls getBackendPort on module load in desktop mode', async () => {
    const mockGetPort = vi.fn().mockReturnValue(15000);
    (window as any).electronAPI = createMockElectronAPI({ getBackendPort: mockGetPort });
    await import('../api/client');
    expect(mockGetPort).toHaveBeenCalled();
  });

  it('builds desktop image URLs with the resolved backend base URL', async () => {
    (window as any).__BACKEND_PORT__ = 15000;
    (window as any).electronAPI = createMockElectronAPI();
    const { getImageUrl } = await import('../api/client');
    expect(getImageUrl('/uploads/example.png', 123)).toBe('http://127.0.0.1:15000/uploads/example.png?v=123');
  });
});
