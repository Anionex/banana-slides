import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Settings } from '@/pages/Settings';
import type { Settings as SettingsType } from '@/types';

const getSettings = vi.fn();
const updateSettings = vi.fn();
const resetSettings = vi.fn();

vi.mock('@/api/endpoints', () => ({
  OUTPUT_LANGUAGE_OPTIONS: [
    { value: 'zh', label: '中文' },
    { value: 'en', label: 'English' },
    { value: 'ja', label: '日本語' },
    { value: 'auto', label: 'Auto' },
  ],
  getSettings: () => getSettings(),
  updateSettings: (payload: Record<string, unknown>) => updateSettings(payload),
  resetSettings: () => resetSettings(),
  checkForUpdates: vi.fn(),
  getOpenAIOAuthUrl: vi.fn(),
  disconnectOpenAIOAuth: vi.fn(),
  submitOAuthManualCallback: vi.fn(),
  getOpenAIOAuthStatus: vi.fn(),
  runSettingsTest: vi.fn(),
  getSettingsTestStatus: vi.fn(),
  testBaiduOcr: vi.fn(),
  testTextModel: vi.fn(),
  testCaptionModel: vi.fn(),
  testBaiduInpaint: vi.fn(),
  testImageModel: vi.fn(),
  testMineruPdf: vi.fn(),
}));

const baseSettings: SettingsType = {
  id: 1,
  ai_provider_format: 'openai',
  api_base_url: 'https://api.apimart.ai/v1',
  api_key_length: 12,
  image_resolution: '2K',
  image_quality: 'auto',
  image_aspect_ratio: '16:9',
  max_description_workers: 5,
  max_image_workers: 8,
  text_model: 'gpt-5.6-sol',
  image_model: 'gpt-image-2.5-flare',
  mineru_api_base: '',
  mineru_token_length: 0,
  image_caption_model: 'gpt-5.6-luna',
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
  image_model_source: 'openai',
  image_caption_model_source: '',
  lazyllm_api_keys_info: {},
  text_api_key_length: 0,
  text_api_base_url: '',
  image_api_key_length: 0,
  image_api_base_url: '',
  image_caption_api_key_length: 0,
  image_caption_api_base_url: '',
  openai_image_api_protocol: 'images',
  openai_oauth_connected: false,
  elevenlabs_enabled: false,
  elevenlabs_api_key_length: 0,
  elevenlabs_voice_id: '',
};

const renderSettings = () =>
  render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>
  );

describe('Settings image quality tier', () => {
  beforeEach(() => {
    getSettings.mockReset();
    updateSettings.mockReset();
    resetSettings.mockReset();
    getSettings.mockResolvedValue({ data: baseSettings });
    updateSettings.mockImplementation((payload) => ({
      data: { ...baseSettings, ...payload },
    }));
  });

  it('saves the selected quality tier for OpenAI-compatible image models', async () => {
    renderSettings();

    const select = await screen.findByTestId('openai-image-quality-select');
    expect((select as HTMLSelectElement).value).toBe('auto');

    await userEvent.selectOptions(select, 'max');
    await userEvent.click(screen.getByRole('button', { name: /保存设置|Save Settings/ }));

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ image_quality: 'max' })
      );
    });
  });

  it('restores the saved quality tier when the page reloads', async () => {
    getSettings.mockResolvedValueOnce({
      data: { ...baseSettings, image_quality: 'xhigh' },
    });
    renderSettings();

    const select = await screen.findByTestId('openai-image-quality-select');
    expect((select as HTMLSelectElement).value).toBe('xhigh');
  });

  it('hides the quality select when the image provider is Gemini', async () => {
    getSettings.mockResolvedValueOnce({
      data: {
        ...baseSettings,
        ai_provider_format: 'gemini',
        image_model_source: '',
        image_model: 'gemini-3-pro-image-preview',
      },
    });
    renderSettings();

    await screen.findByDisplayValue('gemini-3-pro-image-preview');
    expect(screen.queryByTestId('openai-image-quality-select')).toBeNull();
  });

  it('hides the quality select for models that ignore it (Seedream)', async () => {
    getSettings.mockResolvedValueOnce({
      data: {
        ...baseSettings,
        image_model: 'doubao-seedream-5.0-lite',
      },
    });
    renderSettings();

    await screen.findByDisplayValue('doubao-seedream-5.0-lite');
    // The protocol select stays visible for Seedream, the quality select must not.
    expect(screen.getByTestId('openai-image-api-protocol-select')).toBeTruthy();
    expect(screen.queryByTestId('openai-image-quality-select')).toBeNull();
  });
});
