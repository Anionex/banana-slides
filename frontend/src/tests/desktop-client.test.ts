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
    downloadFile: vi.fn(),
    ...overrides,
  };
}

describe('API client desktop detection', () => {
  beforeEach(() => {
    vi.resetModules();
    sessionStorage.clear();
  });

  afterEach(() => {
    delete (window as any).electronAPI;
    delete (window as any).__BACKEND_PORT__;
    sessionStorage.clear();
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

  it('does not override absolute baseURL or request URLs', async () => {
    (window as any).__BACKEND_PORT__ = 15000;
    (window as any).electronAPI = createMockElectronAPI();
    const { apiClient } = await import('../api/client');
    const interceptors = apiClient.interceptors.request as any;
    const handlers = interceptors.handlers.filter((h: any) => h !== null);

    const absoluteBaseURLConfig = { baseURL: 'https://api.example.com', headers: {} } as any;
    const absoluteBaseURLResult = await handlers[0].fulfilled(absoluteBaseURLConfig);
    expect(absoluteBaseURLResult.baseURL).toBe('https://api.example.com');

    const absoluteRequestConfig = { url: 'https://api.example.com/status', baseURL: undefined, headers: {} } as any;
    const absoluteRequestResult = await handlers[0].fulfilled(absoluteRequestConfig);
    expect(absoluteRequestResult.baseURL).toBeUndefined();
  });

  it('loads in desktop mode when backend port is unavailable but keeps API requests guarded', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    (window as any).electronAPI = createMockElectronAPI({
      getBackendPort: vi.fn().mockReturnValue(undefined),
    });
    const { getBaseURL } = await import('../api/client');

    expect((window as any).__BACKEND_PORT__).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith('Desktop backend port is unavailable');
    expect(getBaseURL()).toBe('http://127.0.0.1:0');
  });

  it('calls getBackendPort on module load in desktop mode', async () => {
    const mockGetPort = vi.fn().mockReturnValue(15000);
    (window as any).electronAPI = createMockElectronAPI({ getBackendPort: mockGetPort });
    await import('../api/client');
    expect(mockGetPort).toHaveBeenCalled();
  });

  it('uses cached desktop backend port when the query parameter is unavailable', async () => {
    sessionStorage.setItem('__desktop_backend_port__', '15001');
    (window as any).electronAPI = createMockElectronAPI({
      getBackendPort: vi.fn().mockReturnValue(undefined),
    });
    const { getBaseURL } = await import('../api/client');
    expect(getBaseURL()).toBe('http://127.0.0.1:15001');
  });

  it('builds desktop image URLs with the resolved backend base URL', async () => {
    (window as any).__BACKEND_PORT__ = 15000;
    (window as any).electronAPI = createMockElectronAPI();
    const { getImageUrl } = await import('../api/client');
    expect(getImageUrl('/files/materials/example.png')).toBe(
      'http://127.0.0.1:15000/files/materials/example.png',
    );
    expect(getImageUrl('/uploads/example.png', 123)).toBe('http://127.0.0.1:15000/uploads/example.png?v=123');
    expect(getImageUrl('https://example.com/image.png')).toBe('https://example.com/image.png');
  });

  it('strips query parameters from fallback desktop download filenames', async () => {
    const downloadFile = vi.fn();
    (window as any).__BACKEND_PORT__ = 15000;
    (window as any).electronAPI = createMockElectronAPI({ downloadFile });
    const { triggerDownload } = await import('../api/client');

    triggerDownload('/exports/slides.pptx?token=abc');

    expect(downloadFile).toHaveBeenCalledWith(
      'http://127.0.0.1:15000/exports/slides.pptx?token=abc',
      'slides.pptx',
    );
  });

  it('normalizes desktop download URLs without a leading slash', async () => {
    const downloadFile = vi.fn();
    (window as any).__BACKEND_PORT__ = 15000;
    (window as any).electronAPI = createMockElectronAPI({ downloadFile });
    const { triggerDownload } = await import('../api/client');

    triggerDownload('exports/slides.pptx?token=abc');

    expect(downloadFile).toHaveBeenCalledWith(
      'http://127.0.0.1:15000/exports/slides.pptx?token=abc',
      'slides.pptx',
    );
  });

  it('does not prepend the backend URL to client-side download URLs', async () => {
    const downloadFile = vi.fn();
    (window as any).__BACKEND_PORT__ = 15000;
    (window as any).electronAPI = createMockElectronAPI({ downloadFile });
    const { triggerDownload } = await import('../api/client');

    triggerDownload('data:text/plain,hello', 'hello.txt');

    expect(downloadFile).toHaveBeenCalledWith('data:text/plain,hello', 'hello.txt');
  });

  it('does not prepend the backend URL to client-side image URLs', async () => {
    (window as any).__BACKEND_PORT__ = 15000;
    (window as any).electronAPI = createMockElectronAPI();
    const { getImageUrl } = await import('../api/client');

    expect(getImageUrl('/blob:https://example.com/id', 123)).toBe('blob:https://example.com/id');
    expect(getImageUrl('data:image/png;base64,abc', 123)).toBe('data:image/png;base64,abc');
  });
});
