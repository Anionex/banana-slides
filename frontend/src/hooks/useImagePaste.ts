import { useState, useCallback, useRef } from 'react';
import { uploadMaterial, getMaterialByUrl } from '@/api/endpoints';
import { useT } from '@/hooks/useT';

const ALLOWED_IMAGE_TYPES = [
  'image/png', 'image/jpeg', 'image/gif',
  'image/webp', 'image/bmp', 'image/svg+xml',
];

const UPLOADING_PREFIX = 'uploading:';
const RESOLVING_PREFIX = 'resolving:';

/** Check if a URL is an uploading/resolving placeholder */
export const isUploadingUrl = (url: string) =>
  url.startsWith(UPLOADING_PREFIX) || url.startsWith(RESOLVING_PREFIX);

/** Extract the real URL from an uploading/resolving placeholder */
export const getUploadingPreviewUrl = (url: string) => {
  if (url.startsWith(UPLOADING_PREFIX)) return url.slice(UPLOADING_PREFIX.length);
  if (url.startsWith(RESOLVING_PREFIX)) return url.slice(RESOLVING_PREFIX.length);
  return url;
};

/** Escape markdown special characters in alt text to prevent injection */
export const escapeMarkdown = (text: string): string => {
  return text.replace(/[[\]()]/g, '\\$&');
};

/**
 * Build markdown for selected materials.
 * For materials without a caption, async-fetches one via the caption API
 * and replaces the fallback alt text afterwards.
 */
export const buildMaterialsMarkdown = (
  materials: import('@/types').Material[],
  setContent?: (updater: (prev: string) => string) => void,
): string => {
  const lines: string[] = [];
  const needCaption: { material: import('@/types').Material; fallback: string }[] = [];

  for (const m of materials) {
    const fallback = m.original_filename || m.filename || 'image';
    if (m.caption) {
      lines.push(`![${escapeMarkdown(m.caption)}](${m.url})`);
    } else {
      // Show spinner chip while resolving caption
      lines.push(`![${escapeMarkdown(fallback)}](${RESOLVING_PREFIX}${m.url})`);
      needCaption.push({ material: m, fallback });
    }
  }

  // Async-fetch captions for materials that don't have one yet
  if (needCaption.length > 0 && setContent) {
    (async () => {
      const { getMaterialCaption } = await import('@/api/endpoints');
      const replacements = new Map<string, string>();
      for (const { material, fallback } of needCaption) {
        const oldMd = `![${escapeMarkdown(fallback)}](${RESOLVING_PREFIX}${material.url})`;
        try {
          const response = await getMaterialCaption(material.id);
          const caption = response.data?.caption || fallback;
          replacements.set(oldMd, `![${escapeMarkdown(caption)}](${material.url})`);
        } catch {
          // Caption failed — remove resolving prefix, keep fallback
          replacements.set(oldMd, `![${escapeMarkdown(fallback)}](${material.url})`);
        }
      }
      if (replacements.size > 0) {
        setContent(prev => {
          let content = prev;
          for (const [oldMd, newMd] of replacements.entries()) {
            content = content.replaceAll(oldMd, newMd);
          }
          return content;
        });
      }
    })();
  }

  return lines.join('\n');
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

  // Use refs so handleFiles always accesses the latest setContent/insertAtCursor
  const setContentRef = useRef(setContent);
  setContentRef.current = setContent;
  const insertAtCursorRef = useRef(insertAtCursor);
  insertAtCursorRef.current = insertAtCursor;

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
    if (insertAtCursorRef.current) {
      insertAtCursorRef.current(placeholderInsert + '\n');
    } else {
      setContentRef.current(prev => {
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

          setContentRef.current(prev => prev.replace(markdown, `![${caption}](${realUrl})`));
          return { success: true, captionFailed };
        } catch {
          setContentRef.current(prev => prev.replace(markdown + '\n', '').replace(markdown, ''));
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
  }, [projectId, generateCaption, warnUnsupportedTypes, showToast, t]);

  /** Extract markdown images from text */
  const extractMarkdownImages = useCallback((text: string): Array<{alt: string; url: string; match: string}> => {
    const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const images: Array<{alt: string; url: string; match: string}> = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      images.push({ alt: match[1], url: match[2], match: match[0] });
    }
    return images;
  }, []);

  /** Check if URL is internal material */
  const isInternalMaterialUrl = useCallback((url: string): boolean => {
    return url.startsWith('/files/materials/') || url.includes('/files/projects/') && url.includes('/materials/');
  }, []);

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
      // No image files, check for markdown images
      const text = e.clipboardData?.getData('text/plain');
      if (text) {
        const markdownImages = extractMarkdownImages(text);
        const internalImages = markdownImages.filter(img => isInternalMaterialUrl(img.url));
        if (internalImages.length > 0) {
          e.preventDefault();
          // Insert the pasted text first so it appears in the editor,
          // then async-replace captions for internal material images
          if (insertAtCursorRef.current) {
            insertAtCursorRef.current(text);
          } else {
            setContentRef.current(prev => prev + text);
          }
          (async () => {
            const replacements = new Map<string, string>();
            for (const img of internalImages) {
              try {
                const response = await getMaterialByUrl(img.url);
                const material = response.data;
                if (material?.caption) {
                  const newMarkdown = `![${escapeMarkdown(material.caption)}](${img.url})`;
                  replacements.set(img.match, newMarkdown);
                }
              } catch { /* caption fetch failed, keep original markdown */ }
            }
            if (replacements.size > 0) {
              setContentRef.current(prev => {
                let content = prev;
                for (const [oldMd, newMd] of replacements.entries()) {
                  content = content.replaceAll(oldMd, newMd);
                }
                return content;
              });
            }
          })();
        }
      }
      return;
    }

    e.preventDefault();
    await handleFiles(imageFiles);
  }, [handleFiles, warnUnsupportedTypes, showToast, t, extractMarkdownImages, isInternalMaterialUrl]);

  return { handlePaste, handleFiles, isUploading };
};
