/**
 * AlbaChat Desktop â€” Electron Ana SÃ¼reÃ§
 *
 * GÃ¼venlik ayarlarÄ±:
 *   - contextIsolation: true
 *   - nodeIntegration: false
 *   - webSecurity: true
 *   - allowRunningInsecureContent: false
 */

const { app, BrowserWindow, ipcMain, shell, Notification, nativeImage, Menu } = require('electron');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { createTray } = require('./tray');

// â”€â”€â”€ Tek Ã–rnek KontrolÃ¼ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

const store = new Store();

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {BrowserWindow | null} */
let setupWindow = null;
/** @type {ReturnType<typeof createTray> | null} */
let tray = null;

// â”€â”€â”€ Pencere: Kurulum â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function createSetupWindow() {
  setupWindow = new BrowserWindow({
    width: 520,
    height: 380,
    resizable: false,
    maximizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'AlbaChat â€” Sunucu Kurulumu',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    show: false,
  });

  setupWindow.loadFile(path.join(__dirname, '..', 'setup', 'setup.html'));
  setupWindow.setMenu(null);
  setupWindow.once('ready-to-show', () => setupWindow?.show());
  setupWindow.on('closed', () => { setupWindow = null; });
}

// â”€â”€â”€ Pencere: Ana Uygulama â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function createMainWindow(serverUrl) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    title: 'AlbaChat',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    show: false,
    backgroundColor: '#f9fafb',
  });

  mainWindow.loadURL(serverUrl).catch(() => {
    // Sunucuya eriÅŸilemiyorsa baÄŸlantÄ± hatasÄ± sayfasÄ± gÃ¶ster
    mainWindow?.loadFile(path.join(__dirname, '..', 'setup', 'connection-error.html'));
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // Harici baÄŸlantÄ±larÄ± sistem tarayÄ±cÄ±sÄ±nda aÃ§
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Kapatma â†’ minimize (sistem tepsisine)
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // Uygulama menÃ¼sÃ¼ (MacOS uyumluluÄŸu + kÄ±sayollar)
  const menu = Menu.buildFromTemplate([
    {
      label: 'AlbaChat',
      submenu: [
        { label: 'Yenile', accelerator: 'F5', click: () => mainWindow?.webContents.reload() },
        { label: 'GeliÅŸtirici AraÃ§larÄ±', accelerator: 'F12', click: () => mainWindow?.webContents.toggleDevTools() },
        { type: 'separator' },
        {
          label: 'Sunucu DeÄŸiÅŸtir',
          click: () => { store.delete('serverUrl'); app.relaunch(); app.exit(0); },
        },
        { type: 'separator' },
        { label: 'Ã‡Ä±kÄ±ÅŸ', accelerator: 'Alt+F4', click: () => { app.isQuitting = true; app.quit(); } },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

// â”€â”€â”€ IPC: Kurulum â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ipcMain.on('setup:complete', (_, serverUrl) => {
  const clean = serverUrl.trim().replace(/\/$/, '');
  store.set('serverUrl', clean);
  setupWindow?.close();
  createMainWindow(clean);
  tray = createTray(mainWindow, store);
});

// â”€â”€â”€ IPC: Badge / OkunmamÄ±ÅŸ SayaÃ§ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ipcMain.on('badge:update', (_, count) => {
  tray?.setUnreadCount(count);

  // Windows gÃ¶rev Ã§ubuÄŸu overlay ikonu
  if (process.platform === 'win32' && mainWindow) {
    if (count > 0) {
      const overlayPath = path.join(__dirname, '..', 'assets', 'badge.png');
      try {
        mainWindow.setOverlayIcon(
          nativeImage.createFromPath(overlayPath),
          `${count} okunmamÄ±ÅŸ`,
        );
      } catch {
        mainWindow.setOverlayIcon(null, '');
      }
    } else {
      mainWindow.setOverlayIcon(null, '');
    }
  }
});

// â”€â”€â”€ IPC: Yerel Bildirim â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ipcMain.on('notification:show', (_, { title, body, urgent }) => {
  if (!Notification.isSupported()) return;

  const notif = new Notification({
    title,
    body,
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    urgency: urgent ? 'critical' : 'normal',
    silent: false,
  });

  notif.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  notif.show();
});

// â”€â”€â”€ IPC: Duyuru Popup (Ã–n Plana Ã‡ek) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ipcMain.on('announcement:force-show', (_, data) => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  // Renderer'a ilet (React AnnouncementModal aÃ§Ä±lÄ±r)
  mainWindow.webContents.send('announcement:show', data);
});

// â”€â”€â”€ IPC: GÃ¼ncelleme â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ipcMain.on('update:install', () => {
  app.isQuitting = true;
  autoUpdater.quitAndInstall();
});

// â”€â”€â”€ IPC: Store â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ipcMain.handle('store:get', (_, key) => store.get(key));
ipcMain.on('store:set', (_, key, value) => store.set(key, value));

// â”€â”€â”€ Uygulama YaÅŸam DÃ¶ngÃ¼sÃ¼ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.whenReady().then(() => {
  const serverUrl = store.get('serverUrl');

  if (serverUrl) {
    createMainWindow(serverUrl);
    tray = createTray(mainWindow, store);
  } else {
    createSetupWindow();
  }

  // Auto-updater
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update:available');
  });

  // macOS: dock'a tÄ±klanÄ±nca pencereyi geri getir
  app.on('activate', () => {
    if (!mainWindow && !setupWindow) {
      const url = store.get('serverUrl');
      if (url) { createMainWindow(url); tray = createTray(mainWindow, store); }
      else createSetupWindow();
    } else {
      mainWindow?.show();
    }
  });
});

// Ä°kinci Ã¶rnek aÃ§Ä±lÄ±rsa mevcut pencereyi Ã¶n plana Ã§ek
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on('before-quit', () => { app.isQuitting = true; });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

