import { beforeEach, describe, expect, test } from 'vitest';
import { isApiSettingsError, normalizeErrorMessage } from '@/utils';

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

  test('maps codex oauth 401 failures to relogin guidance', () => {
    const message = normalizeErrorMessage('401 OpenAI OAuth is not connected for codex export');
    expect(message).toContain('重新登录');
    expect(message).toContain('OpenAI');
  });

  test('maps codex ssl eof failures to retry guidance', () => {
    const message = normalizeErrorMessage("HTTPSConnectionPool(host='chatgpt.com', port=443): Max retries exceeded with url: /backend-api/codex/responses (Caused by SSLError(SSLEOFError(8, '[SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred in violation of protocol (_ssl.c:1017)')))");
    expect(message).toContain('Codex');
    expect(message).toContain('稍后重试');
  });

  test('does not crash on non-string errors', () => {
    const message = normalizeErrorMessage({ error: 'boom', status: 500 } as any);
    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(0);
  });

  test('keeps non-codex network failures generic', () => {
    const message = normalizeErrorMessage("HTTPSConnectionPool(host='api.openai.com', port=443): Max retries exceeded");
    expect(message).not.toContain('Codex');
    expect(message).toContain('网络连接中断');
  });

  test.each([
    ['API key is invalid', 'API 密钥无效'],
    ['API quota or balance is insufficient', '余额或配额不足'],
    ['API permission denied', 'API 权限不足'],
    ['API rate limit exceeded', '请求过于频繁'],
    ['Configured AI model is unavailable', 'AI 模型不可用'],
    ['AI service connection failed; check API base URL', '检查 API 地址'],
    ['Access code required', '刷新页面后重新验证'],
  ])('localizes provider recovery errors: %s', (raw, expected) => {
    expect(normalizeErrorMessage(raw)).toContain(expected);
  });
});

describe('isApiSettingsError', () => {
  test('does not reclassify a normalized application access-code 403 as provider recovery', () => {
    expect(isApiSettingsError(normalizeErrorMessage('HTTP 403'))).toBe(false);

    localStorage.setItem('i18nextLng', 'en');
    expect(isApiSettingsError(normalizeErrorMessage('HTTP 403'))).toBe(false);
  });

  test.each([
    'HTTP 401',
    '403 Forbidden',
    '429 Too Many Requests',
    'usage limit has been exhausted',
    'balance is insufficient',
    '认证失败，请检查 API 密钥配置',
    { response: { status: 401, data: { error: { message: 'invalid credential' } } } },
  ])('recognizes settings-recoverable API failures: %j', (error) => {
    expect(isApiSettingsError(error)).toBe(true);
  });

  test.each([
    '500 Internal Server Error',
    '503 Service Unavailable',
    'HTTP 403',
    { response: { status: 403, data: { error: 'Access code required' } } },
    { response: { status: 403, data: { error: 'Invalid access code' } } },
    'Network error',
    'Gateway timeout',
    new Error('File parsing failed'),
  ])('does not redirect unrelated failures to settings: %j', (error) => {
    expect(isApiSettingsError(error)).toBe(false);
  });
});
