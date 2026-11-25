'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('metatronDesktop', {
  isDesktopApp: true,
  platform: process.platform,
  openDataFolder: () => ipcRenderer.invoke('metatron:open-data-folder'),
  getNetworkInfo: () => ipcRenderer.invoke('metatron:get-network-info'),
  updater: {
    getState: () => ipcRenderer.invoke('metatron:updater-get-state'),
    check: (repoSlug) => ipcRenderer.invoke('metatron:updater-check', repoSlug),
    download: () => ipcRenderer.invoke('metatron:updater-download'),
    installAndRestart: () => ipcRenderer.invoke('metatron:updater-install-restart'),
    onStateChange: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const handler = (_event, state) => callback(state);
      ipcRenderer.on('metatron:update-state', handler);
      return () => {
        ipcRenderer.removeListener('metatron:update-state', handler);
      };
    },
  },
  bluetooth: {
    selectDevice: (deviceId) => ipcRenderer.invoke('metatron:bluetooth-select', deviceId),
    cancel: () => ipcRenderer.invoke('metatron:bluetooth-select', ''),
    onDevices: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const handler = (_event, devices) => callback(devices);
      ipcRenderer.on('metatron:bluetooth-devices', handler);
      return () => {
        ipcRenderer.removeListener('metatron:bluetooth-devices', handler);
      };
    },
  },
});
