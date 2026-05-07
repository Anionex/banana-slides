const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('trayMenuAPI', {
  sendAction: (id) => ipcRenderer.send('tray-menu-action', id),
  closeMenu: () => ipcRenderer.send('tray-menu-close'),
});
