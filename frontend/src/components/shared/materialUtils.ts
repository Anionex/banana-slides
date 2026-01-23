import { getImageUrl } from '@/api/client';
import type { Material } from '@/api/endpoints';

/**
 * 将素材URL转换为File对象
 * 用于需要File对象的场景（如上传参考图）
 */
export const materialUrlToFile = async (
  material: Material,
  filename?: string
): Promise<File> => {
  const imageUrl = getImageUrl(material.url);
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  const file = new File(
    [blob],
    filename || material.filename,
    { type: blob.type || 'image/png' }
  );
  return file;
};
