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
    invalidFileTypeError: 'Only Markdown or text files can be imported',
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

  it('rejects unsupported uploaded files before reading content', async () => {
    render(<ImportMarkdownModal {...baseProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(screen.getByPlaceholderText('Paste here...'), {
      target: { value: '## Draft content' },
    });
    const file = new File(['%PDF-1.7'], 'slides.pdf', { type: 'application/pdf' });
    const text = vi.fn().mockResolvedValue('%PDF-1.7');
    Object.defineProperty(file, 'text', { value: text });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Only Markdown or text files can be imported')).toBeInTheDocument();
    });
    expect(text).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('Paste here...')).toHaveValue('## Draft content');
    expect(screen.queryByText('slides.pdf')).not.toBeInTheDocument();
  });

  it('rejects malformed uploaded file objects defensively', async () => {
    render(<ImportMarkdownModal {...baseProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const text = vi.fn().mockResolvedValue('not a real file');
    const malformedFile = { type: 'text/plain', text } as unknown as File;

    fireEvent.change(input, { target: { files: [malformedFile] } });

    await waitFor(() => {
      expect(screen.getByText('Only Markdown or text files can be imported')).toBeInTheDocument();
    });
    expect(text).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('Paste here...')).toHaveValue('');
  });
});
