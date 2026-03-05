const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');

let trayInstance = null;
let unreadCount = 0;

/**
 * Sistem tepsisi ikonunu oluştur ve yönet.
 * @param {import('electron').BrowserWindow} mainWindow
 * @param {import('electron-store').default} store
 */
function createTray(mainWindow, store) {
  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath);

  trayInstance = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  trayInstance.setToolTip('AlbaChat');

  _updateMenu(mainWindow, store);

  // Sol tık → pencereyi göster / odakla
  trayInstance.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.isVisible() ? mainWindow.focus() : mainWindow.show();
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
    return nativeImage.createFromPath(
      path.join(__dirname, '..', 'assets', 'tray-icon.png'),
    ).resize({ width: 16, height: 16 });
  } catch {
    return undefined;
  }
}

module.exports = { createTray };
