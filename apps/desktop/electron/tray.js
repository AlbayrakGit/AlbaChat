const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');

let trayInstance = null;
let unreadCount = 0;

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

/**
 * Sistem tepsisi ikonunu oluştur ve yönet.
 * Windows tray ikonu: ICO formatı tercih edilir (tüm çözünürlükleri içerir).
 * PNG fallback: 16x16 tray-icon.png
 * @param {import('electron').BrowserWindow} mainWindow
 * @param {import('electron-store').default} store
 */
function createTray(mainWindow, store) {
  // Windows'ta ICO en güvenilir format — tüm DPI çözünürlüklerini destekler
  const icoPath = path.join(ASSETS_DIR, 'AlbaChat.ico');
  const pngPath = path.join(ASSETS_DIR, 'tray-icon.png');

  let icon = nativeImage.createFromPath(icoPath);
  if (icon.isEmpty()) {
    icon = nativeImage.createFromPath(pngPath);
  }
  if (icon.isEmpty()) {
    console.error('[Tray] Ikon yuklenemedi! ICO ve PNG bulunamadi.');
    icon = nativeImage.createEmpty();
  }

  // Windows tray icin 16x16 resize (ICO'dan en yakin boyutu secer)
  const trayIcon = icon.resize({ width: 16, height: 16 });
  trayInstance = new Tray(trayIcon);
  trayInstance.setToolTip('AlbaChat');

  _updateMenu(mainWindow, store);

  // Sol tık → pencereyi göster / odakla
  trayInstance.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.isVisible() ? mainWindow.focus() : mainWindow.show();
  });

  // Çift tık → pencereyi göster
  trayInstance.on('double-click', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  return {
    /** Okunmamış sayacını güncelle ve tray tooltip'i yenile */
    setUnreadCount(count) {
      unreadCount = count;
      const label = count > 0 ? `AlbaChat (${count} okunmam\u0131\u015f)` : 'AlbaChat';
      trayInstance.setToolTip(label);
      _updateMenu(mainWindow, store);
    },

    destroy() {
      if (trayInstance && !trayInstance.isDestroyed()) {
        trayInstance.destroy();
        trayInstance = null;
      }
    },
  };
}

function _updateMenu(mainWindow, store) {
  const unreadItem = unreadCount > 0
    ? { label: `${unreadCount} okunmam\u0131\u015f mesaj`, enabled: false }
    : { label: 'Yeni mesaj yok', enabled: false };

  const menu = Menu.buildFromTemplate([
    { label: 'AlbaChat', enabled: false, icon: _smallIcon() },
    { type: 'separator' },
    unreadItem,
    { type: 'separator' },
    {
      label: 'A\u00e7 / \u00d6n Plana Getir',
      click() {
        if (!mainWindow) return;
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      },
    },
    {
      label: 'Sunucu De\u011fi\u015ftir',
      click() {
        store.delete('serverUrl');
        app.relaunch();
        app.exit(0);
      },
    },
    { type: 'separator' },
    {
      label: '\u00c7\u0131k\u0131\u015f',
      click() {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  if (trayInstance && !trayInstance.isDestroyed()) {
    trayInstance.setContextMenu(menu);
  }
}

function _smallIcon() {
  try {
    const icon = nativeImage.createFromPath(path.join(ASSETS_DIR, 'AlbaChat.ico'));
    if (icon.isEmpty()) return undefined;
    return icon.resize({ width: 16, height: 16 });
  } catch {
    return undefined;
  }
}

module.exports = { createTray };
