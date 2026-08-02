import { describe, expect, it, vi, afterEach } from 'vitest';
import { getTemplateFile } from '@/components/shared/TemplateSelector';

describe('getTemplateFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a File when the preset template response is an image', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Blob(['image-bytes'], { type: 'image/png' }), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      })
    );

    const file = await getTemplateFile('1', []);

    expect(file).toBeInstanceOf(File);
    expect(file?.name).toBe('template_y.png');
    expect(file?.type).toBe('image/png');
  });

  it('rejects a preset template response that is html', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>not found</html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })
    );

    const file = await getTemplateFile('1', []);

    expect(file).toBeNull();
  });

  it('rejects a failed user template response', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('missing', {
        status: 404,
        headers: { 'content-type': 'text/plain' },
      })
    );

    const file = await getTemplateFile('template-001', [
      {
        template_id: 'template-001',
        template_image_url: '/files/user-templates/template-001/template.png',
        created_at: '2026-05-29T00:00:00Z',
      },
    ]);

    expect(file).toBeNull();
  });
});
