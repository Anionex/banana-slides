import { describe, expect, test } from 'vitest';
import {
  parseMarkdownPages,
  resolveExtraFieldName,
  isInImagePrompt,
  buildExtraFieldEntries,
} from '@/utils/projectUtils';

describe('resolveExtraFieldName', () => {
  test('maps legacy names to the new contract', () => {
    expect(resolveExtraFieldName('视觉元素')).toBe('配图与素材');
    expect(resolveExtraFieldName('视觉焦点')).toBe('版式与重点');
    expect(resolveExtraFieldName('排版布局')).toBe('版式与重点');
    expect(resolveExtraFieldName('排版建议')).toBe('版式与重点');
  });

  test('keeps new and custom names unchanged', () => {
    expect(resolveExtraFieldName('配图与素材')).toBe('配图与素材');
    expect(resolveExtraFieldName('品牌规范')).toBe('品牌规范');
  });
});

describe('isInImagePrompt', () => {
  test('matches new name directly', () => {
    expect(isInImagePrompt('配图与素材', ['配图与素材', '版式与重点'])).toBe(true);
    expect(isInImagePrompt('演讲者备注', ['配图与素材', '版式与重点'])).toBe(false);
  });

  test('matches legacy page key via its equivalent new name', () => {
    expect(isInImagePrompt('视觉元素', ['配图与素材', '版式与重点'])).toBe(true);
    expect(isInImagePrompt('视觉焦点', ['配图与素材', '版式与重点'])).toBe(true);
  });

  test('matches legacy page key against legacy settings list', () => {
    expect(isInImagePrompt('视觉元素', ['视觉元素', '视觉焦点'])).toBe(true);
  });

  test('keeps custom fields unaffected', () => {
    expect(isInImagePrompt('品牌规范', ['配图与素材', '品牌规范'])).toBe(true);
    expect(isInImagePrompt('品牌规范', ['配图与素材'])).toBe(false);
  });

  test('undefined or empty list means no marker source', () => {
    expect(isInImagePrompt('配图与素材', undefined)).toBe(false);
    expect(isInImagePrompt('配图与素材', [])).toBe(false);
  });
});

describe('buildExtraFieldEntries', () => {
  test('maps legacy keys to new display names, keeping the raw key for data', () => {
    const entries = buildExtraFieldEntries(
      ['配图与素材', '版式与重点', '演讲者备注', '视觉元素', '视觉焦点'],
      { '视觉元素': '折线图', '视觉焦点': '左文右图' },
    );

    expect(entries).toEqual([
      { raw: '视觉元素', display: '配图与素材', value: '折线图' },
      { raw: '视觉焦点', display: '版式与重点', value: '左文右图' },
      { raw: '演讲者备注', display: '演讲者备注', value: '' },
    ]);
  });

  test('merges colliding legacy keys into one entry with joined content', () => {
    const entries = buildExtraFieldEntries(
      ['配图与素材', '版式与重点', '演讲者备注', '视觉元素', '视觉焦点', '排版布局'],
      { '视觉元素': '折线图', '视觉焦点': '企业级增速', '排版布局': '左文右图' },
    );

    expect(entries).toEqual([
      { raw: '视觉元素', display: '配图与素材', value: '折线图' },
      { raw: '视觉焦点', display: '版式与重点', value: '企业级增速\n左文右图' },
      { raw: '演讲者备注', display: '演讲者备注', value: '' },
    ]);
  });

  test('prefers the new-name raw key when both old and new keys hold content', () => {
    const entries = buildExtraFieldEntries(
      ['配图与素材', '视觉元素'],
      { '配图与素材': '新内容', '视觉元素': '旧内容' },
    );

    expect(entries).toEqual([{ raw: '配图与素材', display: '配图与素材', value: '新内容\n旧内容' }]);
  });

  test('coerces non-string legacy values and drops nulls without crashing', () => {
    const entries = buildExtraFieldEntries(
      ['视觉元素', '视觉焦点'],
      { '视觉元素': 42 as unknown as string, '视觉焦点': null as unknown as string },
    );

    expect(entries).toEqual([
      { raw: '视觉元素', display: '配图与素材', value: '42' },
      { raw: '视觉焦点', display: '版式与重点', value: '' },
    ]);
  });

  test('keeps custom fields untouched and empty entries editable', () => {
    const entries = buildExtraFieldEntries(
      ['配图与素材', '品牌规范'],
      { '品牌规范': '蓝金配色' },
    );

    expect(entries).toEqual([
      { raw: '配图与素材', display: '配图与素材', value: '' },
      { raw: '品牌规范', display: '品牌规范', value: '蓝金配色' },
    ]);
  });
});

describe('parseMarkdownPages', () => {
  test('imports sentence-style outline and required page text markers', () => {
    const pages = parseMarkdownPages(`
## 第 1 页: 市场机会

> 章节: 行业分析

这一页说明市场规模增长、竞争格局分散，以及企业级机会正在放大。

**页面描述：**
--- 页面文字 ---

### 市场机会正在快速放大

- 企业级场景增速高于消费级场景

--- 页面文字结束 ---

视觉元素：增长曲线、对比数据卡片
视觉焦点：企业级增速
`);

    expect(pages).toHaveLength(1);
    expect(pages[0].title).toBe('市场机会');
    expect(pages[0].part).toBe('行业分析');
    expect(pages[0].points).toEqual(['这一页说明市场规模增长、竞争格局分散，以及企业级机会正在放大。']);
    expect(pages[0].text).toContain('--- 页面文字 ---');
    expect(pages[0].text).toContain('--- 页面文字结束 ---');
    expect(pages[0].extra_fields).toEqual({
      '视觉元素': '增长曲线、对比数据卡片',
      '视觉焦点': '企业级增速',
    });
  });

  test('imports outline content with or without markdown bullet prefixes', () => {
    const pages = parseMarkdownPages(`
## 第 1 页: 英伟达发家史

**大纲要点：**

用一句话点明全篇主线。
* 英伟达把GPU一步步变成AI时代的基础设施。
+ CUDA建立软件生态壁垒。
- 数据中心成为第二增长曲线。

**页面描述：**
--- 页面文字 ---
英伟达发家史
--- 页面文字结束 ---
`);

    expect(pages[0].points).toEqual([
      '用一句话点明全篇主线。',
      '英伟达把GPU一步步变成AI时代的基础设施。',
      'CUDA建立软件生态壁垒。',
      '数据中心成为第二增长曲线。',
    ]);
  });
});
