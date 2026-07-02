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
    uploadFormatsHint: 'Supports .md and .txt',
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

  it('keeps import disabled until content is provided', () => {
    render(<ImportMarkdownModal {...baseProps} />);

    const importButton = screen.getByText('Import');
    expect(importButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Paste here...'), {
      target: { value: '## Page 1: Intro' },
    });

    expect(importButton).toBeEnabled();
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

  it('shows import preview count from pasted markdown', async () => {
    render(
      <ImportMarkdownModal
        {...baseProps}
        getPreviewCount={(markdown) => markdown.split('## Page').length - 1}
        previewReadyLabel={(count) => `${count} pages will be appended`}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Paste here...'), {
      target: { value: '## Page 1: Intro\n\n## Page 2: Summary' },
    });

    expect(await screen.findByText('2 pages will be appended')).toBeInTheDocument();
  });

  it('disables import when preview detects no pages', () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    render(
      <ImportMarkdownModal
        {...baseProps}
        onImport={onImport}
        getPreviewCount={() => 0}
        previewEmptyLabel="No pages detected"
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Paste here...'), {
      target: { value: 'plain text without page headings' },
    });

    expect(screen.getByText('No pages detected')).toBeInTheDocument();
    expect(screen.getByText('Import')).toBeDisabled();
    expect(onImport).not.toHaveBeenCalled();
  });
});
