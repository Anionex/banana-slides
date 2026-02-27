/**
 * 描述文本解析器 — 将 AI 生成的页面描述按段落标记拆分为结构化数组
 * 段落标记与后端 DESCRIPTION_SECTIONS 保持一致
 */

export const SECTION_KEYS = ['页面标题', '页面文字', '配图建议', '排版建议', '其他页面素材'] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export interface DescriptionSection {
  key: SectionKey | string;
  content: string;
}

// 匹配已知段落标记，如 "页面标题：xxx" 或 "其他页面素材（...）"
const SECTION_RE = new RegExp(
  `^(${SECTION_KEYS.map(k => k.replace(/[.*+?^$()|[\]\\]/g, '\\$&')).join('|')})[：:（(]?`,
  'm',
);

// 匹配通用段落标记：2-8个中文字符后跟冒号，如 "演讲备注：xxx"
const GENERIC_SECTION_RE = /^([\u4e00-\u9fff]{2,8})[：:]/;

/** 将描述纯文本按段落标记拆分为结构化数组 */
export function parseDescription(text: string): DescriptionSection[] {
  if (!text?.trim()) return [];

  const sections: DescriptionSection[] = [];
  const lines = text.split('\n');
  let currentKey: string | null = null;
  let currentLines: string[] = [];

  const flush = () => {
    if (currentKey !== null) {
      sections.push({ key: currentKey, content: currentLines.join('\n').trim() });
    }
    currentLines = [];
  };

  for (const line of lines) {
    const match = line.match(SECTION_RE) || line.match(GENERIC_SECTION_RE);
    if (match) {
      flush();
      currentKey = match[1];
      const afterMarker = line.slice(match[0].length).trim();
      if (afterMarker) currentLines.push(afterMarker);
    } else {
      if (currentKey === null) {
        currentKey = '';
        currentLines.push(line);
      } else {
        currentLines.push(line);
      }
    }
  }
  flush();

  return sections;
}

/** 将结构化数组序列化回纯文本 */
export function serializeDescription(sections: DescriptionSection[]): string {
  return sections
    .map(s => {
      if (!s.key) return s.content;
      if (s.key === '其他页面素材') return `其他页面素材\n${s.content}`;
      return `${s.key}：${s.content}`;
    })
    .join('\n\n');
}

/** 替换指定段落的内容，返回新的纯文本 */
export function updateSection(text: string, key: string, newContent: string): string {
  const sections = parseDescription(text);
  const idx = sections.findIndex(s => s.key === key);
  if (idx >= 0) {
    sections[idx] = { ...sections[idx], content: newContent };
  }
  return serializeDescription(sections);
}
