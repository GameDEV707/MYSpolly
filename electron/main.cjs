// Electron fallback shell (documented alternative to Tauri).
// Larger binary (~100 MB) but no Rust toolchain required. Loads the same built
// web bundle from ../dist. Use only if the Tauri/Rust path is unavailable.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    title: 'MYSpolly - Brass: Birmingham',
    backgroundColor: '#14110e',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  // Load the offline web build (relative base, so file:// works).
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
