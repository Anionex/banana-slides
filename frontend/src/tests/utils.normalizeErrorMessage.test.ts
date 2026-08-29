import { beforeEach, describe, expect, test } from 'vitest';
import { isApiSettingsError, normalizeErrorMessage, normalizeRenovationErrorMessage } from '@/utils';

describe('normalizeErrorMessage', () => {
  beforeEach(() => {
    localStorage.setItem('banana-slides-language', 'zh-CN');
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

  test('localizes the safe generic generation failure', () => {
    expect(normalizeErrorMessage('Generation failed due to an internal error')).toBe(
      '生成过程中发生内部错误，请稍后重试。'
    );
    localStorage.setItem('i18nextLng', 'en');
    expect(normalizeErrorMessage('Generation failed due to an internal error')).toBe(
      'Generation failed due to an internal error. Please try again later.'
    );
  });

  test('localizes disconnected Codex OAuth as a settings recovery error', () => {
    const raw = 'OpenAI OAuth is not connected. Please connect in Settings.';
    expect(normalizeErrorMessage(raw)).toContain('重新登录 OpenAI');
    expect(isApiSettingsError(normalizeErrorMessage(raw))).toBe(true);
  });

  test('maps MinerU credential failures in the renovation workflow to a concrete recovery step', () => {
    const message = normalizeRenovationErrorMessage(
      'Failed to get upload URL: MinerU API returned 401 Unauthorized: token expired'
    );
    expect(message).toContain('MinerU Token');
    expect(message).toContain('服务测试');
    expect(message).toContain('重新创建翻新项目');
  });

  test('maps MinerU business auth responses without an HTTP status', () => {
    const message = normalizeRenovationErrorMessage(
      'MinerU parsing failed: Failed to get upload URL: user authenticate failed'
    );
    expect(message).toContain('MinerU Token');
    expect(message).toContain('服务测试');
  });

  test('does not mislabel an unrelated provider authentication failure as MinerU', () => {
    const message = normalizeRenovationErrorMessage('OpenAI API returned 401 Unauthorized');
    expect(message).toContain('认证失败');
    expect(message).not.toContain('MinerU Token');
  });

  test('does not mislabel an expired signed upload URL as a MinerU token failure', () => {
    const message = normalizeRenovationErrorMessage(
      'MinerU parsing failed: File upload failed: 403 Forbidden'
    );
    expect(message).toContain('访问被拒绝');
    expect(message).not.toContain('MinerU Token');
  });

  test('uses the configured UI language for MinerU recovery guidance', () => {
    localStorage.setItem('banana-slides-language', 'en');
    const message = normalizeRenovationErrorMessage(
      'MinerU parsing failed: Failed to get upload URL: user authenticate failed'
    );
    expect(message).toContain('PPT Renovation could not parse the PDF');
    expect(message).toContain('MinerU Configuration');
  });

  test('uses the configured UI language for non-credential renovation failures', () => {
    localStorage.setItem('banana-slides-language', 'en');
    const message = normalizeRenovationErrorMessage(
      'MinerU parsing failed: File upload failed: 403 Forbidden'
    );
    expect(message).toContain('Access denied');
    expect(message).not.toContain('访问被拒绝');
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
    'API permission was denied. Please check API settings.',
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
