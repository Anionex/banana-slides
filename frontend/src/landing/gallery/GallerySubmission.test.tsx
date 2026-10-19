import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GallerySubmission } from './GallerySubmission';

vi.mock('../../utils/publicDemo', () => ({ visitorHeaders: () => ({ 'X-User-Token': 'visitor' }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' } }) }));

class UploadRequest {
  static sent: UploadRequest[] = [];
  upload: { onprogress?: (event: { lengthComputable: boolean; loaded: number; total: number }) => void } = {};
  onload?: () => void;
  onerror?: () => void;
  ontimeout?: () => void;
  status = 200;
  responseText = '';
  timeout = 0;
  open = vi.fn();
  setRequestHeader = vi.fn();
  abort = vi.fn();
  send = vi.fn(() => UploadRequest.sent.push(this));
  respond(body: unknown, status = 200) { this.status = status; this.responseText = JSON.stringify(body); this.onload?.(); }
}
beforeEach(() => { UploadRequest.sent = []; vi.stubGlobal('XMLHttpRequest', UploadRequest); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const pdf = () => new File(['%PDF-'], 'complete.pdf', { type: 'application/pdf' });
function choose(file = pdf()) { if (!screen.queryByRole('dialog')) fireEvent.click(screen.getByRole('button', { name: 'Share your presentation' })); fireEvent.change(screen.getByLabelText('Choose a complete PDF'), { target: { files: [file] } }); }

describe('private PDF submission', () => {
  it('keeps upload controls out of the gallery until the invitation is opened', () => {
    render(<GallerySubmission language="en" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Choose a complete PDF')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Share your presentation' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Choose a complete PDF')).toBeInTheDocument();
  });
  it('waits for server acknowledgement even after all bytes are uploaded and prevents duplicate sends', () => {
    render(<GallerySubmission language="en" />);
    choose();
    const send = screen.getByRole('button', { name: 'Send presentation' });
    fireEvent.click(send); fireEvent.click(send);
    expect(UploadRequest.sent).toHaveLength(1);
    const xhr = UploadRequest.sent[0];
    act(() => xhr.upload.onprogress?.({ lengthComputable: true, loaded: 100, total: 100 }));
    expect(screen.getByText('Checking export metadata…')).toBeInTheDocument();
    expect(screen.queryByText('Presentation received')).not.toBeInTheDocument();
    act(() => xhr.respond({ data: { received: true, page_count: 3 } }));
    expect(screen.getByText('Presentation received')).toBeInTheDocument();
    expect(screen.getByText('3 slides saved. Only administrators can access the PDF.')).toBeInTheDocument();
  });

  it('retains the file when validation fails and allows retrying', () => {
    render(<GallerySubmission language="en" />); choose();
    fireEvent.click(screen.getByRole('button', { name: 'Send presentation' }));
    act(() => UploadRequest.sent[0].respond({ error: { code: 'NOT_BANANA_EXPORT' } }, 400));
    expect(screen.getByRole('alert')).toHaveTextContent('export metadata was not found');
    expect(screen.getByText('complete.pdf')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send presentation' }));
    expect(UploadRequest.sent).toHaveLength(2);
  });

  it('clears a previously selected file when its replacement is invalid', () => {
    render(<GallerySubmission language="en" />); choose();
    choose(new File(['image'], 'image.png', { type: 'image/png' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a PDF');
    expect(screen.queryByRole('button', { name: 'Send presentation' })).not.toBeInTheDocument();
    expect(UploadRequest.sent).toHaveLength(0);
  });

  it('accepts a dropped PDF without sending it until the user submits', () => {
    const view = render(<GallerySubmission language="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'Share your presentation' }));
    fireEvent.drop(document.querySelector('.gallery-submission-form')!, { dataTransfer: { files: [pdf()] } });
    expect(screen.getByText('complete.pdf')).toBeInTheDocument();
    expect(UploadRequest.sent).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Send presentation' }));
    const xhr = UploadRequest.sent[0];
    view.unmount();
    expect(xhr.abort).toHaveBeenCalledOnce();
  });
});
