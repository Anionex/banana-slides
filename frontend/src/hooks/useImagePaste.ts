import { useState, useCallback } from 'react';
import { uploadMaterial } from '@/api/endpoints';
import { useT } from '@/hooks/useT';

const ALLOWED_IMAGE_TYPES = [
  'image/png', 'image/jpeg', 'image/gif',
  'image/webp', 'image/bmp', 'image/svg+xml',
];

const imagePasteI18n = {
  zh: {
    imagePaste: {
      uploading: '正在上传图片...',
      uploadSuccess: '{{count}} 张图片已插入',
      uploadSuccessSingle: '图片已插入',
      uploadFailed: '图片上传失败',
      partialSuccess: '{{success}} 张上传成功，{{failed}} 张失败',
      unsupportedType: '不支持的文件类型：{{types}}',
    }
  },
  en: {
    imagePaste: {
      uploading: 'Uploading images...',
      uploadSuccess: '{{count}} images inserted',
      uploadSuccessSingle: 'Image inserted',
      uploadFailed: 'Image upload failed',
      partialSuccess: '{{success}} uploaded, {{failed}} failed',
      unsupportedType: 'Unsupported file type: {{types}}',
    }
  }
};

interface UseImagePasteOptions {
  projectId?: string | null;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  content: string;
  setContent: (updater: (prev: string) => string) => void;
  generateCaption?: boolean;
  showToast: (props: { message: string; type: 'success' | 'error' | 'info' | 'warning' }) => void;
}

export const useImagePaste = ({
  projectId,
  textareaRef,
  content,
  setContent,
  generateCaption = true,
  showToast,
}: UseImagePasteOptions) => {
  const t = useT(imagePasteI18n);
  const [isUploading, setIsUploading] = useState(false);

  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items || isUploading) return;

    const imageFiles: File[] = [];
    const unsupportedTypes: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind !== 'file') continue;

      const file = item.getAsFile();
      if (!file) continue;

      if (ALLOWED_IMAGE_TYPES.includes(item.type)) {
        imageFiles.push(file);
      } else {
        const ext = file.name.split('.').pop() || item.type;
        unsupportedTypes.push(ext);
      }
    }

    if (imageFiles.length === 0 && unsupportedTypes.length === 0) return;

    e.preventDefault();

    if (unsupportedTypes.length > 0) {
      showToast({
        message: t('imagePaste.unsupportedType', { types: unsupportedTypes.join(', ') }),
        type: 'warning',
      });
    }

    if (imageFiles.length === 0) return;

    setIsUploading(true);
    const cursorPos = textareaRef.current?.selectionStart ?? content.length;

    try {
      const results = await Promise.allSettled(
        imageFiles.map(file => uploadMaterial(file, projectId ?? null, generateCaption))
      );

      const markdownParts: string[] = [];
      let failedCount = 0;

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value?.data?.url) {
          const caption = result.value.data.caption || 'image';
          markdownParts.push(`![${caption}](${result.value.data.url})`);
        } else {
          failedCount++;
        }
      }

      if (markdownParts.length > 0) {
        const markdownInsert = markdownParts.join('\n');
        setContent(prev => {
          const before = prev.slice(0, cursorPos);
          const after = prev.slice(cursorPos);
          const prefix = before && !before.endsWith('\n') ? '\n' : '';
          const suffix = after && !after.startsWith('\n') ? '\n' : '';
          return before + prefix + markdownInsert + suffix + after;
        });
      }

      if (failedCount === 0 && markdownParts.length > 0) {
        showToast({
          message: markdownParts.length === 1
            ? t('imagePaste.uploadSuccessSingle')
            : t('imagePaste.uploadSuccess', { count: String(markdownParts.length) }),
          type: 'success',
        });
      } else if (failedCount > 0 && markdownParts.length > 0) {
        showToast({
          message: t('imagePaste.partialSuccess', {
            success: String(markdownParts.length),
            failed: String(failedCount),
          }),
          type: 'warning',
        });
      } else {
        showToast({ message: t('imagePaste.uploadFailed'), type: 'error' });
      }
    } catch (error) {
      console.error('Image paste upload failed:', error);
      showToast({ message: t('imagePaste.uploadFailed'), type: 'error' });
    } finally {
      setIsUploading(false);
    }
  }, [isUploading, projectId, generateCaption, content, textareaRef, setContent, showToast, t]);

  return { handlePaste, isUploading };
};
