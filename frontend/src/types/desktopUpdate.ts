export interface DesktopUpdateInfo {
  version: string;
  notes: string;
  url: string;
}

export interface DesktopUpdateProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export type DesktopUpdateStatus =
  | 'idle'
  | 'disabled'
  | 'checking'
  | 'up_to_date'
  | 'update_available'
  | 'downloading'
  | 'update_downloaded'
  | 'error';

export interface DesktopUpdateCheckResult {
  status: DesktopUpdateStatus;
  currentVersion: string;
  latestVersion: string;
  update: DesktopUpdateInfo | null;
  progress?: DesktopUpdateProgress | null;
  error?: string | null;
  canAutoUpdate?: boolean;
  automaticUpdatesEnabled?: boolean;
  checkSource?: 'automatic' | 'manual' | null;
}

export interface DesktopAutoUpdateSettings {
  automaticUpdatesEnabled: boolean;
  canAutoUpdate?: boolean;
}

export interface DesktopUpdateElectronApi {
  checkForUpdates: () => Promise<DesktopUpdateCheckResult>;
  getUpdateState?: () => Promise<DesktopUpdateCheckResult>;
  getAutoUpdateSettings?: () => Promise<DesktopAutoUpdateSettings>;
  setAutomaticUpdatesEnabled?: (enabled: boolean) => Promise<DesktopAutoUpdateSettings>;
  downloadUpdate?: () => Promise<DesktopUpdateCheckResult>;
  installUpdate?: () => Promise<{ success: boolean; error?: string }>;
  onUpdateStatus?: (callback: (state: DesktopUpdateCheckResult) => void) => (() => void);
  openExternal: (url: string) => Promise<void>;
}
