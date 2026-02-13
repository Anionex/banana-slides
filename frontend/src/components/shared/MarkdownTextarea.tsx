import React, { useRef, useEffect, useCallback, useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { cn } from '@/utils';
import { useT } from '@/hooks/useT';
import { isUploadingUrl, getUploadingPreviewUrl } from '@/hooks/useImagePaste';

const markdownTextareaI18n = {
  zh: {
    markdownTextarea: {
      dropImages: '拖放图片到此处',
      uploadImage: '上传图片',
      imageDescription: '图片描述',
      doubleClickToEdit: '双击编辑描述',
      uploading: '上传中...',
    }
  },
  en: {
    markdownTextarea: {
      dropImages: 'Drop images here',
      uploadImage: 'Upload image',
      imageDescription: 'Image description',
      doubleClickToEdit: 'Double-click to edit description',
      uploading: 'Uploading...',
    }
  }
};

const IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;
const CHIP_SELECTED_CLASS = 'md-chip-selected';
const CHIP_CLASS = 'md-chip';

interface MarkdownTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLDivElement>) => void;
  /** Called when files are dropped or selected via upload button */
  onFiles?: (files: File[]) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  className?: string;
  rows?: number;
  /** Show the inline image upload button. Default: true when onFiles is provided */
  showUploadButton?: boolean;
  /** Extra content rendered on the left side of the toolbar (after built-in buttons) */
  toolbarLeft?: React.ReactNode;
  /** Content rendered on the right side of the toolbar */
  toolbarRight?: React.ReactNode;
  /** Show compact image preview strip. Default: true */
  showImagePreview?: boolean;
}

/** Ref handle for MarkdownTextarea */
export interface MarkdownTextareaRef {
  /** Insert text at the current cursor position */
  insertAtCursor: (text: string) => void;
  /** Focus the editor */
  focus: () => void;
}

function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

type Segment =
  | { type: 'text'; content: string }
  | { type: 'image'; alt: string; url: string; raw: string };

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  const regex = new RegExp(IMAGE_REGEX.source, 'g');
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'image', alt: match[1] || 'image', url: match[2], raw: match[0] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }
  return segments;
}

function serializeDOM(element: HTMLElement): string {
  let result = '';
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += (node.textContent || '').replace(/\u200B/g, '');
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.tagName === 'BR') {
        result += '\n';
      } else if (el.dataset.markdown) {
        result += el.dataset.markdown;
      } else if (el.tagName === 'DIV') {
        if (node !== element.firstChild) result += '\n';
        result += serializeDOM(el);
      } else {
        result += serializeDOM(el);
      }
    }
  }
  return result;
}

function getDisplayName(alt: string, url: string): string {
  if (alt && alt !== 'image') return alt;
  const filename = url.split('/').pop() || 'image';
  try {
    return decodeURIComponent(filename.replace(/_\d{10,}\./, '.'));
  } catch {
    return filename;
  }
}

const IMAGE_ICON = '<svg class="flex-shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';
const SPINNER_ICON = '<span class="inline-block w-3 h-3 border-2 border-gray-500 border-t-transparent rounded-full animate-spin flex-shrink-0 dark:border-gray-300 dark:border-t-transparent"></span>';

function applyChipContent(chip: HTMLElement, seg: { alt: string; url: string; raw: string }, tooltips?: { edit: string; uploading: string }) {
  const uploading = isUploadingUrl(seg.url);
  chip.dataset.markdown = seg.raw;
  chip.dataset.alt = seg.alt;
  chip.dataset.url = seg.url;
  chip.title = uploading
    ? (tooltips?.uploading || '')
    : (tooltips?.edit || '');
  chip.className = [
    CHIP_CLASS,
    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium',
    'cursor-default select-none align-middle mx-0.5 transition-colors',
    uploading
      ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700'
      : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600',
  ].join(' ');
  const displayName = getDisplayName(seg.alt, seg.url);
  chip.innerHTML = `${uploading ? SPINNER_ICON : IMAGE_ICON}<span style="max-width:150px" class="truncate">${escapeHtml(displayName)}</span>`;
}

