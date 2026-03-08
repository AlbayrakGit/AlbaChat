/**
 * Capacitor Push Notifications — Android FCM entegrasyonu
 *
 * Capacitor ortamında çalışıyorsa (APK), FCM token alır ve API'ye kaydeder.
 * Web ortamında hiçbir şey yapmaz.
 */
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { apiClient } from '@/api/client';

let initialized = false;

/**
 * Capacitor push bildirimlerini başlat.
 * Login sonrası çağrılmalı.
 */
export async function initCapacitorPush(): Promise<void> {
  // Sadece native ortamda çalış (Android/iOS)
  if (!Capacitor.isNativePlatform()) return;
  if (initialized) return;
  initialized = true;

  try {
    // İzin iste
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') {
      console.warn('[CapPush] Bildirim izni verilmedi');
      return;
    }

    // FCM'e kaydol
    await PushNotifications.register();

    // Token alındığında API'ye kaydet
    PushNotifications.addListener('registration', async (token) => {
      console.log('[CapPush] FCM token alındı:', token.value.slice(0, 20) + '...');
      try {
        await apiClient.post('/push/fcm-register', {
          token: token.value,
          platform: Capacitor.getPlatform(), // 'android' veya 'ios'
        });
        console.log('[CapPush] Token API\'ye kaydedildi');
      } catch (err) {
        console.error('[CapPush] Token kayıt hatası:', err);
      }
    });

    // Kayıt hatası
    PushNotifications.addListener('registrationError', (err) => {
      console.error('[CapPush] Kayıt hatası:', err);
    });

    // Uygulama açıkken gelen bildirim
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[CapPush] Bildirim alındı:', notification.title);
      // Uygulama açıkken ekstra bir şey yapma — mesaj zaten socket'ten gelir
    });

    // Kullanıcı bildirime tıkladığında
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = action.notification.data;
      if (data?.groupId) {
        // Sohbet grubuna yönlendir — chatStore'dan selectedGroupId'yi set et
        const event = new CustomEvent('push:navigate', { detail: { groupId: parseInt(data.groupId) } });
        window.dispatchEvent(event);
      }
    });

    console.log('[CapPush] Push notifications başlatıldı');
  } catch (err) {
    console.error('[CapPush] Başlatma hatası:', err);
  }
}

/**
 * Çıkış yaparken FCM token'ı sil.
 */
export async function removeCapacitorPush(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await PushNotifications.removeAllListeners();
    initialized = false;
  } catch (err) {
    console.error('[CapPush] Token silme hatası:', err);
  }
}
