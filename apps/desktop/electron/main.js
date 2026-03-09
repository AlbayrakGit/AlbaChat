/**
 * AlbaChat Desktop - Electron Ana Surec
 */

const { app, BrowserWindow, ipcMain, shell, Notification, nativeImage, Menu } = require('electron');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { createTray, getTray } = require('./tray');

// --- Tek Ornek Kontrolu ---
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

const store = new Store();

// Windows bildirim sistemiyle uyumlu AppUserModelId
// electron-builder.yml'deki appId ile birebir uyusmali
app.setAppUserModelId('com.albachat.desktop');

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {ReturnType<typeof createTray> | null} */
let tray = null;

// --- Ikon Yollari ---
const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const APP_ICON_PATH = path.join(ASSETS_DIR, 'AlbaChat.ico');
const NOTIFICATION_ICON_PATH = path.join(ASSETS_DIR, 'notification-icon.png');

/** Bildirim ikonu (bir kez yukle, tekrar kullan) */
let _notifIcon = null;
function getNotificationIcon() {
  if (!_notifIcon) {
    _notifIcon = nativeImage.createFromPath(NOTIFICATION_ICON_PATH);
    if (_notifIcon.isEmpty()) {
      _notifIcon = nativeImage.createFromPath(APP_ICON_PATH);
    }
  }
  return _notifIcon;
}

// --- Pencere: Ana Uygulama ---
function createMainWindow(serverUrl) {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 825,
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    title: `AlbaChat v${app.getVersion()}`,
    icon: APP_ICON_PATH,
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
    if (!mainWindow || mainWindow.isMaximized()) return;
    if (url.includes('/admin')) {
      mainWindow.setMinimumSize(1200, 600);
      mainWindow.setSize(1200, 825, true);
      mainWindow.center();
    } else {
      mainWindow.setMinimumSize(800, 600);
      mainWindow.setSize(800, 825, true);
      mainWindow.center();
    }
  };

  mainWindow.webContents.on('did-navigate', (event, url) => updateSizeByUrl(url));
  mainWindow.webContents.on('did-navigate-in-page', (event, url) => updateSizeByUrl(url));

  // --- UI Temizligi: Download Linkini Gizle ---
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.insertCSS(`
      /* Electron icinde indirme linkini gizle */
      a[href*="AlbaChat-Setup"] { display: none !important; }
      /* Login altindaki download container — sadece login sayfasinda */
      .min-h-screen .border-t:has(a[href*="AlbaChat-Setup"]) { display: none !important; }
      /* Scrollbar gizle — mouse tekerleği ile kaydırma çalışmaya devam eder */
      ::-webkit-scrollbar { width: 0 !important; height: 0 !important; }
      * { scrollbar-width: none !important; }
    `);
  });
}

// --- IPC: Bildirimler ---
ipcMain.on('notification:show', (_, { title, body, urgent }) => {
  const notifTitle = title || 'AlbaChat';
  const notifBody = body || '';
  const icon = getNotificationIcon();

  // Yontem 1: Tray.displayBalloon — Windows system tray baloncuk bildirimi
  // Bu yontem Electron Notification'dan daha guvenilir calisiyor
  const trayInstance = getTray();
  if (trayInstance && !trayInstance.isDestroyed()) {
    trayInstance.displayBalloon({
      iconType: urgent ? 'warning' : 'info',
      icon: icon.isEmpty() ? undefined : icon,
      title: notifTitle,
      content: notifBody,
      noSound: false,
      respectQuietTime: false,
    });
  }

  // Yontem 2: Electron Notification API (yedek — bazi Windows surumlerinde calismayabilir)
  try {
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: notifTitle,
        body: notifBody,
        icon: icon.isEmpty() ? undefined : icon,
        silent: true, // Balloon zaten ses caliyor, cift ses olmasin
        urgency: urgent ? 'critical' : 'normal',
        timeoutType: urgent ? 'never' : 'default',
      });
      notification.on('click', () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      });
      notification.show();
    }
  } catch (err) {
    console.error('[Notification] Electron Notification hatasi:', err.message);
  }

  // Pencere odakta degilse taskbar'da flash
  if (mainWindow && !mainWindow.isFocused()) {
    mainWindow.flashFrame(true);
  }
});

// --- IPC: Badge ---
ipcMain.on('badge:update', (_, count) => {
  if (process.platform === 'win32' && mainWindow) {
    if (count > 0) {
      try {
        const badgeIcon = createBadgeIcon(count);
        mainWindow.setOverlayIcon(badgeIcon, `${count} okunmamis mesaj`);
      } catch {
        mainWindow.setOverlayIcon(null, '');
      }
    } else {
      mainWindow.setOverlayIcon(null, '');
    }
  }
  if (tray) tray.setUnreadCount(count);
});

/**
 * Taskbar overlay icin kirmizi badge ikonu olustur.
 */
function createBadgeIcon(count) {
  const size = 16;
  const text = count > 99 ? '99+' : String(count);
  const fontSize = text.length > 2 ? 8 : 10;
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#EF4444"/>
    <text x="${size / 2}" y="${size / 2 + fontSize / 3}" text-anchor="middle"
          font-family="Arial" font-size="${fontSize}" font-weight="bold" fill="white">${text}</text>
  </svg>`;
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  return nativeImage.createFromDataURL(dataUrl);
}

// --- IPC: Duyuru Popup ---
ipcMain.on('announcement:force-show', (_, data) => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  mainWindow.setAlwaysOnTop(true);
  setTimeout(() => mainWindow?.setAlwaysOnTop(false), 1000);
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
  tray = createTray(mainWindow);

  // Tray balon tiklandiktan sonra pencereyi ac
  const trayInstance = getTray();
  if (trayInstance) {
    trayInstance.on('balloon-click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    });
  }

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
