/**
 * Web Push Notification hook'u.
 */
import { useState, useCallback } from 'react';
import { apiClient as api } from '@/api/client';

type PushState = 'idle' | 'requesting' | 'subscribed' | 'denied' | 'unsupported';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    arr[i] = rawData.charCodeAt(i);
  }
  return arr.buffer;
}

export function usePushNotification() {
  const [state, setState] = useState<PushState>(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    if (Notification.permission === 'granted') return 'subscribed';
    return 'idle';
  });

  const subscribe = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }
    setState('requesting');
    try {
      const { data } = await api.get<{ publicKey: string }>('/push/vapid-key');
      const applicationServerKey = urlBase64ToUint8Array(data.publicKey);
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }
      await api.post('/push/subscribe', subscription.toJSON());
      setState('subscribed');
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setState('denied');
      } else {
        console.error('[Push] Abonelik hatası:', err);
        setState('idle');
      }
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await api.delete('/push/subscribe', { data: { endpoint: subscription.endpoint } });
        await subscription.unsubscribe();
      }
      setState('idle');
    } catch (err) {
      console.error('[Push] Abonelik iptali hatası:', err);
    }
  }, []);

  const isSupported = state !== 'unsupported';
  const isSubscribed = state === 'subscribed';
  const isDenied = state === 'denied';
  const isLoading = state === 'requesting';

  return { state, subscribe, unsubscribe, isSupported, isSubscribed, isDenied, isLoading };
}
