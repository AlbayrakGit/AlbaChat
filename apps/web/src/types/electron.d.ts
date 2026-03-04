/**
 * Electron preload.js tarafından window'a eklenen API tanımları.
 * Tarayıcıda çalışırken window.electronAPI === undefined olur.
 */
interface ElectronNotificationData {
  title: string;
  body: string;
  urgent?: boolean;
}

interface ElectronAPI {
  /** İlk çalıştırma: sunucu URL'sini kaydet ve ana pencereyi yükle */
  completeSetup: (serverUrl: string) => void;

  /** Okunmamış mesaj sayacını tray ve overlay'e yansıt */
  updateBadge: (count: number) => void;

  /** Windows yerel bildirimi göster */
  showNotification: (data: ElectronNotificationData) => void;

  /** Acil duyuruda pencereyi ön plana çek */
  forceShowAnnouncement: (data: unknown) => void;

  /** Ana pencereye duyuru gösterme eventini dinle */
  onAnnouncementShow: (callback: (data: unknown) => void) => void;

  /** Yeni sürüm indirildiğinde tetiklenir */
  onUpdateAvailable: (callback: () => void) => void;

  /** Uygulamayı yeniden başlatarak güncellemeyi uygula */
  installUpdate: () => void;

  /** electron-store'dan değer oku */
  getStoreValue: (key: string) => Promise<unknown>;

  /** electron-store'a değer yaz */
  setStoreValue: (key: string, value: unknown) => void;
}

interface Window {
  electronAPI?: ElectronAPI;
}
