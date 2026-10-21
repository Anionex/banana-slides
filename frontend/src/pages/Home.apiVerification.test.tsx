import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import '../i18n';
import { Home } from './Home';
import { apiClient } from '@/api/client';
import { verifyApiKey } from '@/api/endpoints';

const demoConfig = vi.hoisted(() => ({ enabled: true }));
vi.mock('@/utils/publicDemo', () => ({ get isPublicDemo() { return demoConfig.enabled; }, visitorHeaders: () => ({}) }));
const initializeProject = vi.hoisted(() => vi.fn());
vi.mock('@/store/useProjectStore', () => ({ useProjectStore: () => ({ isGlobalLoading: false, initializeProject }) }));
vi.mock('@/api/endpoints', async importOriginal => ({
  ...await importOriginal<typeof import('../api/endpoints')>(),
  verifyApiKey: vi.fn(),
  listUserTemplates: vi.fn(async () => ({ data: { templates: [] } })),
  listUserStyleTemplates: vi.fn(async () => ({ data: { templates: [] } })),
}));
vi.mock('@/components/shared/TemplateSelector', () => ({ TemplateSelector: () => <div>Image templates</div>, getTemplateFile: vi.fn() }));
vi.mock('@/components/shared', async () => {
  const { TextStyleSelector } = await import('../components/shared/TextStyleSelector');
  const Empty = () => null;
  return {
    TextStyleSelector,
    Button: ({ children, onClick, disabled, loading }: React.PropsWithChildren<{ onClick?: () => void; disabled?: boolean; loading?: boolean }>) => <button onClick={onClick} disabled={disabled || loading}>{children}</button>,
    Card: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    useToast: () => ({ show: vi.fn(), ToastContainer: Empty }),
    MaterialGeneratorModal: Empty, MaterialCenterModal: Empty, MaterialSelector: Empty,
    ReferenceFileList: Empty, ReferenceFileSelector: Empty, FilePreviewModal: Empty,
    HelpModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => isOpen ? <div>Onboarding dialog<button onClick={onClose}>Finish help</button></div> : null,
    Footer: Empty, GithubRepoCard: Empty,
  };
});


const Location = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{JSON.stringify(location.state)}</output>;
};

const openHome = () => render(<MemoryRouter initialEntries={['/app']}><Home /><Location /></MemoryRouter>);
const blankButton = () => screen.getByRole('button', { name: /或从空白项目开始|Or start from a blank project/ });

// Both entry points must finish verification before any project is persisted.
describe.each(['blank', 'idea'] as const)('%s project API verification', entry => {
  const start = () => fireEvent.click(entry === 'blank' ? blankButton() : screen.getByRole('button', { name: /下一步|Next/, exact: true }));
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyApiKey).mockReset();
    initializeProject.mockReset().mockImplementation(async () => {
      localStorage.setItem('currentProjectId', 'verified-project');
    });
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('hasSeenHelpModal', 'true');
    localStorage.setItem('hasSeenPublicDemoNotice', 'true');
    sessionStorage.setItem('home-draft-content', 'Presentation topic');
    demoConfig.enabled = true;
    HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: { api_key_length: 20 } } });
  });

  it('redirects a visitor with no key without creating or verifying', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { api_key_length: 0 } } });
    openHome(); start();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/settings{"needsApiKey":true}'));
    expect(verifyApiKey).not.toHaveBeenCalled();
    expect(initializeProject).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('home-draft-content')).toBe('Presentation topic');
  });

  it.each(['invalid', 'network failure'] as const)('blocks creation after %s', async outcome => {
    if (outcome === 'invalid') vi.mocked(verifyApiKey).mockResolvedValue({ success: true, data: { available: false, message: 'Invalid key' } });
    else vi.mocked(verifyApiKey).mockRejectedValue(new Error('Network failure'));
    openHome(); start();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/settings{"apiVerificationFailed":true}'));
    expect(verifyApiKey).toHaveBeenCalledTimes(1);
    expect(initializeProject).not.toHaveBeenCalled();
  });

  it('blocks creation when settings cannot be read and allows retry', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Settings unavailable'));
    openHome(); start();
    await waitFor(() => expect(blankButton()).not.toBeDisabled());
    expect(initializeProject).not.toHaveBeenCalled();
    expect(verifyApiKey).not.toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent('/app');
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { api_key_length: 20 } } });
    vi.mocked(verifyApiKey).mockResolvedValue({ success: true, data: { available: true, message: 'OK' } });
    start();
    await waitFor(() => expect(initializeProject).toHaveBeenCalledTimes(1));
  });

  it('waits for verification, disables both entries, then creates exactly once', async () => {
    let approve!: (result: Awaited<ReturnType<typeof verifyApiKey>>) => void;
    vi.mocked(verifyApiKey).mockImplementation(() => new Promise(resolve => { approve = resolve; }));
    openHome(); start();
    await waitFor(() => expect(verifyApiKey).toHaveBeenCalledTimes(1));
    expect(initializeProject).not.toHaveBeenCalled();
    expect(blankButton()).toBeDisabled();
    fireEvent.click(blankButton());
    expect(screen.getByRole('button', { name: /验证中|Verifying/ })).toBeDisabled();
    await act(async () => approve({ success: true, data: { available: true, message: 'OK' } }));
    await waitFor(() => expect(initializeProject).toHaveBeenCalledTimes(1));
    expect(initializeProject.mock.calls[0].slice(0, 2)).toEqual([entry, entry === 'blank' ? '' : 'Presentation topic']);
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/project/verified-project/outline'));
  });

  it('preserves nonpublic blank creation without checking a personal key', async () => {
    demoConfig.enabled = false;
    openHome(); fireEvent.click(blankButton());
    await waitFor(() => expect(initializeProject).toHaveBeenCalledTimes(1));
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(verifyApiKey).not.toHaveBeenCalled();
  });
});
