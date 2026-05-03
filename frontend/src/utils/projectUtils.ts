import { getImageUrl } from '@/api/client';
import type { Project, Page, DescriptionContent } from '@/types';
import { downloadFile } from './index';
import { getT } from './i18nHelper';
import i18n from '@/i18n';

const utilsI18n = {
  zh: {
    projectUtils: {
      untitled: '未命名项目',
      notStarted: '未开始',
      completed: '已完成',
      pendingImages: '待生成图片',
      pendingDesc: '待生成描述',
      pageNum: '第 {{num}} 页',
      pageHeading: '## 第 {{num}} 页: {{title}}',
      chapter: '章节',
      outlinePoints: '**大纲要点：**',
      noPoints: '*暂无要点*',
      pageDesc: '**页面描述：**',
      noDesc: '*暂无描述*',
      generatedAt: '生成时间',
      prefixDesc: '描述',
      prefixOutline: '大纲',
      prefixProject: '项目',
    }
  },
  en: {
    projectUtils: {
      untitled: 'Untitled Project',
      notStarted: 'Not Started',
      completed: 'Completed',
      pendingImages: 'Pending Images',
      pendingDesc: 'Pending Descriptions',
      pageNum: 'Page {{num}}',
      pageHeading: '## Page {{num}}: {{title}}',
      chapter: 'Chapter',
      outlinePoints: '**Outline Points:**',
      noPoints: '*No points yet*',
      pageDesc: '**Page Description:**',
      noDesc: '*No description yet*',
      generatedAt: 'Generated at',
      prefixDesc: 'Descriptions',
      prefixOutline: 'Outline',
      prefixProject: 'Project',
    }
  }
};
const t = getT(utilsI18n);

/**
 * 获取项目标题
 */
export const getProjectTitle = (project: Project): string => {
  // 从第一个页面的大纲标题获取项目名称
  if (project.pages && project.pages.length > 0) {
    const sortedPages = [...project.pages].sort((a, b) =>
      (a.order_index || 0) - (b.order_index || 0)
    );
    const firstPage = sortedPages[0];

    const title = firstPage?.outline_content?.title;
    if (title) {
      return title;
    }
  }

  return t('projectUtils.untitled');
};

/**
 * 获取第一页图片URL
 */
export const getFirstPageImage = (project: Project): string | null => {
  if (!project.pages || project.pages.length === 0) {
    return null;
  }

  // 找到第一页有图片的页面，优先使用 generated_image_url（已包含缩略图逻辑）
  const firstPageWithImage = project.pages.find(p => p.generated_image_url);
  if (firstPageWithImage?.generated_image_url) {
    return getImageUrl(firstPageWithImage.generated_image_url, firstPageWithImage.updated_at);
  }

  return null;
};

/**
 * 格式化日期
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const locale = i18n.language?.startsWith('zh') ? 'zh-CN' : 'en-US';
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

type StatusKey = 'notStarted' | 'completed' | 'pendingImages' | 'pendingDesc';

const getStatusKey = (project: Project): StatusKey => {
  if (!project.pages || project.pages.length === 0) return 'notStarted';
  if (project.pages.some(p => p.generated_image_path)) return 'completed';
  if (project.pages.some(p => p.description_content)) return 'pendingImages';
  return 'pendingDesc';
};

/**
 * 获取项目状态文本
 */
export const getStatusText = (project: Project): string => {
  return t(`projectUtils.${getStatusKey(project)}`);
};

const statusColorMap: Record<StatusKey, string> = {
  completed: 'text-green-600 bg-green-50',
  pendingImages: 'text-yellow-600 bg-yellow-50',
  pendingDesc: 'text-blue-600 bg-blue-50',
  notStarted: 'text-gray-600 bg-gray-50',
};

/**
 * 获取项目状态颜色样式
 */
export const getStatusColor = (project: Project): string => {
  return statusColorMap[getStatusKey(project)];
};

/**
 * 获取项目路由路径
 */
