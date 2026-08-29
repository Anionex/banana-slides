import { describe, expect, it, vi } from 'vitest';

vi.mock('@/api/endpoints', () => ({
  updateSettings: vi.fn(),
}));

import { updateSettings } from '@/api/endpoints';
import { updateSettingsSerially } from '@/utils/settingsUpdates';

describe('settings update serialization', () => {
  it('does not start a later partial update until the earlier response settles', async () => {
    let resolveFirst!: (value: any) => void;
    vi.mocked(updateSettings)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ data: { description_generation_mode: 'parallel' } } as any);

    const first = updateSettingsSerially({ description_generation_mode: 'parallel' });
    const second = updateSettingsSerially({ description_extra_fields: ['配图与素材'] });

    await vi.waitFor(() => {
      expect(updateSettings).toHaveBeenCalledTimes(1);
    });

    resolveFirst({ data: { description_generation_mode: 'parallel' } });
    await first;
    await second;

    expect(updateSettings).toHaveBeenCalledTimes(2);
    expect(updateSettings).toHaveBeenNthCalledWith(1, { description_generation_mode: 'parallel' });
    expect(updateSettings).toHaveBeenNthCalledWith(2, { description_extra_fields: ['配图与素材'] });
  });
});
