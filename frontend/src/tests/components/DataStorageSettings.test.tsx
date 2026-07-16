import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataStorageSettings } from '@/components/settings/DataStorageSettings';

const electronApi = {
  getDataStorageInfo: vi.fn(),
  chooseDataStorageDirectory: vi.fn(),
  inspectDataStorageDirectory: vi.fn(),
  openDataStorageDirectory: vi.fn(),
  applyDataStorageDirectory: vi.fn(),
};

describe('DataStorageSettings', () => {
  beforeEach(() => {
    Object.assign(electronApi, {
      getDataStorageInfo: vi.fn().mockResolvedValue({
        dataRoot: 'C:\\Users\\Test\\AppData\\Roaming\\banana-slides-desktop',
        isDefault: true,
        hasDatabase: true,
        configurable: true,
      }),
      chooseDataStorageDirectory: vi.fn().mockResolvedValue('D:\\Banana Slides Data'),
      inspectDataStorageDirectory: vi.fn().mockResolvedValue({
        dataRoot: 'D:\\Banana Slides Data',
        exists: true,
        writable: true,
        hasDatabase: true,
        isEmpty: false,
      }),
      openDataStorageDirectory: vi.fn().mockResolvedValue({ success: true }),
      applyDataStorageDirectory: vi.fn().mockResolvedValue({ success: true, restarting: true }),
    });
    (window as typeof window & { electronAPI?: unknown }).electronAPI = electronApi;
  });

  afterEach(() => {
    cleanup();
    delete (window as typeof window & { electronAPI?: unknown }).electronAPI;
    vi.restoreAllMocks();
  });

  it('is hidden when the desktop storage preload API is unavailable', () => {
    delete (window as typeof window & { electronAPI?: unknown }).electronAPI;
    const { container } = render(<DataStorageSettings />);
    expect(container).toBeEmptyDOMElement();
  });

  it('is hidden when the desktop shell cannot configure an external backend data path', async () => {
    electronApi.getDataStorageInfo.mockResolvedValue({
      dataRoot: '/external/backend/data',
      isDefault: false,
      hasDatabase: true,
      configurable: false,
    });
    const { container } = render(<DataStorageSettings />);

    await waitFor(() => expect(electronApi.getDataStorageInfo).toHaveBeenCalledOnce());
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the current path and makes manual migration explicit', async () => {
    render(<DataStorageSettings />);

    expect(await screen.findByDisplayValue('C:\\Users\\Test\\AppData\\Roaming\\banana-slides-desktop')).toBeInTheDocument();
    expect(screen.getByText(/does not move or delete existing data automatically|不会自动移动或删除已有数据/)).toBeInTheDocument();
    expect(screen.getByText(/data, uploads, and exports|data、uploads、exports/)).toBeInTheDocument();
  });

  it('browses, validates an existing data directory, and applies it without initialization', async () => {
    const user = userEvent.setup();
    render(<DataStorageSettings />);
    await screen.findByDisplayValue('C:\\Users\\Test\\AppData\\Roaming\\banana-slides-desktop');

    await user.click(screen.getByRole('button', { name: /Browse|浏览/ }));
    expect(screen.getByDisplayValue('D:\\Banana Slides Data')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Save and restart|保存并重启/ }));

    await waitFor(() => {
      expect(electronApi.inspectDataStorageDirectory).toHaveBeenCalledWith('D:\\Banana Slides Data');
      expect(electronApi.applyDataStorageDirectory).toHaveBeenCalledWith('D:\\Banana Slides Data', false);
    });
  });

  it('requires explicit acknowledgement before initializing a location without database.db', async () => {
    electronApi.inspectDataStorageDirectory.mockResolvedValue({
      dataRoot: 'D:\\Empty',
      exists: true,
      writable: true,
      hasDatabase: false,
      isEmpty: true,
    });
    electronApi.chooseDataStorageDirectory.mockResolvedValue('D:\\Empty');
    const user = userEvent.setup();
    render(<DataStorageSettings />);
    await screen.findByDisplayValue('C:\\Users\\Test\\AppData\\Roaming\\banana-slides-desktop');

    await user.click(screen.getByRole('button', { name: /Browse|浏览/ }));
    await user.click(screen.getByRole('button', { name: /Save and restart|保存并重启/ }));

    const confirmButton = await screen.findByRole('button', { name: /Confirm and restart|确认并重启/ });
    expect(confirmButton).toBeDisabled();
    expect(electronApi.applyDataStorageDirectory).not.toHaveBeenCalled();

    await user.click(screen.getByRole('checkbox'));
    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);

    await waitFor(() => {
      expect(electronApi.applyDataStorageDirectory).toHaveBeenCalledWith('D:\\Empty', true);
    });
  });

  it('does not restart when inspection normalizes the edited path to the active path', async () => {
    electronApi.chooseDataStorageDirectory.mockResolvedValue('C:\\Users\\Test\\AppData\\Roaming\\banana-slides-desktop\\.');
    electronApi.inspectDataStorageDirectory.mockResolvedValue({
      dataRoot: 'C:\\Users\\Test\\AppData\\Roaming\\banana-slides-desktop',
      exists: true,
      writable: true,
      hasDatabase: true,
      isEmpty: false,
    });
    const user = userEvent.setup();
    render(<DataStorageSettings />);
    await screen.findByDisplayValue('C:\\Users\\Test\\AppData\\Roaming\\banana-slides-desktop');

    await user.click(screen.getByRole('button', { name: /Browse|浏览/ }));
    await user.click(screen.getByRole('button', { name: /Save and restart|保存并重启/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/already in use|已使用此数据存储位置/);
    expect(electronApi.applyDataStorageDirectory).not.toHaveBeenCalled();
  });

  it('opens the active directory rather than an uncommitted edited path', async () => {
    const user = userEvent.setup();
    render(<DataStorageSettings />);
    const input = await screen.findByDisplayValue('C:\\Users\\Test\\AppData\\Roaming\\banana-slides-desktop');
    await user.clear(input);
    await user.type(input, 'D:\\Uncommitted');

    await user.click(screen.getByRole('button', { name: /Open current folder|打开当前目录/ }));
    expect(electronApi.openDataStorageDirectory).toHaveBeenCalledOnce();
    expect(electronApi.inspectDataStorageDirectory).not.toHaveBeenCalled();
  });
});
