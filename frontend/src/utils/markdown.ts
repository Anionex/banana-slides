import { getImageUrl } from '@/api/client';
import { getMaterialCaption } from '@/api/endpoints';
import type { Material } from '@/api/endpoints';

/**
 * Convert materials to markdown with AI-generated captions
 */
export const materialsToMarkdownWithCaption = async (materials: Material[]): Promise<string> => {
  const markdowns = await Promise.all(
    materials.map(async (m) => {
      try {
        const response = await getMaterialCaption(m.id);
        const caption = response.data?.caption || m.original_filename || m.filename || 'image';
        return `![${caption}](${getImageUrl(m.url)})`;
      } catch {
        const fallback = m.original_filename || m.filename || 'image';
        return `![${fallback}](${getImageUrl(m.url)})`;
      }
    })
  );
  return markdowns.join('\n');
};
