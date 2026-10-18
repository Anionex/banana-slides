import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../i18n';
import { Home } from './Home';
import manifest from '../landing/gallery/manifest.json';
import { galleryStyleHref } from '../utils/galleryStyle';

vi.mock('@/utils/publicDemo', () => ({ isPublicDemo: true, visitorHeaders: () => ({}) }));
vi.mock('@/store/useProjectStore', () => ({ useProjectStore: () => ({ isGlobalLoading: false }) }));
vi.mock('@/api/endpoints', async importOriginal => ({
  ...await importOriginal<typeof import('../api/endpoints')>(),
  listUserTemplates: vi.fn(async () => ({ data: { templates: [] } })),
  listUserStyleTemplates: vi.fn(async () => ({ data: { templates: [] } })),
}));
vi.mock('@/components/shared/TemplateSelector', () => ({ TemplateSelector: () => <div>Image templates</div>, getTemplateFile: vi.fn() }));
vi.mock('@/components/shared', async () => {
  const { TextStyleSelector } = await import('../components/shared/TextStyleSelector');
  const Empty = () => null;
  return {
    TextStyleSelector,
    Button: ({ children, onClick }: React.PropsWithChildren<{ onClick?: () => void }>) => <button onClick={onClick}>{children}</button>,
    Card: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    useToast: () => ({ show: vi.fn(), ToastContainer: Empty }),
    MaterialGeneratorModal: Empty, MaterialCenterModal: Empty, MaterialSelector: Empty,
    ReferenceFileList: Empty, ReferenceFileSelector: Empty, FilePreviewModal: Empty,
    HelpModal: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div>Onboarding dialog</div> : null,
    Footer: Empty, GithubRepoCard: Empty,
  };
});

describe('Home gallery style entry', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it.each(['zh', 'en'] as const)('opens the real style editor with the complete %s prompt, preserves topic and allows edits', async language => {
    const deck = manifest.find(item => item.id === 'gen-z')!;
    sessionStorage.setItem('home-draft-content', 'My existing presentation topic');
    render(<React.StrictMode><MemoryRouter initialEntries={[galleryStyleHref(deck.id, language)]}><Home /></MemoryRouter></React.StrictMode>);
    const editor = screen.getByDisplayValue(deck.creation.stylePrompt[language], { normalizer: value => value });
    await waitFor(() => expect(editor).toHaveFocus());
    expect(screen.queryByText('Image templates')).not.toBeInTheDocument();
    expect(screen.getByText('My existing presentation topic')).toBeInTheDocument();
    fireEvent.change(editor, { target: { value: 'My revised style' } });
    expect(editor).toHaveValue('My revised style');
    expect(screen.queryByText('Onboarding dialog')).not.toBeInTheDocument();
  });

  it('keeps ordinary app entries in image template mode', () => {
    localStorage.setItem('hasSeenHelpModal', 'true');
    render(<MemoryRouter initialEntries={['/app']}><Home /></MemoryRouter>);
    expect(screen.getByText('Image templates')).toBeInTheDocument();
  });
});
