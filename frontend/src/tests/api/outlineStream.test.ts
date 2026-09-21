import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateOutlineStream } from '@/api/endpoints';

const callbacks = () => ({ onPage: vi.fn(), onDone: vi.fn(), onError: vi.fn() });
const encode = (s: string) => new TextEncoder().encode(s);
function feed() {
  let writer!: ReadableStreamDefaultController<Uint8Array>;
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({ start(c) { writer = c; }, cancel });
  vi.mocked(fetch).mockImplementation(async (_url, options) => {
    options?.signal?.addEventListener('abort', () => {
      try { writer.error(new DOMException('Aborted', 'AbortError')); } catch { /* already closed */ }
    });
    return { ok: true, body } as Response;
  });
  return { writer, cancel };
}
beforeEach(() => { vi.useFakeTimers(); localStorage.setItem('i18nextLng', 'zh'); });
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('outline stream recovery', () => {
  it('fails promptly if response headers never arrive', async () => {
    vi.mocked(fetch).mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const result = expect(generateOutlineStream('test', callbacks(), 'zh')).rejects.toThrow('长时间无响应');
    await vi.advanceTimersByTimeAsync(45001);
    await result;
  });
  it('heartbeats renew the deadline, and done ends an otherwise open stream', async () => {
    const { writer } = feed();
    const cb = callbacks();
    const result = generateOutlineStream('test', cb, 'zh');
    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(30000);
      writer.enqueue(encode(': keep-alive\n\n'));
      await vi.advanceTimersByTimeAsync(0);
    }
    writer.enqueue(encode('event: page\r\ndata: {"title":"中文页"}\r\n\r'));
    writer.enqueue(encode('\nevent: done\ndata: {"total":1,"pages":[]}\n\n'));
    await result;
    expect(cb.onPage).toHaveBeenCalledWith({ title: '中文页' });
    expect(cb.onDone).toHaveBeenCalledOnce();
    expect(cb.onError).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('times out a body that stops sending heartbeats', async () => {
    const { writer } = feed();
    const result = expect(generateOutlineStream('test', callbacks(), 'zh')).rejects.toThrow('长时间无响应');
    writer.enqueue(encode(': keep-alive\n\n'));
    await vi.advanceTimersByTimeAsync(45001);
    await result;
  });
  it('reports EOF without done instead of treating it as success', async () => {
    const { writer } = feed();
    const result = expect(generateOutlineStream('test', callbacks(), 'zh')).rejects.toThrow('未收到完成结果');
    writer.enqueue(encode('event: page\ndata: {"title":"partial"}\n\n'));
    writer.close();
    await result;
  });
  it('delivers a model error without waiting for the server to close', async () => {
    const { writer } = feed();
    const cb = callbacks();
    const result = generateOutlineStream('test', cb, 'zh');
    writer.enqueue(encode('event: error\ndata: {"message":"模型超时"}\n\n'));
    await result;
    expect(cb.onError).toHaveBeenCalledWith('模型超时');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('explains gateway timeout errors', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 504 } as Response);
    await expect(generateOutlineStream('test', callbacks(), 'zh')).rejects.toThrow('生成连接超时');
  });
});
