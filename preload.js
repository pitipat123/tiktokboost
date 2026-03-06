const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // API proxy — bypass CORS
    apiCall: (url, body) => ipcRenderer.invoke('api-call', { url, body }),

    // Settings
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

    // Presets
    getPresets: () => ipcRenderer.invoke('get-presets'),
    savePresets: (presets) => ipcRenderer.invoke('save-presets', presets),

    // Auto-Update
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_, status) => callback(status)),
    onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (_, percent) => callback(percent)),
});
