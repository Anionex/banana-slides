export interface DataStorageInfo {
  dataRoot: string;
  isDefault: boolean;
  hasDatabase: boolean;
  configurable: boolean;
}

export interface DataStorageInspection {
  dataRoot: string;
  exists: boolean;
  writable: boolean;
  hasDatabase: boolean;
  isEmpty: boolean;
}

export interface DataStorageApplyResult {
  success: boolean;
  restarting: true;
}

export interface DataStorageOpenResult {
  success: boolean;
  error?: string;
}

export interface DataStorageElectronApi {
  getDataStorageInfo(): Promise<DataStorageInfo>;
  chooseDataStorageDirectory(): Promise<string | null>;
  inspectDataStorageDirectory(path: string): Promise<DataStorageInspection>;
  openDataStorageDirectory(): Promise<DataStorageOpenResult>;
  applyDataStorageDirectory(path: string, allowInitialize: boolean): Promise<DataStorageApplyResult>;
}

export function getDataStorageElectronApi(): DataStorageElectronApi | null {
  if (typeof window === 'undefined') return null;
  const api = (window as typeof window & { electronAPI?: Partial<DataStorageElectronApi> }).electronAPI;
  if (
    !api?.getDataStorageInfo ||
    !api.chooseDataStorageDirectory ||
    !api.inspectDataStorageDirectory ||
    !api.openDataStorageDirectory ||
    !api.applyDataStorageDirectory
  ) {
    return null;
  }
  return api as DataStorageElectronApi;
}
