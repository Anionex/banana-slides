import { getImageUrl } from '@/api/client';
import type { UserTemplate } from '@/api/endpoints';

export const presetTemplates = [
  { id: '1', name: '复古卷轴', preview: '/templates/template_y.png' },
  { id: '2', name: '矢量插画', preview: '/templates/template_vector_illustration.png' },
  { id: '3', name: '拟物玻璃', preview: '/templates/template_glass.png' },

  { id: '4', name: '科技蓝', preview: '/templates/template_b.png' },
  { id: '5', name: '简约商务', preview: '/templates/template_s.png' },
  { id: '6', name: '学术报告', preview: '/templates/template_academic.jpg' },
];

/**
 * 根据模板ID获取模板File对象（按需加载）
 * @param templateId 模板ID
 * @param userTemplates 用户模板列表
 * @returns Promise<File | null>
 */
export const getTemplateFile = async (
  templateId: string,
  userTemplates: UserTemplate[]
): Promise<File | null> => {
  // 检查是否是预设模板
  const presetTemplate = presetTemplates.find(t => t.id === templateId);
  if (presetTemplate && presetTemplate.preview) {
    try {
      const response = await fetch(presetTemplate.preview);
      const blob = await response.blob();
      return new File([blob], presetTemplate.preview.split('/').pop() || 'template.png', { type: blob.type });
    } catch (error) {
      console.error('加载预设模板失败:', error);
      return null;
    }
  }

  // 检查是否是用户模板
  const userTemplate = userTemplates.find(t => t.template_id === templateId);
  if (userTemplate) {
    try {
      const imageUrl = getImageUrl(userTemplate.template_image_url);
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      return new File([blob], 'template.png', { type: blob.type });
    } catch (error) {
      console.error('加载用户模板失败:', error);
      return null;
    }
  }

  return null;
};