export const getProjectRoute = (project: Project): string => {
  const projectId = project.id || project.project_id;
  if (!projectId) return '/';
  
  if (project.pages && project.pages.length > 0) {
    const hasImages = project.pages.some(p => p.generated_image_path);
    if (hasImages) {
      return `/project/${projectId}/preview`;
    }
    const hasDescriptions = project.pages.some(p => p.description_content);
    if (hasDescriptions) {
      return `/project/${projectId}/detail`;
    }
    return `/project/${projectId}/outline`;
  }
  return `/project/${projectId}/outline`;
};

// ========== Markdown 导出/导入 ==========

export const getDescriptionText = (descContent: DescriptionContent | undefined | null): string => {
  if (!descContent) return '';
  if ('text' in descContent) return (descContent.text as string) || '';
  if ('text_content' in descContent && Array.isArray(descContent.text_content)) return descContent.text_content.join('\n');
  return '';
};

const getExtraFields = (descContent: DescriptionContent | undefined | null): Record<string, string> | undefined => {
  if (!descContent) return undefined;
  // New format
  if (descContent.extra_fields && typeof descContent.extra_fields === 'object') {
    return descContent.extra_fields;
  }
  // Backward compat
  if (descContent.layout_suggestion) {
    return { '排版建议': descContent.layout_suggestion };
  }
  return undefined;
};

export interface ExportOptions {
  outline?: boolean;
  description?: boolean;
}

const pageToMarkdown = (page: Page, index: number, opts: ExportOptions = {}): string => {
  const includeOutline = opts.outline !== false;
  const includeDesc = opts.description !== false;
  const title = page.outline_content?.title || t('projectUtils.pageNum', { num: index + 1 });
  const points = page.outline_content?.points || [];
  const descText = getDescriptionText(page.description_content);
  const extraFields = getExtraFields(page.description_content);

  let md = t('projectUtils.pageHeading', { num: index + 1, title }) + '\n\n';
  if (page.part) md += `> ${t('projectUtils.chapter')}: ${page.part}\n\n`;

  if (includeOutline) {
    md += `${t('projectUtils.outlinePoints')}\n`;
    if (points.length > 0) {
      points.forEach(p => { md += `- ${p}\n`; });
    } else {
      md += `${t('projectUtils.noPoints')}\n`;
    }
    md += '\n';
  }

  if (includeDesc) {
    md += `${t('projectUtils.pageDesc')}\n`;
    if (descText) {
      md += `${descText}\n`;
    } else {
      md += `${t('projectUtils.noDesc')}\n`;
    }
    // 额外字段
    if (extraFields) {
      md += '\n';
      for (const [name, value] of Object.entries(extraFields)) {
        if (value) md += `${name}：${value}\n`;
      }
    }
    md += '\n';
  }

  md += '---\n\n';
  return md;
};

export const exportProjectToMarkdown = (project: Project, opts?: ExportOptions): void => {
  const locale = i18n.language?.startsWith('zh') ? 'zh-CN' : 'en-US';
  let md = `# ${getProjectTitle(project)}\n\n`;
  md += `> ${t('projectUtils.generatedAt')}: ${new Date().toLocaleString(locale)}\n\n---\n\n`;
  project.pages.forEach((page, i) => { md += pageToMarkdown(page, i, opts); });
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const prefix = opts?.outline === false
    ? t('projectUtils.prefixDesc')
    : opts?.description === false
      ? t('projectUtils.prefixOutline')
      : t('projectUtils.prefixProject');
  downloadFile(blob, `${prefix}_${project.id?.slice(0, 8) || 'export'}.md`);
};

// --- 导入 ---

export interface ParsedPage {
  title: string;
  points: string[];
  text: string;
  part?: string;
  extra_fields?: Record<string, string>;
}

const sanitize = (s: string) => s.replace(/<[^>]*>/g, '');

