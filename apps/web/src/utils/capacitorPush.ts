/**
 * Capacitor Push Notifications — Android FCM entegrasyonu
 *
 * server.url modunda Capacitor bridge window.Capacitor olarak enjekte edilir.
 * npm'den gelen @capacitor/core yerine doğrudan window.Capacitor kontrolü yapılır.
 */
import { apiClient } from '@/api/client';

let initialized = false;

// window.Capacitor tipini tanımla
declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
      Plugins?: Record<string, unknown>;
    };
  }
}

/**
 * Capacitor native ortamda mıyız?
 */
function isNative(): boolean {
  return !!(window.Capacitor?.isNativePlatform?.());
}

/**
 * Capacitor push bildirimlerini başlat.
 * Login sonrası çağrılmalı.
 */
export async function initCapacitorPush(): Promise<void> {
  if (!isNative()) {
    console.log('[CapPush] Native ortam değil, atlanıyor');
    return;
  }
  if (initialized) return;
  initialized = true;

  console.log('[CapPush] Native ortam algılandı, platform:', window.Capacitor?.getPlatform?.());

  try {
    // Dinamik import — sadece native ortamda yükle
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // Önce listener'ları ekle (register'dan ÖNCE — token event'i kaçırılmasın)
    await PushNotifications.addListener('registration', async (token) => {
      console.log('[CapPush] FCM token alındı:', token.value.slice(0, 20) + '...');
      try {
        await apiClient.post('/push/fcm-register', {
          token: token.value,
          platform: window.Capacitor?.getPlatform?.() || 'android',
        });
        console.log('[CapPush] Token API\'ye kaydedildi');
      } catch (err) {
        console.error('[CapPush] Token kayıt hatası:', err);
      }
    });

    await PushNotifications.addListener('registrationError', (err) => {
      console.error('[CapPush] Kayıt hatası:', JSON.stringify(err));
    });

    // Uygulama açıkken gelen bildirim
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[CapPush] Bildirim alındı:', notification.title);
    });

    // Kullanıcı bildirime tıkladığında
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = action.notification.data;
      if (data?.groupId) {
        const event = new CustomEvent('push:navigate', { detail: { groupId: parseInt(data.groupId) } });
        window.dispatchEvent(event);
      }
    });

    // İzin iste
    const permResult = await PushNotifications.requestPermissions();
    console.log('[CapPush] İzin durumu:', permResult.receive);

    if (permResult.receive !== 'granted') {
      console.warn('[CapPush] Bildirim izni verilmedi');
      return;
    }

    // FCM'e kaydol
    await PushNotifications.register();
    console.log('[CapPush] FCM register() çağrıldı');

  } catch (err) {
    console.error('[CapPush] Başlatma hatası:', err);
  }
}

/**
 * Çıkış yaparken FCM token'ı sil.
 */
export async function removeCapacitorPush(): Promise<void> {
  if (!isNative()) return;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    await PushNotifications.removeAllListeners();
    initialized = false;
  } catch (err) {
    console.error('[CapPush] Listener temizleme hatası:', err);
  }
}
