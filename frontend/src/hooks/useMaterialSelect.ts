import { useCallback } from 'react';
import type { Material } from '@/types';

interface UseMaterialSelectOptions {
  insertAtCursor: (text: string) => void;
  setContent: (updater: (prev: string) => string) => void;
  onError?: (error: unknown) => void;
}

export const useMaterialSelect = ({
  insertAtCursor,
  setContent,
  onError
}: UseMaterialSelectOptions) => {
  const handleMaterialSelect = useCallback(async (materials: Material[]) => {
    try {
      const { getImageUrl } = await import('@/api/client');
      const { getMaterialCaption } = await import('@/api/endpoints');
      const { escapeMarkdown } = await import('@/hooks/useImagePaste');

      const placeholders = materials.map(m => {
        const filename = m.original_filename || m.filename || 'image';
        const realUrl = getImageUrl(m.url);
        return {
          material: m,
          placeholder: `![${filename}](uploading:${realUrl})`,
          realUrl
        };
      });

      const placeholderText = placeholders.map(p => p.placeholder).join('\n');
      insertAtCursor(placeholderText + '\n');

      await Promise.all(placeholders.map(async ({ material, placeholder, realUrl }) => {
        try {
          const response = await getMaterialCaption(material.id);
          const rawCaption = response.data?.caption || material.original_filename || material.filename || 'image';
          const caption = escapeMarkdown(rawCaption);
          const finalMarkdown = `![${caption}](${realUrl})`;
          setContent(prev => prev.replace(placeholder, finalMarkdown));
        } catch (error) {
          console.error('Failed to generate caption for', material.id, error);
          const fallback = escapeMarkdown(material.original_filename || material.filename || 'image');
          const fallbackMarkdown = `![${fallback}](${realUrl})`;
          setContent(prev => prev.replace(placeholder, fallbackMarkdown));
        }
      }));
    } catch (error) {
      console.error('Error in handleMaterialSelect:', error);
      onError?.(error);
    }
  }, [insertAtCursor, setContent, onError]);

  return handleMaterialSelect;
};
