import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TextStyleSelector } from '@/components/shared/TextStyleSelector';
import * as endpoints from '@/api/endpoints';

vi.mock('@/api/endpoints', () => ({
  extractStyleFromImage: vi.fn(),
  generateStyleFromContent: vi.fn(),
  listUserStyleTemplates: vi.fn().mockResolvedValue({ data: { templates: [] } }),
  createUserStyleTemplate: vi.fn(),
  deleteUserStyleTemplate: vi.fn(),
}));

describe('TextStyleSelector Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with default props', () => {
    render(<TextStyleSelector value="" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Generate from content|根据内容生成风格/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Extract from image|从图片提取风格/i })).toBeInTheDocument();
  });

  it('shows error toast when sourceContent is empty and generate button clicked', () => {
    const handleToast = vi.fn();
    render(<TextStyleSelector value="" onChange={vi.fn()} onToast={handleToast} sourceContent="" />);

    const generateBtn = screen.getByRole('button', { name: /Generate from content|根据内容生成风格/i });
    fireEvent.click(generateBtn);

    expect(handleToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
      })
    );
    expect(endpoints.generateStyleFromContent).not.toHaveBeenCalled();
  });

  it('calls generateStyleFromContent and updates value when sourceContent is provided', async () => {
    const handleChange = vi.fn();
    const handleToast = vi.fn();
    (endpoints.generateStyleFromContent as any).mockResolvedValueOnce({
      data: { style_description: '视觉描述：科技风格\n配色与材质：#0B0F19' },
    });

    render(
      <TextStyleSelector
        value=""
        onChange={handleChange}
        onToast={handleToast}
        sourceContent="量子计算与未来人工智能的发展"
      />
    );

    const generateBtn = screen.getByRole('button', { name: /Generate from content|根据内容生成风格/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(endpoints.generateStyleFromContent).toHaveBeenCalledWith('量子计算与未来人工智能的发展', expect.any(String));
      expect(handleChange).toHaveBeenCalledWith('视觉描述：科技风格\n配色与材质：#0B0F19');
      expect(handleToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
        })
      );
    });
  });

  it('handles error gracefully when generateStyleFromContent fails', async () => {
    const handleChange = vi.fn();
    const handleToast = vi.fn();
    (endpoints.generateStyleFromContent as any).mockRejectedValueOnce(
      new Error('Network error')
    );

    render(
      <TextStyleSelector
        value=""
        onChange={handleChange}
        onToast={handleToast}
        sourceContent="量子计算与未来人工智能的发展"
      />
    );

    const generateBtn = screen.getByRole('button', { name: /Generate from content|根据内容生成风格/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(handleToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
        })
      );
      expect(handleChange).not.toHaveBeenCalled();
    });
  });
});

