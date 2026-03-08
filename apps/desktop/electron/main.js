/**
 * AlbaChat Desktop - Electron Ana Surec
 */

const { app, BrowserWindow, ipcMain, shell, Notification, nativeImage, Menu } = require('electron');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { createTray } = require('./tray');

// --- Tek Ornek Kontrolu ---
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

const store = new Store();

// Windows bildirim alaninda gorunecek kurumsal isim (AlbaChat - Erna Holding Bilgi Teknolojileri)
app.setAppUserModelId('AlbaChat - Erna Holding Bilgi Teknolojileri');

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {ReturnType<typeof createTray> | null} */
let tray = null;

// --- Pencere: Ana Uygulama ---
function createMainWindow(serverUrl) {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 825,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
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
    autoHideMenuBar: true,
  });

  mainWindow.setMenu(null);

  mainWindow.loadURL(serverUrl).catch(() => {
    mainWindow?.loadFile(path.join(__dirname, '..', 'setup', 'connection-error.html'));
  });

  if (!process.argv.includes('--hidden')) {
    mainWindow.once('ready-to-show', () => mainWindow?.show());
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  // --- Navigasyon Takibi ile Otomatik Boyutlandirma ---
  const updateSizeByUrl = (url) => {
    if (!mainWindow) return;
    if (url.includes('/admin')) {
      mainWindow.setResizable(true);
      mainWindow.setMinimumSize(1200, 825);
      mainWindow.setMaximumSize(1200, 825);
      mainWindow.setSize(1200, 825, true);
      mainWindow.center();
      mainWindow.setResizable(false);
    } else if (!url.includes('/admin')) {
      mainWindow.setResizable(true);
      mainWindow.setMinimumSize(800, 825);
      mainWindow.setMaximumSize(800, 825);
      mainWindow.setSize(800, 825, true);
      mainWindow.center();
      mainWindow.setResizable(false);
    }
  };

  mainWindow.webContents.on('did-navigate', (event, url) => updateSizeByUrl(url));
  mainWindow.webContents.on('did-navigate-in-page', (event, url) => updateSizeByUrl(url));

  // --- UI Temizligi: Download Linkini Gizle ---
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.insertCSS(`
      /* Electron icinde indirme linkini gizle */
      a[href*="AlbaChat-Setup.exe"] { display: none !important; }
      .pt-2.border-t.border-gray-100 { display: none !important; }
      /* Scrollbar gizle — mouse tekerleği ile kaydırma çalışmaya devam eder */
      ::-webkit-scrollbar { width: 0 !important; height: 0 !important; }
      * { scrollbar-width: none !important; }
    `);
  });
}

// --- IPC: Bildirimler ---
ipcMain.on('notify', (_, { title, body, silent }) => {
  const notification = new Notification({
    title,
    body,
    silent: !!silent,
  });
  notification.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
  notification.show();
});

// --- IPC: Badge ---
ipcMain.on('badge:update', (_, count) => {
  if (process.platform === 'win32') {
    if (count > 0) {
      mainWindow?.setOverlayIcon(null, '');
      mainWindow?.setProgressBar(0.5);
    } else {
      mainWindow?.setProgressBar(-1);
    }
  }
  if (tray) tray.setUnreadCount(count);
});

// --- IPC: Duyuru Popup ---
ipcMain.on('announcement:force-show', (_, data) => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('announcement:show', data);
});

ipcMain.on('update:install', () => {
  app.isQuitting = true;
  autoUpdater.quitAndInstall();
});

ipcMain.handle('store:get', (_, key) => store.get(key));
ipcMain.on('store:set', (_, key, value) => store.set(key, value));

// --- IPC: Pencere Boyutu ---
ipcMain.on('window:resize', (_, { width, height }) => {
  if (!mainWindow) return;
  mainWindow.setResizable(true);
  mainWindow.setMinimumSize(width, height);
  mainWindow.setMaximumSize(width, height);
  mainWindow.setSize(width, height, true);
  mainWindow.center();
  mainWindow.setResizable(false);
});

const EMBEDDED_SERVER_URL = 'https://albachat.ernaholding.com';

// --- Uygulama Yasam Dongusu ---
app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: app.getPath('exe'),
      args: ['--hidden']
    });
  }

  createMainWindow(EMBEDDED_SERVER_URL);
  tray = createTray(mainWindow, store);

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.checkForUpdatesAndNotify().catch(() => { });

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update:available');
  });

  app.on('activate', () => {
    if (mainWindow) mainWindow.show();
  });
});

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
