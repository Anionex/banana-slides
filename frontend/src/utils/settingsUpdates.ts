import { getSettings, resetSettings, updateSettings } from '@/api/endpoints';

type SettingsUpdate = Parameters<typeof updateSettings>[0];

let settingsUpdateQueue: Promise<void> = Promise.resolve();

export function updateSettingsSerially(data: SettingsUpdate) {
  return enqueueSettingsMutation(() => updateSettings(data));
}

export function resetSettingsSerially() {
  return enqueueSettingsMutation(() => resetSettings());
}

export async function getSettingsAfterPendingUpdates() {
  await settingsUpdateQueue;
  return getSettings();
}

function enqueueSettingsMutation<T>(operation: () => Promise<T>): Promise<T> {
  const response = settingsUpdateQueue.then(operation);
  settingsUpdateQueue = response.then(
    () => undefined,
    () => undefined
  );
  return response;
}
