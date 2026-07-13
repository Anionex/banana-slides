import { expect, test } from '@playwright/test';

const frontendUrl = process.env.BASE_URL || 'http://localhost:3011';
const backendUrl = process.env.BACKEND_URL || 'http://localhost:5011';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP8zwACTGCSAQANHQEDgslx/wAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('Desktop Markdown images (#510)', () => {
  test('loads a real /files material through the dynamic desktop backend URL', async ({ browser, request }) => {
    const backendPort = new URL(backendUrl).port;
    expect(backendPort).not.toBe('');

    const uploadResponse = await request.post(`${backendUrl}/api/materials/upload`, {
      multipart: {
        file: {
          name: 'desktop-markdown.png',
          mimeType: 'image/png',
          buffer: png,
        },
      },
    });
    expect(uploadResponse.status(), await uploadResponse.text()).toBe(201);
    const material = (await uploadResponse.json()).data;

    const createProjectResponse = await request.post(`${backendUrl}/api/projects`, {
      data: {
        creation_type: 'idea',
        idea_prompt: 'desktop markdown image e2e',
      },
    });
    expect(createProjectResponse.status(), await createProjectResponse.text()).toBe(201);
    const projectId = (await createProjectResponse.json()).data.project_id;

    const createPageResponse = await request.post(`${backendUrl}/api/projects/${projectId}/pages`, {
      data: {
        order_index: 0,
        outline_content: { title: 'Desktop image', points: [] },
        description_content: {
          text: `![real desktop material](${material.url})`,
        },
      },
    });
    expect(createPageResponse.status(), await createPageResponse.text()).toBe(201);

    const context = await browser.newContext({ locale: 'zh-CN' });
    await context.addInitScript((port) => {
      Object.defineProperty(window, 'electronAPI', {
        configurable: true,
        value: {
          getBackendPort: () => port,
          getPlatform: () => 'darwin',
          getAppVersion: () => Promise.resolve('e2e'),
          checkForUpdates: () => Promise.resolve(null),
          openExternal: () => Promise.resolve(),
          minimizeWindow: () => undefined,
          maximizeWindow: () => undefined,
          closeWindow: () => undefined,
          downloadFile: () => Promise.resolve(),
          zoomIn: () => undefined,
          zoomOut: () => undefined,
          zoomReset: () => undefined,
          getZoomLevel: () => Promise.resolve(0),
        },
      });
    }, backendPort);

    const page = await context.newPage();
    const expectedImageUrl = `${backendUrl}${material.url}`;
    const imageResponse = page.waitForResponse(
      (response) => response.url() === expectedImageUrl && response.request().resourceType() === 'image',
    );

    try {
      await page.goto(`${frontendUrl}/#/project/${projectId}/detail`);

      const image = page.getByAltText('real desktop material');
      await expect(image).toHaveAttribute('src', expectedImageUrl);
      expect((await imageResponse).status()).toBe(200);
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => (
        element.complete && element.naturalWidth > 0
      ))).toBe(true);
    } finally {
      await context.close();
      await request.delete(`${backendUrl}/api/projects/${projectId}`);
    }
  });
});