function buildDOM(container: HTMLElement, segments: Segment[], tooltips?: { edit: string; uploading: string }) {
  container.innerHTML = '';
  for (const segment of segments) {
    if (segment.type === 'text') {
      const lines = segment.content.split('\n');
      lines.forEach((line, i) => {
        if (i > 0) container.appendChild(document.createElement('br'));
        if (line) container.appendChild(document.createTextNode(line));
      });
    } else {
      const chip = document.createElement('span');
      chip.contentEditable = 'false';
      applyChipContent(chip, segment, tooltips);
      container.appendChild(chip);
    }
  }
  if (container.childNodes.length === 0) {
    container.appendChild(document.createElement('br'));
  }
}

/**
 * Try to patch chips in-place when only image URLs/alt changed.
 * Returns true if successful (cursor preserved), false if full rebuild needed.
 */
function patchChips(container: HTMLElement, oldValue: string, newValue: string, tooltips?: { edit: string; uploading: string }): boolean {
  const oldSegs = parseSegments(oldValue);
  const newSegs = parseSegments(newValue);

  if (oldSegs.length !== newSegs.length) return false;

  for (let i = 0; i < oldSegs.length; i++) {
    if (oldSegs[i].type !== newSegs[i].type) return false;
    if (oldSegs[i].type === 'text' && newSegs[i].type === 'text') {
      if ((oldSegs[i] as { content: string }).content !== (newSegs[i] as { content: string }).content) return false;
    }
  }

  // Structure matches — update changed chips in place
  const chips = Array.from(container.querySelectorAll('.' + CHIP_CLASS)) as HTMLElement[];
  let chipIdx = 0;
  for (let i = 0; i < newSegs.length; i++) {
    if (newSegs[i].type === 'image') {
      const newSeg = newSegs[i] as { alt: string; url: string; raw: string };
      const oldSeg = oldSegs[i] as { raw: string };
      const chip = chips[chipIdx++];
      if (chip && oldSeg.raw !== newSeg.raw) {
        applyChipContent(chip, newSeg, tooltips);
      }
    }
  }
  return true;
}

function getChipBeforeCursor(): HTMLElement | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset === 0) {
    const prev = range.startContainer.previousSibling as HTMLElement | null;
    if (prev?.dataset?.markdown) return prev;
  }
  if (range.startContainer.nodeType === Node.ELEMENT_NODE && range.startOffset > 0) {
    const prev = range.startContainer.childNodes[range.startOffset - 1] as HTMLElement | null;
    if (prev?.dataset?.markdown) return prev;
  }
  return null;
}

function getChipAfterCursor(): HTMLElement | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (range.startContainer.nodeType === Node.TEXT_NODE) {
    if (range.startOffset === (range.startContainer.textContent || '').length) {
      const next = range.startContainer.nextSibling as HTMLElement | null;
      if (next?.dataset?.markdown) return next;
    }
  }
  if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
    const next = range.startContainer.childNodes[range.startOffset] as HTMLElement | null;
    if (next?.dataset?.markdown) return next;
  }
  return null;
}

function clearChipSelection(container: HTMLElement) {
  container.querySelectorAll('.' + CHIP_SELECTED_CLASS).forEach(el => {
    el.classList.remove(CHIP_SELECTED_CLASS, 'ring-2', 'ring-red-400', 'bg-red-50', 'dark:bg-red-900/30');
  });
}

function selectChip(chip: HTMLElement) {
  chip.classList.add(CHIP_SELECTED_CLASS, 'ring-2', 'ring-red-400', 'bg-red-50', 'dark:bg-red-900/30');
}

