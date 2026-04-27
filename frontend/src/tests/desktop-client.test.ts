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
    expect(result.baseURL).toBe('http://localhost:15000');
  });

  it('waits for the backend port before sending desktop requests', async () => {
    let resolvePort: (port: number) => void = () => {};
    const portPromise = new Promise<number>((resolve) => {
      resolvePort = resolve;
    });
    (window as any).electronAPI = createMockElectronAPI({
      getBackendPort: vi.fn().mockReturnValue(portPromise),
    });
    const { apiClient } = await import('../api/client');
    const interceptors = apiClient.interceptors.request as any;
    const handlers = interceptors.handlers.filter((h: any) => h !== null);
    const config = { baseURL: undefined, headers: {} } as any;
    const resultPromise = handlers[0].fulfilled(config);
    let settled = false;
    resultPromise.then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    resolvePort(15001);
    const result = await resultPromise;
    expect(result.baseURL).toBe('http://localhost:15001');
    expect((window as any).__BACKEND_PORT__).toBe(15001);
  });

  it('calls getBackendPort on module load in desktop mode', async () => {
    const mockGetPort = vi.fn().mockResolvedValue(15000);
    (window as any).electronAPI = createMockElectronAPI({ getBackendPort: mockGetPort });
    await import('../api/client');
    expect(mockGetPort).toHaveBeenCalled();
  });

  it('builds desktop image URLs with the resolved backend base URL', async () => {
    (window as any).__BACKEND_PORT__ = 15000;
    (window as any).electronAPI = createMockElectronAPI();
    const { getImageUrl } = await import('../api/client');
    expect(getImageUrl('/uploads/example.png', 123)).toBe('http://localhost:15000/uploads/example.png?v=123');
  });
});
