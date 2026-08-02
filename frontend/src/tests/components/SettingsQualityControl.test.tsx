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
  elevenlabs_enabled: false,
  elevenlabs_api_key_length: 0,
  elevenlabs_voice_id: '',
};

describe('Settings quality control', () => {
  beforeEach(() => {
    getSettings.mockReset();
    updateSettings.mockReset();
    resetSettings.mockReset();
    getSettings.mockResolvedValue({ data: baseSettings });
    updateSettings.mockImplementation((payload) => ({
      data: { ...baseSettings, ...payload },
    }));
  });

  it('saves the image quality control switch', async () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    const label = await screen.findByText(/启用质量控制模式|Enable Quality Control/);
    const switchButton = label.parentElement?.querySelector('button');
    expect(switchButton).toBeTruthy();

    await userEvent.click(switchButton!);
    await userEvent.click(screen.getByRole('button', { name: /保存设置|Save Settings/ }));

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ enable_image_quality_control: true })
      );
    });
  });
});
