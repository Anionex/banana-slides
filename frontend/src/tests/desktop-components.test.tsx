import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const mockElectronAPI = {
  getPlatform: vi.fn().mockReturnValue('win32'),
  checkForUpdates: vi.fn().mockResolvedValue(null),
  getBackendPort: vi.fn().mockResolvedValue(15000),
  getAppVersion: vi.fn().mockResolvedValue('0.3.0'),
  openExternal: vi.fn().mockResolvedValue(undefined),
  minimizeWindow: vi.fn(),
  maximizeWindow: vi.fn(),
  closeWindow: vi.fn(),
};

describe('DesktopTitleBar', () => {
  beforeEach(() => {
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
    const { DesktopTitleBar } = await import('../components/shared/DesktopTitleBar');
    const { container } = render(<DesktopTitleBar />);
    expect(container.innerHTML).toBe('');
  });

  it('renders title bar with app name on Windows', async () => {
    mockElectronAPI.getPlatform.mockReturnValue('win32');
    const { DesktopTitleBar } = await import('../components/shared/DesktopTitleBar');
    render(<DesktopTitleBar />);
    await act(() => vi.runAllTimers());
    expect(screen.getByText('Banana Slides')).toBeInTheDocument();
  });

  it('shows app name on macOS too (logo + name always visible)', async () => {
    mockElectronAPI.getPlatform.mockReturnValue('darwin');
    const { DesktopTitleBar } = await import('../components/shared/DesktopTitleBar');
    render(<DesktopTitleBar />);
    await act(() => vi.runAllTimers());
    expect(screen.getByText('Banana Slides')).toBeInTheDocument();
  });

  it('does not show window control buttons on macOS', async () => {
    mockElectronAPI.getPlatform.mockReturnValue('darwin');
    const { DesktopTitleBar } = await import('../components/shared/DesktopTitleBar');
    render(<DesktopTitleBar />);
    await act(() => vi.runAllTimers());
    expect(screen.queryByTitle('最小化')).not.toBeInTheDocument();
    expect(screen.queryByTitle('关闭')).not.toBeInTheDocument();
  });

  it('shows window control buttons on Windows with hover behavior', async () => {
    mockElectronAPI.getPlatform.mockReturnValue('win32');
    const { DesktopTitleBar } = await import('../components/shared/DesktopTitleBar');
    render(<DesktopTitleBar />);
    await act(() => vi.runAllTimers());
    expect(screen.getByTitle('最小化')).toBeInTheDocument();
    expect(screen.getByTitle('最大化')).toBeInTheDocument();
    expect(screen.getByTitle('关闭')).toBeInTheDocument();
  });

  it('calls getPlatform on mount', async () => {
    const { DesktopTitleBar } = await import('../components/shared/DesktopTitleBar');
    render(<DesktopTitleBar />);
    expect(mockElectronAPI.getPlatform).toHaveBeenCalled();
  });
});

describe('UpdateChecker', () => {
  beforeEach(() => {
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
    mockElectronAPI.checkForUpdates.mockResolvedValue(null);
    const { UpdateChecker } = await import('../components/shared/UpdateChecker');
    const { container } = render(<UpdateChecker />);
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(container.innerHTML).toBe('');
  });

  it('shows update notification when new version available', async () => {
    mockElectronAPI.checkForUpdates.mockResolvedValue({
      version: '1.0.0',
      notes: 'New features',
      url: 'https://github.com/Anionex/banana-slides/releases/tag/v1.0.0',
    });
    const { UpdateChecker } = await import('../components/shared/UpdateChecker');
    render(<UpdateChecker />);
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByText(/新版本 v1.0.0 可用/)).toBeInTheDocument();
    expect(screen.getByText('前往下载')).toBeInTheDocument();
  });

  it('opens external URL when download button clicked', async () => {
    const releaseUrl = 'https://github.com/Anionex/banana-slides/releases/tag/v1.0.0';
    mockElectronAPI.checkForUpdates.mockResolvedValue({
      version: '1.0.0',
      notes: 'New features',
      url: releaseUrl,
    });
    const { UpdateChecker } = await import('../components/shared/UpdateChecker');
    render(<UpdateChecker />);
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    fireEvent.click(screen.getByText('前往下载'));
    expect(mockElectronAPI.openExternal).toHaveBeenCalledWith(releaseUrl);
  });

  it('dismisses notification when close button clicked', async () => {
    mockElectronAPI.checkForUpdates.mockResolvedValue({
      version: '1.0.0',
      notes: 'New features',
      url: 'https://example.com',
    });
    const { UpdateChecker } = await import('../components/shared/UpdateChecker');
    render(<UpdateChecker />);
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByText(/新版本 v1.0.0 可用/)).toBeInTheDocument();

    const closeButtons = screen.getAllByRole('button');
    const dismissBtn = closeButtons.find(btn => !btn.textContent?.includes('前往下载'));
    fireEvent.click(dismissBtn!);

    expect(screen.queryByText(/新版本 v1.0.0 可用/)).not.toBeInTheDocument();
  });

  it('silently handles update check failure', async () => {
    mockElectronAPI.checkForUpdates.mockRejectedValue(new Error('Network error'));
    const { UpdateChecker } = await import('../components/shared/UpdateChecker');
    const { container } = render(<UpdateChecker />);
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(container.innerHTML).toBe('');
  });
});
