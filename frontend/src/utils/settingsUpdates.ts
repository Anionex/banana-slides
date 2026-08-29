import { updateSettings } from '@/api/endpoints';

type SettingsUpdate = Parameters<typeof updateSettings>[0];

let settingsUpdateQueue: Promise<void> = Promise.resolve();

export function updateSettingsSerially(data: SettingsUpdate) {
  const response = settingsUpdateQueue.then(() => updateSettings(data));
  settingsUpdateQueue = response.then(
    () => undefined,
    () => undefined
  );
  return response;
}
