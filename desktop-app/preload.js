const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // Logs
  getLogs: () => ipcRenderer.invoke('get-logs'),
  clearLogs: () => ipcRenderer.invoke('clear-logs'),
  onLog: (callback) => {
    ipcRenderer.on('log', (event, log) => callback(log));
  },
  
  // Discord
  setActivity: (activity) => ipcRenderer.invoke('set-activity', activity),
  clearActivity: () => ipcRenderer.invoke('clear-activity'),
  testConnection: (clientId) => ipcRenderer.invoke('test-connection', clientId),
  getStatus: () => ipcRenderer.invoke('get-status'),
  
  // Discord events
  onDiscordConnected: (callback) => {
    ipcRenderer.on('discord-connected', (event, user) => callback(user));
  },
  onDiscordDisconnected: (callback) => {
    ipcRenderer.on('discord-disconnected', () => callback());
  },
  onDiscordError: (callback) => {
    ipcRenderer.on('discord-error', (event, error) => callback(error));
  },
  
  // Activity events
  onActivitySet: (callback) => {
    ipcRenderer.on('activity-set', (event, activity) => callback(activity));
  },
  onActivityCleared: (callback) => {
    ipcRenderer.on('activity-cleared', () => callback());
  },
  onActivityError: (callback) => {
    ipcRenderer.on('activity-error', (event, error) => callback(error));
  },
  
  // Extension events
  onExtensionMessage: (callback) => {
    ipcRenderer.on('extension-message', (event, data) => callback(data));
  },
  getExtensionStatus: () => ipcRenderer.invoke('get-extension-status'),
  
  // Settings
  getClientId: () => ipcRenderer.invoke('get-client-id'),
  saveClientId: (clientId) => ipcRenderer.invoke('save-client-id', clientId),
  getStorageInfo: () => ipcRenderer.invoke('get-storage-info'),
  getAppSettings: () => ipcRenderer.invoke('get-app-settings'),
  saveAppSettings: (settings) => ipcRenderer.invoke('save-app-settings', settings),
  
  // Autostart
  getAutostart: () => ipcRenderer.invoke('get-autostart'),
  setAutostart: (enabled) => ipcRenderer.invoke('set-autostart', { enabled })
});
