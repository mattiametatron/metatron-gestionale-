'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('metatronDesktop', {
  isDesktopApp: true,
  platform: process.platform,
  openDataFolder: () => ipcRenderer.invoke('metatron:open-data-folder'),
  getNetworkInfo: () => ipcRenderer.invoke('metatron:get-network-info'),
});
