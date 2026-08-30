import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/endpoints', () => ({
  getSettings: vi.fn(),
  resetSettings: vi.fn(),
  updateSettings: vi.fn(),
}));

import { getSettings, resetSettings, updateSettings } from '@/api/endpoints';
import {
  getSettingsAfterPendingUpdates,
  resetSettingsSerially,
  updateSettingsSerially,
} from '@/utils/settingsUpdates';

describe('settings update serialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('waits for pending mutations before loading a full settings snapshot', async () => {
    let resolveUpdate!: (value: any) => void;
    vi.mocked(updateSettings).mockImplementationOnce(
      () => new Promise((resolve) => { resolveUpdate = resolve; })
    );
    vi.mocked(getSettings).mockResolvedValueOnce({ data: { description_generation_mode: 'parallel' } } as any);

    const update = updateSettingsSerially({ description_generation_mode: 'parallel' });
    const load = getSettingsAfterPendingUpdates();

    await vi.waitFor(() => {
      expect(updateSettings).toHaveBeenCalledTimes(1);
    });
    expect(getSettings).not.toHaveBeenCalled();

    resolveUpdate({ data: { description_generation_mode: 'parallel' } });
    await update;
    await expect(load).resolves.toEqual({ data: { description_generation_mode: 'parallel' } });
    expect(getSettings).toHaveBeenCalledTimes(1);
  });

  it('queues reset behind an in-flight settings update', async () => {
    let resolveUpdate!: (value: any) => void;
    vi.mocked(updateSettings).mockImplementationOnce(
      () => new Promise((resolve) => { resolveUpdate = resolve; })
    );
    vi.mocked(resetSettings).mockResolvedValueOnce({ data: { description_generation_mode: 'streaming' } } as any);

    const update = updateSettingsSerially({ description_generation_mode: 'parallel' });
    const reset = resetSettingsSerially();

    await vi.waitFor(() => {
      expect(updateSettings).toHaveBeenCalledTimes(1);
    });
    expect(resetSettings).not.toHaveBeenCalled();

    resolveUpdate({ data: { description_generation_mode: 'parallel' } });
    await update;
    await reset;
    expect(resetSettings).toHaveBeenCalledTimes(1);
  });
});
