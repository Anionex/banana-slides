import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SwitchToSingleModeDialog } from '@/components/template/SwitchToSingleModeDialog';
import type { TemplateAsset } from '@/types';

vi.mock('@/hooks/useT', () => ({
  useT: () => (k: string) => k,
}));
vi.mock('@/api/client', () => ({
  getImageUrl: (p?: string) => p || '',
}));

const makeAsset = (id: string, over: Partial<TemplateAsset> = {}): TemplateAsset => ({
  id,
  image_url: `/img/${id}.png`,
  thumb_url: `/thumb/${id}.png`,
  analysis_status: 'completed',
  analysis_json: null,
  analysis_notes: null,
  analysis_error: null,
  user_label: null,
  user_edited_analysis: false,
  source: 'upload',
  sort_order: 0,
  ...over,
});

describe('SwitchToSingleModeDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists existing templates as selectable thumbnails', () => {
    render(
      <SwitchToSingleModeDialog
        isOpen
        onClose={vi.fn()}
        assets={[makeAsset('a1'), makeAsset('a2')]}
        onConfirmExisting={vi.fn()}
        onConfirmUpload={vi.fn()}
      />
    );
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });

  it('confirm is disabled until a template is picked or uploaded', () => {
    render(
      <SwitchToSingleModeDialog
        isOpen
        onClose={vi.fn()}
        assets={[makeAsset('a1', { user_label: 'Cover' })]}
        onConfirmExisting={vi.fn()}
        onConfirmUpload={vi.fn()}
      />
    );
    const confirm = screen.getByText('ssm.confirm').closest('button')!;
    expect(confirm.disabled).toBe(true);
    fireEvent.click(screen.getByAltText('Cover'));
    expect(confirm.disabled).toBe(false);
  });

  it('picking an existing template confirms with its id and trimmed style text', async () => {
    const onConfirmExisting = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <SwitchToSingleModeDialog
        isOpen
        onClose={onClose}
        assets={[makeAsset('a1', { user_label: 'Cover' })]}
        onConfirmExisting={onConfirmExisting}
        onConfirmUpload={vi.fn()}
      />
    );
    fireEvent.click(screen.getByAltText('Cover'));
    fireEvent.change(screen.getByPlaceholderText('ssm.stylePlaceholder'), {
      target: { value: '  bold look  ' },
    });
    fireEvent.click(screen.getByText('ssm.confirm'));
    await waitFor(() => expect(onConfirmExisting).toHaveBeenCalledWith('a1', 'bold look'));
    expect(onClose).toHaveBeenCalled();
  });

  it('uploading a new template confirms via onConfirmUpload', async () => {
    const onConfirmUpload = vi.fn().mockResolvedValue(undefined);
    render(
      <SwitchToSingleModeDialog
        isOpen
        onClose={vi.fn()}
        assets={[]}
        onConfirmExisting={vi.fn()}
        onConfirmUpload={onConfirmUpload}
      />
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'tpl.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText('ssm.confirm'));
    await waitFor(() => expect(onConfirmUpload).toHaveBeenCalledWith(file, undefined));
  });
});
