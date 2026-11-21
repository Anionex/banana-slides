const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getUpdateState: () => ipcRenderer.invoke('get-update-state'),
  getAutoUpdateSettings: () => ipcRenderer.invoke('get-auto-update-settings'),
  setAutomaticUpdatesEnabled: (enabled) => ipcRenderer.invoke('set-automatic-updates-enabled', enabled),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateStatus: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('update-status-changed', listener);
    return () => ipcRenderer.removeListener('update-status-changed', listener);
  },
  getPlatform: () => process.platform,
  getBackendPort: () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('backendPort');
  },
  isElectron: true,
  downloadFile: (url, filename) => ipcRenderer.invoke('download-file', { url, filename }),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  zoomIn: () => ipcRenderer.send('zoom-in'),
  zoomOut: () => ipcRenderer.send('zoom-out'),
  zoomReset: () => ipcRenderer.send('zoom-reset'),
  getZoomLevel: () => ipcRenderer.invoke('get-zoom-level'),
  getDataStorageInfo: () => ipcRenderer.invoke('get-data-storage-info'),
  chooseDataStorageDirectory: () => ipcRenderer.invoke('choose-data-storage-directory'),
  inspectDataStorageDirectory: (dataRoot) => ipcRenderer.invoke('inspect-data-storage-directory', dataRoot),
  openDataStorageDirectory: () => ipcRenderer.invoke('open-data-storage-directory'),
  applyDataStorageDirectory: (dataRoot, allowInitialize = false) => (
    ipcRenderer.invoke('apply-data-storage-directory', dataRoot, allowInitialize)
  ),
});
