// Minimal preload. The game persists to IndexedDB inside the renderer, so no
// privileged bridge is required; this exists for parity with the Tauri shell
// and future native hooks.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('myspolly', {
  platform: process.platform,
  shell: 'electron',
});
