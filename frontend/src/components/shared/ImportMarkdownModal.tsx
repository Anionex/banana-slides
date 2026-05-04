import React, { useCallback, useRef, useState } from 'react';
import { FileText, Upload } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';
import { Textarea } from './Textarea';

interface ImportMarkdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (markdown: string) => Promise<void>;
  title: string;
  description: string;
  pasteLabel: string;
  pastePlaceholder: string;
  uploadLabel: string;
  uploadHint: string;
  uploadFormatsHint: string;
  importButtonLabel: string;
  cancelButtonLabel: string;
  emptyError: string;
  readFileError: string;
}

export const ImportMarkdownModal: React.FC<ImportMarkdownModalProps> = ({
  isOpen,
  onClose,
  onImport,
  title,
  description,
  pasteLabel,
  pastePlaceholder,
  uploadLabel,
  uploadHint,
  uploadFormatsHint,
  importButtonLabel,
  cancelButtonLabel,
  emptyError,
  readFileError,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');

  const resetState = useCallback(() => {
    setContent('');
    setError('');
    setIsImporting(false);
    setIsDragging(false);
    setSelectedFileName('');
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const handleClose = useCallback(() => {
    if (isImporting) return;
    resetState();
    onClose();
  }, [isImporting, onClose, resetState]);

  const readFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      setContent(text);
      setSelectedFileName(file.name);
      setError('');
    } catch {
      setError(readFileError);
    }
  }, [readFileError]);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await readFile(file);
  }, [readFile]);

  const handleDrop = useCallback(async (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await readFile(file);
  }, [readFile]);

  const handleImportClick = useCallback(async () => {
    const markdown = content.trim();
    if (!markdown) {
      setError(emptyError);
      return;
    }

    setIsImporting(true);
    setError('');
    try {
      await onImport(markdown);
      resetState();
      onClose();
    } catch {
      // Let caller own toast/error message; keep modal open for retry.
    } finally {
      setIsImporting(false);
    }
  }, [content, emptyError, onClose, onImport, resetState]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} size="lg">
      <div className="space-y-4">
        <p className="text-sm leading-6 text-gray-600 dark:text-foreground-secondary">
          {description}
        </p>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-foreground-secondary">
            <FileText size={16} />
            {pasteLabel}
          </div>
          <Textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (error) setError('');
            }}
            placeholder={pastePlaceholder}
            className="min-h-[200px] resize-none rounded-xl border-gray-200 bg-gray-50 font-mono text-sm dark:border-border-primary dark:bg-background-primary"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-foreground-secondary">
            <Upload size={16} />
            {uploadLabel}
          </div>
          <label
            className={`flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-all ${
              isDragging
                ? 'border-banana-400 bg-banana-50/80 dark:border-banana-400 dark:bg-banana-900/20'
                : 'border-gray-200 bg-white hover:border-banana-300 hover:bg-banana-50/40 dark:border-border-primary dark:bg-background-primary dark:hover:border-banana-500/40 dark:hover:bg-background-hover'
            }`}
            onDragEnter={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => {
              e.preventDefault();
              if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
              setIsDragging(false);
            }}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".md,.txt,text/markdown,text/plain"
              className="hidden"
              onChange={handleFileSelect}
            />
            <div className={`mb-4 transition-transform ${isDragging ? 'scale-110' : ''}`}>
              <Upload size={34} className="text-gray-700 dark:text-foreground-primary" />
            </div>
            <div className="text-[15px] font-semibold text-gray-800 dark:text-foreground-primary">
              {selectedFileName || uploadHint}
            </div>
            <div className="mt-2 text-sm text-gray-500 dark:text-foreground-tertiary">
              {selectedFileName ? uploadFormatsHint : null}
            </div>
          </label>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={isImporting}>
            {cancelButtonLabel}
          </Button>
          <Button size="sm" onClick={handleImportClick} loading={isImporting}>
            {importButtonLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
