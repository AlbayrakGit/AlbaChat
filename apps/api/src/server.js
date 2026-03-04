import 'dotenv/config';
import Fastify from 'fastify';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { knex } from './db/knex.js';
import { redis } from './utils/redis.js';

import corsPlugin from './plugins/cors.js';
import helmetPlugin from './plugins/helmet.js';
import rateLimitPlugin from './plugins/rateLimit.js';
import multipartPlugin from './plugins/multipart.js';
import cookiePlugin from './plugins/cookie.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import groupRoutes from './routes/groups.js';
import messagesRoutes from './routes/messages.js';
import adminUserRoutes from './routes/admin/users.js';
import adminSettingsRoutes from './routes/admin/settings.js';
import adminAuditRoutes from './routes/admin/audit.js';
import adminFilesRoutes from './routes/admin/files.js';
import adminCleanupRoutes from './routes/admin/cleanup.js';
import { adminGroupRoutes } from './routes/admin/groups.js';
import { startCronJobs } from './utils/cronJobs.js';
import fileRoutes from './routes/files.js';
import announcementRoutes from './routes/announcements.js';
import { pushRoutes } from './routes/push.js';
import { setupSocket } from './socket/index.js';
import { ensureBucket } from './utils/minio.js';

const HOST = process.env.API_HOST || '0.0.0.0';
const PORT = parseInt(process.env.API_PORT || '3001', 10);

export const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
        : undefined,
  },
});

// HTTP sunucusunu Fastify'ın kullandığı server'dan al (Socket.IO için)
const httpServer = fastify.server;

// Socket.IO
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : '*',
    credentials: true,
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  },
});

async function build() {
  // Plugins
  await fastify.register(corsPlugin);
  await fastify.register(helmetPlugin);
  await fastify.register(rateLimitPlugin);
  await fastify.register(multipartPlugin);
  await fastify.register(cookiePlugin);

  // Routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(userRoutes, { prefix: '/api/users' });
  await fastify.register(groupRoutes, { prefix: '/api/groups' });
  await fastify.register(messagesRoutes, { prefix: '/api' });
  await fastify.register(adminUserRoutes, { prefix: '/api/admin/users' });
  await fastify.register(adminSettingsRoutes, { prefix: '/api/admin/settings' });
  await fastify.register(adminAuditRoutes, { prefix: '/api/admin/audit-logs' });
  await fastify.register(adminFilesRoutes, { prefix: '/api/admin/files' });
  await fastify.register(adminCleanupRoutes, { prefix: '/api/admin/cleanup-policies' });
  await fastify.register(adminGroupRoutes, { prefix: '/api/admin/groups' });
  await fastify.register(fileRoutes, { prefix: '/api/files' });
  await fastify.register(announcementRoutes, { prefix: '/api/announcements' });
  await fastify.register(pushRoutes, { prefix: '/api/push' });

  // Health check
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Socket.IO setup
  setupSocket(io);
  startCronJobs();

  return fastify;
}

async function start() {
  try {
    // Veritabanı bağlantısını kontrol et
    await knex.raw('SELECT 1');
    fastify.log.info('PostgreSQL bağlantısı kuruldu');

    // Redis bağlantısını kontrol et
    await redis.ping();
    fastify.log.info('Redis bağlantısı kuruldu');

    // MinIO bucket kontrolü
    await ensureBucket();

    await build();
    await fastify.listen({ host: HOST, port: PORT });
    fastify.log.info(`AlbaChat API çalışıyor: http://${HOST}:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

// Graceful shutdown
const shutdown = async () => {
  fastify.log.info('Sunucu kapatılıyor...');
  await fastify.close();
  await knex.destroy();
  redis.disconnect();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