export const MarkdownTextarea = forwardRef<MarkdownTextareaRef, MarkdownTextareaProps>(({
  value,
  onChange,
  onPaste,
  onFiles,
  placeholder,
  label,
  error,
  className,
  rows = 4,
  showUploadButton,
  toolbarLeft,
  toolbarRight,
  showImagePreview = true,
}, ref) => {
  const t = useT(markdownTextareaI18n);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastValueRef = useRef(value);
  const isInternalRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [editingChip, setEditingChip] = useState<{ chip: HTMLElement; rect: DOMRect } | null>(null);
  const [editAlt, setEditAlt] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const dragCountRef = useRef(0);

  const shouldShowUpload = showUploadButton ?? !!onFiles;
  const hasToolbar = shouldShowUpload || toolbarLeft || toolbarRight;

  // Keep chip tooltips in a ref so imperative DOM functions can read the latest i18n
  const chipTooltipsRef = useRef({ edit: '', uploading: '' });
  chipTooltipsRef.current = {
    edit: t('markdownTextarea.doubleClickToEdit'),
    uploading: t('markdownTextarea.uploading'),
  };

  // Initial render
  useEffect(() => {
    if (editorRef.current) {
      buildDOM(editorRef.current, parseSegments(value), chipTooltipsRef.current);
      lastValueRef.current = value;
    }
  }, []);

  // Sync from external value changes — incremental patch when possible
  useEffect(() => {
    if (isInternalRef.current) {
      isInternalRef.current = false;
      // Even when skipping internal edits, check for external changes
      // batched in the same render (e.g. upload completion while typing)
      if (editorRef.current && value !== lastValueRef.current) {
        if (!patchChips(editorRef.current, lastValueRef.current, value, chipTooltipsRef.current)) {
          buildDOM(editorRef.current, parseSegments(value), chipTooltipsRef.current);
        }
        lastValueRef.current = value;
      }
      return;
    }
    if (editorRef.current && value !== lastValueRef.current) {
      // Try incremental update first (preserves cursor position)
      const patched = patchChips(editorRef.current, lastValueRef.current, value, chipTooltipsRef.current);
      if (!patched) {
        // Structure changed — full rebuild (e.g. new placeholder inserted)
        buildDOM(editorRef.current, parseSegments(value), chipTooltipsRef.current);
      }
      lastValueRef.current = value;
    }
  }, [value]);

  // Focus edit input when editing chip
  useEffect(() => {
    if (editingChip && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingChip]);

  const emitChange = useCallback(() => {
    if (!editorRef.current) return;
    const markdown = serializeDOM(editorRef.current);
    isInternalRef.current = true;
    lastValueRef.current = markdown;
    onChange(markdown);
  }, [onChange]);

  // Shared function to insert content (text + chips) at cursor position
  const insertContentAtCursor = useCallback((text: string) => {
    if (!editorRef.current) return;

    // Parse the text to find image markdown and insert chips directly
    const segments = parseSegments(text);
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      // Fallback: just insert as text
      document.execCommand('insertText', false, text);
      emitChange();
      return;
    }

    const range = sel.getRangeAt(0);
    range.deleteContents();

    // Insert segments in order
    for (const segment of segments) {
      if (segment.type === 'text') {
        // Insert text nodes, handling newlines
        const lines = segment.content.split('\n');
        lines.forEach((line, i) => {
          if (i > 0) {
            range.insertNode(document.createElement('br'));
            range.collapse(false);
          }
          if (line) {
            const textNode = document.createTextNode(line);
            range.insertNode(textNode);
            range.setStartAfter(textNode);
            range.collapse(true);
          }
        });
      } else {
        // Insert chip element directly
        const chip = document.createElement('span');
        chip.contentEditable = 'false';
        applyChipContent(chip, segment, chipTooltipsRef.current);
        range.insertNode(chip);
        range.setStartAfter(chip);
        range.collapse(true);
      }
    }

    // Update selection to after inserted content
    sel.removeAllRanges();
    sel.addRange(range);

    emitChange();
  }, [emitChange]);

  // Expose insertAtCursor method via ref for external use (e.g., useImagePaste)
  useImperativeHandle(ref, () => ({
    insertAtCursor: (text: string) => {
      if (!editorRef.current) return;
      editorRef.current.focus();
      insertContentAtCursor(text);
    },
    focus: () => {
      editorRef.current?.focus();
    },
  }), [insertContentAtCursor]);

  // --- Chip editing ---
  const startEditChip = useCallback((chip: HTMLElement) => {
    if (isUploadingUrl(chip.dataset.url || '')) return;
    const rect = chip.getBoundingClientRect();
    const containerRect = editorRef.current?.closest('.relative')?.getBoundingClientRect();
    if (!containerRect) return;
    setEditAlt(chip.dataset.alt || '');
    setEditingChip({
      chip,
      rect: new DOMRect(
        rect.left - containerRect.left,
        rect.bottom - containerRect.top + 4,
        rect.width,
        rect.height,
      ),
    });
  }, []);

  const commitChipEdit = useCallback(() => {
    if (!editingChip) return;
    const { chip } = editingChip;
    const url = chip.dataset.url || '';
    const newAlt = editAlt.trim() || 'image';
    const newMarkdown = `![${newAlt}](${url})`;
    chip.dataset.markdown = newMarkdown;
    chip.dataset.alt = newAlt;
    const nameSpan = chip.querySelector('.truncate');
    if (nameSpan) nameSpan.textContent = newAlt;
    setEditingChip(null);
    emitChange();
  }, [editingChip, editAlt, emitChange]);

  const cancelChipEdit = useCallback(() => {
    setEditingChip(null);
  }, []);

  // --- Key handling ---
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!editorRef.current) return;

    if (e.key === 'Backspace') {
      const selected = editorRef.current.querySelector('.' + CHIP_SELECTED_CLASS) as HTMLElement | null;
      if (selected) {
        e.preventDefault();
        selected.remove();
        emitChange();
        return;
      }
      const chip = getChipBeforeCursor();
      if (chip) {
        e.preventDefault();
        selectChip(chip);
        return;
      }
    } else if (e.key === 'Delete') {
      const selected = editorRef.current.querySelector('.' + CHIP_SELECTED_CLASS) as HTMLElement | null;
      if (selected) {
        e.preventDefault();
        selected.remove();
        emitChange();
        return;
      }
      const chip = getChipAfterCursor();
      if (chip) {
        e.preventDefault();
        selectChip(chip);
        return;
      }
    } else {
      clearChipSelection(editorRef.current);
    }
  }, [emitChange]);

  const handleInput = useCallback(() => {
    if (editorRef.current) clearChipSelection(editorRef.current);
    emitChange();
  }, [emitChange]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    onPaste?.(e);
    if (!e.defaultPrevented) {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      // Use insertContentAtCursor to properly handle markdown images as chips
      insertContentAtCursor(text);
    }
  }, [onPaste, insertContentAtCursor]);

  const handleCopy = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const fragment = range.cloneContents();
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(fragment);
    const markdown = serializeDOM(tempDiv);
    e.preventDefault();
    e.clipboardData.setData('text/plain', markdown);
  }, []);

  const handleCut = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const fragment = range.cloneContents();
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(fragment);
    const markdown = serializeDOM(tempDiv);
    e.preventDefault();
    e.clipboardData.setData('text/plain', markdown);
    // Delete the selected content after copying
    range.deleteContents();
    emitChange();
  }, [emitChange]);

  const handleClick = useCallback(() => {
    if (editorRef.current) clearChipSelection(editorRef.current);
    setEditingChip(null);
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest('.' + CHIP_CLASS) as HTMLElement | null;
    if (target?.dataset?.markdown) {
      e.preventDefault();
      startEditChip(target);
    }
  }, [startEditChip]);

  // --- Drag and drop ---
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCountRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCountRef.current--;
    if (dragCountRef.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCountRef.current = 0;
    setIsDragging(false);
    if (onFiles && e.dataTransfer.files.length > 0) {
      onFiles(Array.from(e.dataTransfer.files));
    }
  }, [onFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && onFiles) {
      onFiles(Array.from(files));
    }
    e.target.value = '';
  }, [onFiles]);

  // Click on toolbar empty area → focus editor
  const handleToolbarMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only handle clicks on the toolbar itself, not on buttons inside
    if (e.target === e.currentTarget || !(e.target as HTMLElement).closest('button, a, input, [role="button"]')) {
      e.preventDefault(); // prevent editor blur
      editorRef.current?.focus();
    }
  }, []);

  // --- Image preview ---
  const images = useMemo(() =>
    parseSegments(value).filter((s): s is Extract<Segment, { type: 'image' }> => s.type === 'image'),
    [value]
  );

  const removeImage = useCallback((url: string) => {
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`!\\[[^\\]]*\\]\\(${escaped}\\)\\n?`, 'g');
    const newValue = value.replace(regex, '').replace(/\n{3,}/g, '\n\n').trim();
    if (editorRef.current) {
      buildDOM(editorRef.current, parseSegments(newValue), chipTooltipsRef.current);
    }
    isInternalRef.current = true;
    lastValueRef.current = newValue;
    onChange(newValue);
  }, [value, onChange]);

  const minHeight = rows * 24;
  const isEmpty = !value.trim();

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">
          {label}
        </label>
      )}
      {/* Outer container — owns the border, focus ring, and toolbar */}
      <div className={cn(
        'rounded-lg border border-gray-200 dark:border-border-primary bg-white dark:bg-background-secondary',
        'focus-within:ring-2 focus-within:ring-banana-500 focus-within:border-transparent',
        'transition-all',
        isDragging && 'ring-2 ring-banana-400 border-banana-400 bg-banana-50/50 dark:bg-banana-900/10',
        error && 'border-red-500 focus-within:ring-red-500',
        className
      )}>
        {/* Editor area */}
        <div className="relative">
          <div
            ref={editorRef}
            contentEditable
            role="textbox"
            aria-multiline="true"
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            onPaste={handlePaste}
            onCopy={handleCopy}
            onCut={handleCut}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            style={{ minHeight: `${minHeight}px` }}
            className="w-full px-4 py-3 outline-none overflow-y-auto resize-y whitespace-pre-wrap break-words text-gray-900 dark:text-foreground-primary"
          />

          {/* Placeholder */}
          {isEmpty && placeholder && !isDragging && (
            <div className="absolute top-0 left-0 right-0 px-4 py-3 text-gray-400 dark:text-gray-500 pointer-events-none select-none">
              {placeholder}
            </div>
          )}

          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg pointer-events-none">
              <div className="flex items-center gap-2 px-4 py-2 bg-banana-100 dark:bg-banana-900/50 rounded-full text-sm font-medium text-banana-700 dark:text-banana-300">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                </svg>
                {t('markdownTextarea.dropImages')}
              </div>
            </div>
          )}

          {/* Chip edit popover */}
          {editingChip && (
            <div
              className="absolute z-20 flex items-center gap-1 bg-white dark:bg-background-secondary border border-gray-300 dark:border-border-primary rounded-lg shadow-lg p-1"
              style={{ left: editingChip.rect.left, top: editingChip.rect.top }}
            >
              <input
                ref={editInputRef}
                type="text"
                value={editAlt}
                onChange={(e) => setEditAlt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitChipEdit(); }
                  if (e.key === 'Escape') cancelChipEdit();
                }}
                onBlur={commitChipEdit}
                className="px-2 py-1 text-xs border-none outline-none bg-transparent w-36 text-gray-900 dark:text-foreground-primary"
                placeholder={t('markdownTextarea.imageDescription')}
              />
            </div>
          )}
        </div>

        {/* Toolbar */}
        {hasToolbar && (
          <div
            className="flex items-center gap-1 px-2 py-1.5 cursor-text"
            onMouseDown={handleToolbarMouseDown}
          >
            <div className="flex items-center gap-0.5">
              {shouldShowUpload && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-foreground-tertiary dark:hover:text-foreground-secondary dark:hover:bg-background-hover rounded transition-colors cursor-pointer"
                  title={t('markdownTextarea.uploadImage')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                  </svg>
                </button>
              )}
              {toolbarLeft}
            </div>
            <div className="flex-1" />
            {toolbarRight && (
              <div className="flex items-center gap-1">
                {toolbarRight}
              </div>
            )}
          </div>
        )}

        {/* Compact image preview strip — below toolbar */}
        {showImagePreview && images.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto border-t border-gray-100 dark:border-border-primary">
            {images.map((img, i) => {
              const uploading = isUploadingUrl(img.url);
              const src = uploading ? getUploadingPreviewUrl(img.url) : img.url;
              return (
                <div key={`${img.url}-${i}`} className="relative flex-shrink-0 group/thumb" title={img.alt !== 'image' ? img.alt : getDisplayName(img.alt, img.url)}>
                  <div className={cn(
                    'w-14 h-14 rounded overflow-hidden border border-gray-200 dark:border-border-primary',
                    uploading && 'opacity-60'
                  )}>
                    <img
                      src={src}
                      alt={img.alt}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    {uploading && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-banana-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  {!uploading && (
                    <button
                      type="button"
                      onClick={() => removeImage(img.url)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center bg-red-500 text-white rounded-full opacity-0 group-hover/thumb:opacity-100 transition-opacity hover:bg-red-600 text-xs leading-none"
                    >
                      &times;
                    </button>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate opacity-0 group-hover/thumb:opacity-100 transition-opacity rounded-b">
                    {img.alt !== 'image' ? img.alt : getDisplayName(img.alt, img.url)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Hidden file input for image upload */}
      {shouldShowUpload && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileInput}
          className="hidden"
        />
      )}

      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
});

// Add display name for better debugging
MarkdownTextarea.displayName = 'MarkdownTextarea';
