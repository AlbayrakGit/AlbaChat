/**
 * Preload script — güvenli IPC köprüsü
 * contextIsolation=true, nodeIntegration=false
 * Renderer process'e sadece açıkça izin verilen API'ler gönderilir.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ─── Kurulum ───────────────────────────────────────────────────────────────
  /** İlk çalıştırma: sunucu URL'sini kaydet ve ana pencereyi aç */
  completeSetup: (serverUrl) => ipcRenderer.send('setup:complete', serverUrl),

  // ─── Bildirimler ───────────────────────────────────────────────────────────
  /** Windows yerel bildirimi göster */
  showNotification: (data) => ipcRenderer.send('notification:show', data),

  // ─── Görev çubuğu badge ────────────────────────────────────────────────────
  /** Okunmamış mesaj sayacını güncelle (tray tooltip + overlay icon) */
  updateBadge: (count) => ipcRenderer.send('badge:update', count),

  // ─── Duyuru ────────────────────────────────────────────────────────────────
  /** Acil duyuru geldiğinde pencereyi önplana çek */
  forceShowAnnouncement: (data) => ipcRenderer.send('announcement:force-show', data),
  /** Ana pencereye duyuru show eventi dinle */
  onAnnouncementShow: (callback) => {
    ipcRenderer.on('announcement:show', (_, data) => callback(data));
  },

  // ─── Güncelleme ────────────────────────────────────────────────────────────
  /** Yeni sürüm indirildiğinde bildir */
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update:available', () => callback());
  },
  /** Uygulamayı yeniden başlatarak güncellemeyi uygula */
  installUpdate: () => ipcRenderer.send('update:install'),

  // ─── Store (kalıcı ayarlar) ────────────────────────────────────────────────
  getStoreValue: (key) => ipcRenderer.invoke('store:get', key),
  setStoreValue: (key, value) => ipcRenderer.send('store:set', key, value),

  // ─── Pencere Yönetimi ──────────────────────────────────────────────────────
  /** Pencere boyutunu dinamik olarak güncelle (örn. Admin sayfaları için) */
  resizeWindow: (width, height) => ipcRenderer.send('window:resize', { width, height }),
});
