import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TemplateAnalysisEditor } from '@/components/template/TemplateAnalysisEditor';
import type { TemplateAsset, TemplateAnalysis } from '@/types';

vi.mock('@/hooks/useT', () => ({
  useT: () => (k: string) => k,
}));

const makeAnalysis = (over: Partial<TemplateAnalysis> = {}): TemplateAnalysis => ({
  template_role: 'cover',
  layout_structure: 'centered',
  content_capacity: 'medium',
  text_regions: [],
  image_regions: [],
  visual_density: 'medium',
  style_keywords: ['minimal', 'bold'],
  color_palette: ['#000', '#fff'],
  notes: 'hello',
  ...over,
});

const makeAsset = (over: Partial<TemplateAsset> = {}): TemplateAsset => ({
  id: 'a1',
  image_url: '/img/a1.png',
  thumb_url: '/thumb/a1.png',
  analysis_status: 'completed',
  analysis_json: makeAnalysis(),
  analysis_notes: 'hello',
  analysis_error: null,
  user_label: null,
  user_edited_analysis: false,
  source: 'upload',
  sort_order: 0,
  ...over,
});

describe('TemplateAnalysisEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the 9 analysis fields prefilled from the asset', () => {
    render(
      <TemplateAnalysisEditor asset={makeAsset()} onSave={vi.fn()} onReanalyze={vi.fn()} />
    );
    expect(screen.getByDisplayValue('cover')).toBeTruthy();
    expect(screen.getByDisplayValue('centered')).toBeTruthy();
    expect(screen.getByDisplayValue('minimal, bold')).toBeTruthy();
    expect(screen.getByDisplayValue('#000, #fff')).toBeTruthy();
    expect(screen.getByDisplayValue('hello')).toBeTruthy();
  });

  it('editing a field and saving calls onSave with the updated analysis and notes', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <TemplateAnalysisEditor asset={makeAsset()} onSave={onSave} onReanalyze={vi.fn()} />
    );
    fireEvent.change(screen.getByDisplayValue('cover'), { target: { value: 'closing' } });
    fireEvent.click(screen.getByText('tae.save'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const [analysisArg, notesArg] = onSave.mock.calls[0];
    expect(analysisArg.template_role).toBe('closing');
    expect(notesArg).toBe('hello');
  });

  it('comma-separated keyword input is parsed into an array on save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <TemplateAnalysisEditor asset={makeAsset()} onSave={onSave} onReanalyze={vi.fn()} />
    );
    fireEvent.change(screen.getByDisplayValue('minimal, bold'), {
      target: { value: 'a, b , c' },
    });
    fireEvent.click(screen.getByText('tae.save'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0].style_keywords).toEqual(['a', 'b', 'c']);
  });

  it('shows the failed-state hint when analysis_status is failed', () => {
    render(
      <TemplateAnalysisEditor
        asset={makeAsset({ analysis_status: 'failed', analysis_json: null })}
        onSave={vi.fn()}
        onReanalyze={vi.fn()}
      />
    );
    expect(screen.getByText('tae.failedHint')).toBeTruthy();
  });

  it('reanalyze button calls onReanalyze', async () => {
    const onReanalyze = vi.fn().mockResolvedValue(undefined);
    render(
      <TemplateAnalysisEditor asset={makeAsset()} onSave={vi.fn()} onReanalyze={onReanalyze} />
    );
    fireEvent.click(screen.getByText('tae.reanalyze'));
    await waitFor(() => expect(onReanalyze).toHaveBeenCalled());
  });
});