const splitMarkdownPages = (markdown: string): string[] => {
  // Support both Chinese "## 第 N 页:" and English "## Page N:" formats
  return markdown.split(/^## (?:第 \d+ 页|Page \d+):/m).slice(1);
};

// 额外字段行模式：短名称 + 中/英冒号 + 内容
const EXTRA_FIELD_RE = /^([^\s：:]{1,20})[：:](.+)/;
const TRAILING_MARKERS = new Set(['---', '', '*暂无要点*', '*暂无描述*', '*No points yet*', '*No description yet*']);
const BULLET_RE = /^[-*+]\s+(.+)$/;

const stripBullet = (line: string): string | null => {
  const match = BULLET_RE.exec(line.trim());
  return match ? match[1].trim() : null;
};

const splitDescAndExtraFields = (descLines: string[]): { text: string; extra_fields?: Record<string, string> } => {
  // 从末尾向前扫描连续的额外字段行
  const fields: Record<string, string> = {};
  let i = descLines.length - 1;
  while (i >= 0) {
    const m = EXTRA_FIELD_RE.exec(descLines[i].trim());
    if (m) {
      fields[m[1]] = m[2].trim();
      i--;
    } else if (descLines[i].trim() === '') {
      i--; // 跳过空行
    } else {
      break;
    }
  }
  const text = descLines.slice(0, i + 1).join('\n').trim();
  return Object.keys(fields).length > 0 ? { text, extra_fields: fields } : { text };
};

const extractOutlineSentences = (lines: string[]): string[] => {
  const result: string[] = [];
  const cleaned = [...lines];
  while (cleaned.length && (cleaned[0].trim() === '' || cleaned[0].startsWith('> '))) cleaned.shift();
  while (cleaned.length && TRAILING_MARKERS.has(cleaned[cleaned.length - 1].trim())) cleaned.pop();

  for (const line of cleaned) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('> ')) continue;
    result.push(sanitize(stripBullet(trimmed) || trimmed));
  }
  return result;
};

export const parseMarkdownPages = (markdown: string): ParsedPage[] => {
  return splitMarkdownPages(markdown).map(section => {
    const lines = section.split('\n');
    const title = sanitize(lines[0].trim());

    // Extract metadata (support both Chinese and English)
    const partLine = lines.find(l => l.startsWith('> 章节: ') || l.startsWith('> Chapter: '));
    const part = partLine ? sanitize(partLine.replace(/^> (?:章节|Chapter): /, '').trim()) : undefined;

    // Find section markers (support both Chinese and English)
    const outlineIdx = lines.findIndex(l => l.trim() === '**大纲要点：**' || l.trim() === '**Outline Points:**');
    const descIdx = lines.findIndex(l => l.trim() === '**页面描述：**' || l.trim() === '**Page Description:**');

    let points: string[] = [];
    let text = '';
    let extra_fields: Record<string, string> | undefined;

    const stripTrailing = (arr: string[]) => {
      while (arr.length && TRAILING_MARKERS.has(arr[arr.length - 1].trim())) arr.pop();
    };

    if (outlineIdx >= 0) {
      const end = descIdx >= 0 ? descIdx : lines.length;
      points = extractOutlineSentences(lines.slice(outlineIdx + 1, end));
    } else if (descIdx >= 0) {
      points = extractOutlineSentences(lines.slice(1, descIdx));
    }

    if (descIdx >= 0) {
      const descLines = lines.slice(descIdx + 1);
      stripTrailing(descLines);
      const parsed = splitDescAndExtraFields(descLines);
      text = sanitize(parsed.text);
      extra_fields = parsed.extra_fields;
    }

    if (outlineIdx < 0 && descIdx < 0) {
      // Legacy format: no markers
      const contentLines = lines.slice(1);
      while (contentLines.length && (contentLines[0].startsWith('> ') || contentLines[0].trim() === '')) contentLines.shift();
      stripTrailing(contentLines);
      points = contentLines.map(stripBullet).filter((point): point is string => Boolean(point)).map(point => sanitize(point));
      text = sanitize(contentLines.filter(l => !stripBullet(l)).join('\n').trim());
    }

    return { title, points, text, part, extra_fields };
  });
};
