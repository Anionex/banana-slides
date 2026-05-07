import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

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
    expect(screen.getByTitle('最小化')).toBeInTheDocument();
    expect(screen.getByTitle('关闭')).toBeInTheDocument();
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
    expect(document.getElementById('desktop-titlebar')).toHaveStyle({ paddingLeft: '82px' });
  });

  it('calls getPlatform on mount', async () => {
    const { DesktopTitleBar } = await import('../components/shared/DesktopTitleBar');
    render(<DesktopTitleBar />, { wrapper: Wrapper });
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
    await act(async () => { vi.advanceTimersByTime(6000); });
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
    await act(async () => { vi.advanceTimersByTime(6000); });
    expect(screen.getByText(/v1.0.0/)).toBeInTheDocument();
    expect(screen.getByText('Download')).toBeInTheDocument();
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
    await act(async () => { vi.advanceTimersByTime(6000); });
    fireEvent.click(screen.getByText('Download'));
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
    await act(async () => { vi.advanceTimersByTime(6000); });
    expect(screen.getByText(/v1.0.0/)).toBeInTheDocument();
    const closeButtons = screen.getAllByRole('button');
    const dismissBtn = closeButtons.find(btn => !btn.textContent?.includes('Download'));
    fireEvent.click(dismissBtn!);
    expect(screen.queryByText(/v1.0.0/)).not.toBeInTheDocument();
  });

  it('silently handles update check failure', async () => {
    mockElectronAPI.checkForUpdates.mockRejectedValue(new Error('Network error'));
    const { UpdateChecker } = await import('../components/shared/UpdateChecker');
    const { container } = render(<UpdateChecker />);
    await act(async () => { vi.advanceTimersByTime(6000); });
    expect(container.innerHTML).toBe('');
  });
});
