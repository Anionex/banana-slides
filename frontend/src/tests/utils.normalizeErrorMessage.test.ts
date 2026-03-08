import { beforeEach, describe, expect, test } from 'vitest';
import { normalizeErrorMessage } from '@/utils';

describe('normalizeErrorMessage', () => {
  beforeEach(() => {
    localStorage.setItem('i18nextLng', 'zh-CN');
  });

  test('maps style extraction image-input failures to actionable export guidance', () => {
    const message = normalizeErrorMessage('文本样式提取失败: 当前图片样式提取模型不支持图片输入: caption_provider 不支持图片输入');
    expect(message).toContain('不支持图片输入');
    expect(message).toContain('image caption');
  });

  test('maps generic style extraction failures to editable pptx guidance', () => {
    const message = normalizeErrorMessage('文本样式提取失败: 调用视觉模型提取文本样式失败');
    expect(message).toContain('可编辑 PPTX 导出失败');
    expect(message).toContain('允许返回半成品');
  });
});
