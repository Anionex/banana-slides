const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    // 获取应用版本
    getVersion: () => ipcRenderer.invoke('get-version'),

    // 获取后端端口（从 URL 参数获取）
    getBackendPort: () => {
        const params = new URLSearchParams(window.location.search);
        return params.get('backendPort') || '5000';
    },

    // 打开外部链接
    openExternal: (url) => ipcRenderer.invoke('open-external', url),

    // 显示保存对话框
    showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),

    // 显示打开对话框
    showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),

    // 获取用户数据路径
    getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),

    // 下载文件（弹出保存对话框，下载到本地）
    downloadFile: (url, filename) => ipcRenderer.invoke('download-file', { url, filename }),

    // 平台信息
    platform: process.platform,

    // 判断是否在 Electron 环境中
    isElectron: true
});

console.log('Preload script loaded');

