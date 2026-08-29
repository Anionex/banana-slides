export interface DesktopUpdateInfo {
  version: string;
  notes: string;
  url: string;
}

export interface DesktopUpdateCheckResult {
  status: 'up_to_date' | 'update_available';
  currentVersion: string;
  latestVersion: string;
  update: DesktopUpdateInfo | null;
}
