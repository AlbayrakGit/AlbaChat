import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

/**
 * Socket.IO bağlantısını başlat.
 * Access token handshake auth ile gönderilir.
 */
export function initSocket(token: string): Socket {
  if (socket) {
    socket.disconnect();
  }

  socket = io({
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,       // İlk bekleyiş: 1s
    reconnectionDelayMax: 30000,   // Maksimum: 30s
    randomizationFactor: 0.5,
  });

  return socket;
}

/** Mevcut socket instance'ını döndür */
export function getSocket(): Socket {
  if (!socket) throw new Error('Socket başlatılmamış. Önce initSocket() çağır.');
  return socket;
}

/** Bağlantıyı kes ve temizle */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
