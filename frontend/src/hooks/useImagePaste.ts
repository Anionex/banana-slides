import { useState, useCallback, useRef } from 'react';
import { uploadMaterial } from '@/api/endpoints';
import { useT } from '@/hooks/useT';

const ALLOWED_IMAGE_TYPES = [
  'image/png', 'image/jpeg', 'image/gif',
  'image/webp', 'image/bmp', 'image/svg+xml',
];

const UPLOADING_PREFIX = 'uploading:';

/** Check if a URL is an uploading placeholder */
export const isUploadingUrl = (url: string) => url.startsWith(UPLOADING_PREFIX);

/** Extract the blob preview URL from an uploading placeholder */
export const getUploadingPreviewUrl = (url: string) =>
  isUploadingUrl(url) ? url.slice(UPLOADING_PREFIX.length) : url;

/** Escape markdown special characters in alt text to prevent injection */
const escapeMarkdown = (text: string): string => {
  return text.replace(/[[\]()]/g, '\\$&');
};

/** Generate a placeholder markdown for a file (exported for MarkdownTextarea) */
export const generatePlaceholder = (file: File): { blobUrl: string; markdown: string } => {
  const blobUrl = URL.createObjectURL(file);
  const placeholderUrl = `${UPLOADING_PREFIX}${blobUrl}`;
  const name = escapeMarkdown(file.name.replace(/\.[^.]+$/, '') || 'image');
  return { blobUrl, markdown: `![${name}](${placeholderUrl})` };
};

const imagePasteI18n = {
  zh: {
    imagePaste: {
      uploadSuccess: '{{count}} 张图片已插入',
      uploadSuccessSingle: '图片已插入',
      uploadFailed: '图片上传失败',
      partialSuccess: '{{success}} 张上传成功，{{failed}} 张失败',
      unsupportedType: '不支持的文件类型：{{types}}',
      captionFailed: '图片描述识别失败，已使用文件名替代',
    }
  },
  en: {
    imagePaste: {
      uploadSuccess: '{{count}} images inserted',
      uploadSuccessSingle: 'Image inserted',
      uploadFailed: 'Image upload failed',
      partialSuccess: '{{success}} uploaded, {{failed}} failed',
      unsupportedType: 'Unsupported file type: {{types}}',
      captionFailed: 'Image caption recognition failed, using filename instead',
    }
  }
};

interface UseImagePasteOptions {
  projectId?: string | null;
  setContent: (updater: (prev: string) => string) => void;
  generateCaption?: boolean;
  showToast: (props: { message: string; type: 'success' | 'error' | 'info' | 'warning' }) => void;
  /** Whether to warn about non-image file types. Default: true */
  warnUnsupportedTypes?: boolean;
  /** If provided, use this to insert placeholder at cursor position instead of appending to end */
  insertAtCursor?: (markdown: string) => void;
}

export const useImagePaste = ({
  projectId,
  setContent,
  generateCaption = true,
  showToast,
  warnUnsupportedTypes = true,
  insertAtCursor,
}: UseImagePasteOptions) => {
  const t = useT(imagePasteI18n);
  const [isUploading, setIsUploading] = useState(false);
  const pendingCount = useRef(0);

  /** Core: upload image files with placeholder insertion */
  const handleFiles = useCallback(async (files: File[]) => {
    const imageFiles = files.filter(f => ALLOWED_IMAGE_TYPES.includes(f.type));

    if (imageFiles.length === 0) {
      if (warnUnsupportedTypes && files.length > 0) {
        const types = files.map(f => f.name.split('.').pop() || f.type);
        showToast({
          message: t('imagePaste.unsupportedType', { types: types.join(', ') }),
          type: 'warning',
        });
      }
      return;
    }

    const placeholders = imageFiles.map(file => {
      const { blobUrl, markdown } = generatePlaceholder(file);
      return { file, blobUrl, markdown };
    });

    // Insert placeholders - use insertAtCursor if provided, otherwise append to end
    const placeholderInsert = placeholders.map(p => p.markdown).join('\n');
    if (insertAtCursor) {
      insertAtCursor(placeholderInsert + '\n');
    } else {
      setContent(prev => {
        // Check if placeholders already exist (in case MarkdownTextarea inserted them)
        const newPlaceholders = placeholders.filter(p => !prev.includes(p.markdown));
        if (newPlaceholders.length === 0) {
          return prev; // All placeholders already exist, skip insertion
        }
        const insert = newPlaceholders.map(p => p.markdown).join('\n');
        const prefix = prev && !prev.endsWith('\n') ? '\n' : '';
        return prev + prefix + insert + '\n';
      });
    }

    pendingCount.current += placeholders.length;
    setIsUploading(true);

    const results = await Promise.allSettled(
      placeholders.map(async ({ file, blobUrl, markdown }) => {
        try {
          const response = await uploadMaterial(file, projectId ?? null, generateCaption);
          const realUrl = response?.data?.url;
          const rawCaption = response?.data?.caption || file.name.replace(/\.[^.]+$/, '') || 'image';
          const caption = escapeMarkdown(rawCaption);
          if (!realUrl) throw new Error('No URL in response');

          // Track whether caption generation was requested but failed
          const captionFailed = generateCaption && !response?.data?.caption;

          setContent(prev => prev.replace(markdown, `![${caption}](${realUrl})`));
          return { success: true, captionFailed };
        } catch {
          setContent(prev => prev.replace(markdown + '\n', '').replace(markdown, ''));
          return { success: false };
        } finally {
          URL.revokeObjectURL(blobUrl);
          pendingCount.current--;
          if (pendingCount.current === 0) setIsUploading(false);
        }
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failedCount = placeholders.length - successCount;

    if (failedCount === 0 && successCount > 0) {
      showToast({
        message: successCount === 1
          ? t('imagePaste.uploadSuccessSingle')
          : t('imagePaste.uploadSuccess', { count: String(successCount) }),
        type: 'success',
      });
    } else if (failedCount > 0 && successCount > 0) {
      showToast({
        message: t('imagePaste.partialSuccess', {
          success: String(successCount),
          failed: String(failedCount),
        }),
        type: 'warning',
      });
    } else if (failedCount > 0 && successCount === 0) {
      showToast({ message: t('imagePaste.uploadFailed'), type: 'error' });
    }

    // Warn about caption generation failures (separate from upload success/failure)
    const captionFailedCount = results.filter(
      r => r.status === 'fulfilled' && r.value.captionFailed
    ).length;
    if (captionFailedCount > 0) {
      showToast({ message: t('imagePaste.captionFailed'), type: 'warning' });
    }
  }, [projectId, generateCaption, warnUnsupportedTypes, setContent, insertAtCursor, showToast, t]);

  /** Handle clipboard paste event */
  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    const unsupportedTypes: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind !== 'file') continue;
      const file = item.getAsFile();
      if (!file) continue;

      if (ALLOWED_IMAGE_TYPES.includes(item.type)) {
        imageFiles.push(file);
      } else if (warnUnsupportedTypes) {
        unsupportedTypes.push(file.name.split('.').pop() || item.type);
      }
    }

    if (imageFiles.length === 0) {
      if (unsupportedTypes.length > 0) {
        showToast({
          message: t('imagePaste.unsupportedType', { types: unsupportedTypes.join(', ') }),
          type: 'warning',
        });
      }
      return;
    }

    e.preventDefault();
    await handleFiles(imageFiles);
  }, [handleFiles, warnUnsupportedTypes, showToast, t]);

  return { handlePaste, handleFiles, isUploading };
};
