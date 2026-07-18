import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TemplatePickerModal } from '@/components/template/TemplatePickerModal';
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

describe('TemplatePickerModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all assets as thumbnails', () => {
    const assets = [makeAsset('a1'), makeAsset('a2'), makeAsset('a3')];
    render(
      <TemplatePickerModal
        isOpen
        onClose={vi.fn()}
        assets={assets}
        onSelect={vi.fn()}
      />
    );
    const imgs = screen.getAllByRole('img');
    expect(imgs).toHaveLength(3);
  });

  it('selecting an asset calls onSelect with its id then onClose', async () => {
    const onSelect = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const assets = [makeAsset('a1', { user_label: 'Cover' })];
    render(
      <TemplatePickerModal isOpen onClose={onClose} assets={assets} onSelect={onSelect} />
    );
    fireEvent.click(screen.getByAltText('Cover'));
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith('a1'));
    expect(onClose).toHaveBeenCalled();
  });

  it('the "no template" option calls onSelect(null)', async () => {
    const onSelect = vi.fn().mockResolvedValue(undefined);
    render(
      <TemplatePickerModal
        isOpen
        onClose={vi.fn()}
        assets={[makeAsset('a1')]}
        onSelect={onSelect}
        allowNone
      />
    );
    fireEvent.click(screen.getByText('tpm.none'));
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(null));
  });

  it('uploading a new template auto-selects the returned asset', async () => {
    const newAsset = makeAsset('uploaded');
    const onUpload = vi.fn().mockResolvedValue(newAsset);
    const onSelect = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <TemplatePickerModal
        isOpen
        onClose={onClose}
        assets={[]}
        onSelect={onSelect}
        onUpload={onUpload}
      />
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'tpl.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(file));
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith('uploaded'));
    expect(onClose).toHaveBeenCalled();
  });
});
