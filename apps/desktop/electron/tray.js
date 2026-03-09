const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');

let trayInstance = null;
let unreadCount = 0;

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

/**
 * Sistem tepsisi ikonunu oluştur ve yönet.
 * Windows tray: PNG dosyası kullanılır (ICO tray'de görünmez ikon sorununa yol açar).
 * @param {import('electron').BrowserWindow} mainWindow
 */
function createTray(mainWindow) {
  // PNG dosyası — Windows tray için en güvenilir format
  const pngPath = path.join(ASSETS_DIR, 'tray-icon.png');
  const icon = nativeImage.createFromPath(pngPath);

  if (icon.isEmpty()) {
    console.error('[Tray] tray-icon.png yuklenemedi!');
  }

  trayInstance = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  trayInstance.setToolTip('AlbaChat');

  _updateMenu(mainWindow);

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
      _updateMenu(mainWindow);
    },

    destroy() {
      if (trayInstance && !trayInstance.isDestroyed()) {
        trayInstance.destroy();
        trayInstance = null;
      }
    },
  };
}

function _updateMenu(mainWindow) {
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
    const icon = nativeImage.createFromPath(path.join(ASSETS_DIR, 'tray-icon.png'));
    if (icon.isEmpty()) return undefined;
    return icon.resize({ width: 16, height: 16 });
  } catch {
    return undefined;
  }
}

/** Ham Tray instance'ini don (displayBalloon icin) */
function getTray() {
  return trayInstance;
}

module.exports = { createTray, getTray };
