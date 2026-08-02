import { expect, test, type Page, type Route } from '@playwright/test';

const projectId = 'qc-project';
const pageId = 'qc-page-1';

const baseSettings = {
  id: 1,
  ai_provider_format: 'gemini',
  api_base_url: '',
  api_key_length: 0,
  image_resolution: '2K',
  image_aspect_ratio: '16:9',
  max_description_workers: 5,
  max_image_workers: 8,
  text_model: 'gemini-3-flash-preview',
  image_model: 'imagen-3.0-generate-001',
  mineru_api_base: '',
  mineru_token_length: 0,
  image_caption_model: 'gemini-3-flash-preview',
  output_language: 'zh',
  description_generation_mode: 'streaming',
  description_extra_fields: ['配图与素材', '版式与重点', '演讲者备注'],
  image_prompt_extra_fields: ['配图与素材', '版式与重点'],
  enable_text_reasoning: false,
  text_thinking_budget: 1024,
  enable_image_reasoning: false,
  image_thinking_budget: 1024,
  enable_image_quality_control: false,
  baidu_api_key_length: 0,
  text_model_source: '',
  image_model_source: '',
  image_caption_model_source: '',
  lazyllm_api_keys_info: {},
  text_api_key_length: 0,
  text_api_base_url: '',
  image_api_key_length: 0,
  image_api_base_url: '',
  image_caption_api_key_length: 0,
  image_caption_api_base_url: '',
  openai_image_api_protocol: 'auto',
  openai_oauth_connected: false,
  openai_oauth_account_id: null,
  elevenlabs_enabled: false,
  elevenlabs_api_key_length: 0,
  elevenlabs_voice_id: '',
};

const project = {
  project_id: projectId,
  id: projectId,
  project_title: 'Quality Control Deck',
  idea_prompt: 'Demo',
  creation_type: 'idea',
  template_image_url: null,
  template_image_path: null,
  template_style: 'clean editorial slides',
  extra_requirements: '',
  export_extractor_method: 'hybrid',
  export_inpaint_method: 'hybrid',
  export_allow_partial: false,
  enable_icon_subject_extraction: true,
  image_aspect_ratio: '16:9',
  status: 'DESCRIPTIONS_GENERATED',
  created_at: '2026-07-01T00:00:00',
  updated_at: '2026-07-01T00:00:00',
  pages: [
    {
      page_id: pageId,
      id: pageId,
      order_index: 0,
      outline_content: { title: 'Market Overview', points: ['Growth', 'Risk'] },
      description_content: { text: 'A clean market overview slide with readable labels.' },
      generated_image_url: null,
      generated_image_path: null,
      status: 'DESCRIPTION_GENERATED',
      created_at: '2026-07-01T00:00:00',
      updated_at: '2026-07-01T00:00:00',
    },
  ],
};

async function mockAccessCode(page: Page) {
  await page.route('**/api/access-code/check', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { enabled: false } }) })
  );
}

async function mockSettings(page: Page, onPut: (payload: Record<string, unknown>) => void) {
  let settings = { ...baseSettings };
  await page.route('**/api/settings', async (route: Route) => {
    if (route.request().method() === 'PUT') {
      const payload = route.request().postDataJSON();
      onPut(payload);
      settings = { ...settings, ...payload };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: settings }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: settings }) });
  });
}

async function mockPreviewProject(page: Page) {
  await page.route('**/api/user-templates', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { templates: [] } }) })
  );
  await page.route(`**/api/projects/${projectId}`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: project }) })
  );
  await page.route(`**/api/projects/${projectId}/pages/${pageId}/image-versions`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { versions: [] } }) })
  );
}

test.describe('image quality control setting', () => {
  test('settings page saves the quality control mode', async ({ page }) => {
    await mockAccessCode(page);
    const payloads: Record<string, unknown>[] = [];
    await mockSettings(page, payload => payloads.push(payload));

    await page.goto('/settings');
    const label = page.getByText(/启用质量控制模式|Enable Quality Control/);
    await expect(label).toBeVisible();
    await label.locator('..').getByRole('button').click();
    await page.getByRole('button', { name: /保存设置|Save Settings/ }).click();

    await expect.poll(() => payloads.at(-1)?.enable_image_quality_control).toBe(true);
  });

  test('preview page can toggle quality control before generation', async ({ page }) => {
    await mockAccessCode(page);
    const payloads: Record<string, unknown>[] = [];
    await mockSettings(page, payload => payloads.push(payload));
    await mockPreviewProject(page);

    await page.goto(`/project/${projectId}/preview`);
    // Desktop layout: the switch is a project-level generation setting, so it sits
    // in the sidebar next to batch generate rather than in the per-page toolbar.
    await expect(page.getByTestId('preview-floating-toolbar').getByRole('switch')).toHaveCount(0);
    const qualitySwitch = page.locator('aside').getByRole('switch', { name: /质量控制|Quality Control/ });
    const qualityTooltip = page.getByTestId('quality-control-tooltip');
    await expect(qualityTooltip).toContainText(/看不清的字|unreadable text/);
    await expect(qualityTooltip).toHaveCSS('opacity', '0');
    await qualitySwitch.hover();
    await expect(qualityTooltip).toHaveCSS('opacity', '1');
    await expect(qualitySwitch).toHaveAttribute('aria-checked', 'false');
    await qualitySwitch.click();

    await expect.poll(() => payloads.at(-1)?.enable_image_quality_control).toBe(true);
    await expect(qualitySwitch).toHaveAttribute('aria-checked', 'true');
  });
});
