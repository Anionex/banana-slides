import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TemplateSelector } from '@/components/shared/TemplateSelector';
import { listUserTemplates, uploadUserTemplate } from '@/api/endpoints';

const { show } = vi.hoisted(() => ({ show: vi.fn() }));
vi.mock('@/api/endpoints', () => ({
  listUserTemplates: vi.fn(), uploadUserTemplate: vi.fn(), deleteUserTemplate: vi.fn(),
}));
vi.mock('@/hooks/useT', () => ({ useT: () => (key: string) => key }));
vi.mock('@/components/shared', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  MaterialSelector: () => null,
  useToast: () => ({ show, ToastContainer: () => null }),
}));
vi.mock('@/components/shared/MaterialSelector', () => ({ materialUrlToFile: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listUserTemplates).mockResolvedValue({ success: true, data: { templates: [] } });
});

describe('template selection feedback', () => {
  it('blocks duplicate selection until the asynchronous apply finishes', async () => {
    let finish!: () => void;
    const onSelect = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const busy = vi.fn();
    const { container } = render(<TemplateSelector onSelect={onSelect} onBusyChange={busy} />);
    const preset = screen.getByAltText('template.presets.retroScroll');
    fireEvent.click(preset);
    fireEvent.click(screen.getByAltText('template.presets.vectorIllustration'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(null, '1');
    expect(container.querySelector('fieldset')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByLabelText(/template.uploadTemplate/)).toBeDisabled();
    expect(busy).toHaveBeenLastCalledWith(true);
    await act(async () => { finish(); });
    expect(container.querySelector('fieldset')).toHaveAttribute('aria-busy', 'false');
    expect(busy).toHaveBeenLastCalledWith(false);
    fireEvent.click(preset);
    expect(onSelect).toHaveBeenCalledTimes(2);
    await act(async () => { finish(); });
  });

  it('waits for apply before reporting an uploaded template as successful', async () => {
    let finish!: () => void;
    vi.mocked(uploadUserTemplate).mockResolvedValue({ success: true, data: {
      template_id: 'uploaded', template_image_url: '/files/template.png', created_at: '',
    } });
    const onSelect = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const busy = vi.fn();
    render(<TemplateSelector onSelect={onSelect} onBusyChange={busy} />);
    const input = screen.getByLabelText(/template.uploadTemplate/);
    await waitFor(() => expect(input).not.toBeDisabled());
    fireEvent.change(input, { target: { files: [new File(['image'], 'template.png', { type: 'image/png' })] } });
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(null, 'uploaded'));
    expect(show).not.toHaveBeenCalled();
    expect(busy).toHaveBeenLastCalledWith(true);
    await act(async () => { finish(); });
    expect(show).toHaveBeenCalledWith({ message: 'template.messages.uploadSuccess', type: 'success' });
    expect(input).not.toBeDisabled();
    expect(busy).toHaveBeenLastCalledWith(false);
  });

  it('unlocks the selector after an upload fails so it can be retried', async () => {
    vi.mocked(uploadUserTemplate).mockRejectedValue(new Error('offline'));
    const busy = vi.fn();
    const onSelect = vi.fn();
    render(<TemplateSelector onSelect={onSelect} onBusyChange={busy} />);
    const input = screen.getByLabelText(/template.uploadTemplate/);
    await waitFor(() => expect(input).not.toBeDisabled());
    const file = new File(['image'], 'template.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(show).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' })));
    expect(busy).toHaveBeenLastCalledWith(false);
    expect(input).not.toBeDisabled();
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(uploadUserTemplate).toHaveBeenCalledTimes(2));
  });
});
