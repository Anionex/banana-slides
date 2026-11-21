import { describe, expect, test } from 'vitest';
import { parseMarkdownPages } from '@/utils/projectUtils';

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
