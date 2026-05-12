import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ImportMarkdownModal } from '@/components/shared/ImportMarkdownModal';

describe('ImportMarkdownModal', () => {
  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    onImport: vi.fn().mockResolvedValue(undefined),
    title: 'Import Markdown',
    description: 'Paste Markdown or upload a file.',
    pasteLabel: 'Paste Content',
    pastePlaceholder: 'Paste here...',
    uploadLabel: 'Upload File',
    uploadHint: 'Choose or drop a file',
    importButtonLabel: 'Import',
    cancelButtonLabel: 'Cancel',
    emptyError: 'Need content',
    readFileError: 'Read failed',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('imports pasted markdown', async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    render(<ImportMarkdownModal {...baseProps} onImport={onImport} />);

    fireEvent.change(screen.getByPlaceholderText('Paste here...'), {
      target: { value: '## Page 1: Intro' },
    });
    fireEvent.click(screen.getByText('Import'));

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledWith('## Page 1: Intro');
    });
  });

  it('loads uploaded file content into textarea', async () => {
    render(<ImportMarkdownModal {...baseProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['## Page 2: Market'], 'slides.md', { type: 'text/markdown' });
    Object.defineProperty(file, 'text', {
      value: vi.fn().mockResolvedValue('## Page 2: Market'),
    });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Paste here...')).toHaveValue('## Page 2: Market');
    });
    expect(screen.getByText('slides.md')).toBeInTheDocument();
  });
});
