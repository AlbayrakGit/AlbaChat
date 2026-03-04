import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import { redis } from '../utils/redis.js';

export default fp(async function rateLimitPlugin(fastify) {
  await fastify.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    redis,
    keyGenerator: (req) => req.headers['x-forwarded-for'] || req.ip,
    errorResponseBuilder: () => ({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Cok fazla istek gonderildi. Lutfen bekleyin.',
      },
    }),
  });
});
