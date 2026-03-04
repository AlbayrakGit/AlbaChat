import { verifyAccessToken } from '../utils/jwt.js';
import { setupPresenceHandler } from './handlers/presenceHandler.js';
import { setupTypingHandler } from './handlers/typingHandler.js';
import { setupMessageHandler } from './handlers/messageHandler.js';
import { setupCatchupHandler } from './handlers/catchupHandler.js';
import { setupReadHandler } from './handlers/readHandler.js';
import { setupAnnouncementHandler } from './handlers/announcementHandler.js';
import { subscribeToEvents } from './pubsub.js';

/**
 * Socket.IO sunucusunu konfigüre eder.
 * server.js'te build() içinde çağrılır: setupSocket(io)
 */
export function setupSocket(io) {
  // ─── Redis Pub/Sub — mesaj yayını tüm instance'lara ───────────────────────
  subscribeToEvents(io);

  // ─── JWT Authentication Middleware ────────────────────────────────────────
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('AUTH_REQUIRED'));
      }
      const decoded = verifyAccessToken(token);
      socket.data.user = {
        id: decoded.sub,
        username: decoded.username,
        role: decoded.role,
      };
      next();
    } catch (err) {
      const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
      next(new Error(code));
    }
  });

  // ─── Bağlantı ─────────────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const { username } = socket.data.user;
    console.log(`[Socket] ${username} bağlandı (${socket.id})`);

    setupPresenceHandler(io, socket);
    setupTypingHandler(io, socket);
    setupMessageHandler(io, socket);
    setupCatchupHandler(io, socket);
    setupReadHandler(io, socket);
    setupAnnouncementHandler(io, socket);

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] ${username} ayrıldı: ${reason}`);
    });
  });
}
