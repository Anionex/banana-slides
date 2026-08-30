import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

const mockElectronAPI = {
  getPlatform: vi.fn().mockReturnValue('win32'),
  checkForUpdates: vi.fn().mockResolvedValue({
    status: 'up_to_date',
    currentVersion: '0.3.0',
    latestVersion: '0.3.0',
    update: null,
  }),
  getUpdateState: vi.fn().mockResolvedValue({
    status: 'up_to_date',
    currentVersion: '0.3.0',
    latestVersion: '0.3.0',
    update: null,
  }),
  downloadUpdate: vi.fn(),
  installUpdate: vi.fn(),
  onUpdateStatus: vi.fn().mockReturnValue(() => undefined),
  getBackendPort: vi.fn().mockReturnValue(15000),
  getAppVersion: vi.fn().mockResolvedValue('0.3.0'),
  openExternal: vi.fn().mockResolvedValue(undefined),
  minimizeWindow: vi.fn(),
  maximizeWindow: vi.fn(),
  closeWindow: vi.fn(),
};

function Wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('DesktopTitleBar', () => {
  beforeEach(() => {
    (window as any).electronAPI = mockElectronAPI;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    vi.useFakeTimers();
  });

  afterEach(() => {
    delete (window as any).electronAPI;
    vi.useRealTimers();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('renders nothing when not in desktop mode', async () => {
    delete (window as any).electronAPI;
    const { DesktopTitleBar } = await import('../components/shared/DesktopTitleBar');
    const { container } = render(<DesktopTitleBar />, { wrapper: Wrapper });
    expect(container.innerHTML).toBe('');
  });

  it('renders title bar with app name and nav buttons on Windows', async () => {
    mockElectronAPI.getPlatform.mockReturnValue('win32');
    const { DesktopTitleBar } = await import('../components/shared/DesktopTitleBar');
    render(<DesktopTitleBar />, { wrapper: Wrapper });
    await act(() => vi.runAllTimers());
    expect(screen.getByText('Banana Slides')).toBeInTheDocument();
    expect(screen.getByTitle('Minimize')).toBeInTheDocument();
    expect(screen.getByTitle('Close')).toBeInTheDocument();
  });

  it('shows nav buttons (history, settings) on all platforms', async () => {
    mockElectronAPI.getPlatform.mockReturnValue('win32');
    const { DesktopTitleBar } = await import('../components/shared/DesktopTitleBar');
    render(<DesktopTitleBar />, { wrapper: Wrapper });
    await act(() => vi.runAllTimers());
    // useT falls back to English keys in test env
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('does not show window control buttons on macOS', async () => {
    mockElectronAPI.getPlatform.mockReturnValue('darwin');
    const { DesktopTitleBar } = await import('../components/shared/DesktopTitleBar');
    render(<DesktopTitleBar />, { wrapper: Wrapper });
    await act(() => vi.runAllTimers());
    expect(screen.queryByTitle('最小化')).not.toBeInTheDocument();
    expect(screen.queryByTitle('关闭')).not.toBeInTheDocument();
  });

  it('reserves leading space for native macOS traffic lights', async () => {
    mockElectronAPI.getPlatform.mockReturnValue('darwin');
    const { DesktopTitleBar } = await import('../components/shared/DesktopTitleBar');
    render(<DesktopTitleBar />, { wrapper: Wrapper });
    await act(() => vi.runAllTimers());
    expect(document.getElementById('desktop-titlebar')).toHaveStyle({ paddingLeft: '92px' });
  });

  it('uses the shared desktop title bar height constant', async () => {
    mockElectronAPI.getPlatform.mockReturnValue('darwin');
    const { DesktopTitleBar } = await import('../components/shared/DesktopTitleBar');
    render(<DesktopTitleBar />, { wrapper: Wrapper });
    await act(() => vi.runAllTimers());
    expect(document.getElementById('desktop-titlebar')).toHaveStyle({ height: '50px' });
  });

  it('calls getPlatform on mount', async () => {
    const { DesktopTitleBar } = await import('../components/shared/DesktopTitleBar');
    render(<DesktopTitleBar />, { wrapper: Wrapper });
    expect(mockElectronAPI.getPlatform).toHaveBeenCalled();
  });
});

describe('UpdateChecker', () => {
  beforeEach(() => {
    mockElectronAPI.getUpdateState.mockReset().mockResolvedValue({
      status: 'up_to_date',
      currentVersion: '0.9.0',
      latestVersion: '0.9.0',
      update: null,
    });
    mockElectronAPI.downloadUpdate.mockReset();
    mockElectronAPI.installUpdate.mockReset();
    mockElectronAPI.openExternal.mockReset();
    mockElectronAPI.onUpdateStatus.mockReset().mockReturnValue(() => undefined);
    (window as any).electronAPI = mockElectronAPI;
    vi.useFakeTimers();
  });

  afterEach(() => {
    delete (window as any).electronAPI;
    vi.useRealTimers();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('renders nothing when not in desktop mode', async () => {
    delete (window as any).electronAPI;
    const { UpdateChecker } = await import('../components/shared/UpdateChecker');
    const { container } = render(<UpdateChecker />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when no update available', async () => {
    mockElectronAPI.getUpdateState.mockResolvedValue({
      status: 'up_to_date',
      currentVersion: '0.9.0',
      latestVersion: '0.9.0',
      update: null,
    });
    const { UpdateChecker } = await import('../components/shared/UpdateChecker');
    const { container } = render(<UpdateChecker />);
    await act(async () => undefined);
    expect(container.innerHTML).toBe('');
  });

  it('shows update notification when new version available', async () => {
    mockElectronAPI.getUpdateState.mockResolvedValue({
      status: 'update_available',
      currentVersion: '0.9.0',
      latestVersion: '1.0.0',
      update: {
        version: '1.0.0',
        notes: 'New features',
        url: 'https://github.com/Anionex/banana-slides/releases/tag/v1.0.0',
      },
    });
    const { UpdateChecker } = await import('../components/shared/UpdateChecker');
    render(<UpdateChecker />);
    await act(async () => undefined);
    expect(screen.getByText(/v1.0.0/)).toBeInTheDocument();
    expect(screen.getByText('Open download page')).toBeInTheDocument();
  });

  it('reports its visibility so the app can increase top padding', async () => {
    const onVisibilityChange = vi.fn();
    mockElectronAPI.getUpdateState.mockResolvedValue({
      status: 'update_available',
      currentVersion: '0.9.0',
      latestVersion: '1.0.0',
      update: {
        version: '1.0.0',
        notes: 'New features',
        url: 'https://github.com/Anionex/banana-slides/releases/tag/v1.0.0',
      },
    });
    const { UpdateChecker } = await import('../components/shared/UpdateChecker');
    render(<UpdateChecker onVisibilityChange={onVisibilityChange} />);
    await act(async () => undefined);
    expect(onVisibilityChange).toHaveBeenCalledWith(true);
  });

  it('opens external URL when download button clicked', async () => {
    const releaseUrl = 'https://github.com/Anionex/banana-slides/releases/tag/v1.0.0';
    mockElectronAPI.getUpdateState.mockResolvedValue({
      status: 'update_available',
      currentVersion: '0.9.0',
      latestVersion: '1.0.0',
      update: {
        version: '1.0.0',
        notes: 'New features',
        url: releaseUrl,
      },
    });
    const { UpdateChecker } = await import('../components/shared/UpdateChecker');
    render(<UpdateChecker />);
    await act(async () => undefined);
    fireEvent.click(screen.getByText('Open download page'));
    expect(mockElectronAPI.openExternal).toHaveBeenCalledWith(releaseUrl);
  });

  it('downloads installable updates without opening a browser', async () => {
    const downloadedState = {
      status: 'update_downloaded',
      currentVersion: '0.9.0',
      latestVersion: '1.0.0',
      canAutoUpdate: true,
      update: {
        version: '1.0.0',
        notes: 'New features',
        url: 'https://github.com/Anionex/banana-slides/releases/tag/v1.0.0',
      },
    };
    mockElectronAPI.getUpdateState.mockResolvedValue({
      ...downloadedState,
      status: 'update_available',
    });
    mockElectronAPI.downloadUpdate.mockResolvedValue(downloadedState);
    const { UpdateChecker } = await import('../components/shared/UpdateChecker');
    render(<UpdateChecker />);
    await act(async () => undefined);

    fireEvent.click(screen.getByText('Download update'));
    await act(async () => undefined);

    expect(mockElectronAPI.downloadUpdate).toHaveBeenCalledOnce();
    expect(mockElectronAPI.openExternal).not.toHaveBeenCalled();
    expect(screen.getByText('Restart to update')).toBeInTheDocument();
  });

  it('dismisses notification when close button clicked', async () => {
    mockElectronAPI.getUpdateState.mockResolvedValue({
      status: 'update_available',
      currentVersion: '0.9.0',
      latestVersion: '1.0.0',
      update: {
        version: '1.0.0',
        notes: 'New features',
        url: 'https://example.com',
      },
    });
    const { UpdateChecker } = await import('../components/shared/UpdateChecker');
    render(<UpdateChecker />);
    await act(async () => undefined);
    expect(screen.getByText(/v1.0.0/)).toBeInTheDocument();
    const closeButtons = screen.getAllByRole('button');
    const dismissBtn = closeButtons.find(btn => btn.getAttribute('aria-label') === 'Dismiss update notification');
    fireEvent.click(dismissBtn!);
    expect(screen.queryByText(/v1.0.0/)).not.toBeInTheDocument();
  });

  it('silently handles update check failure', async () => {
    mockElectronAPI.getUpdateState.mockRejectedValue(new Error('Network error'));
    const { UpdateChecker } = await import('../components/shared/UpdateChecker');
    const { container } = render(<UpdateChecker />);
    await act(async () => undefined);
    expect(container.innerHTML).toBe('');
  });
});
