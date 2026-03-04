import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(REDIS_URL, {
  // Yeniden deneme — lineer backoff, max 10 deneme
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 10) return null;
    return Math.min(times * 200, 3000); // 200ms → 3sn
  },
  lazyConnect: true,

  // Keep-alive — idle bağlantıları canlı tut (intranet için önemli)
  keepAlive: 10000,       // 10sn'de bir TCP keepalive paketi
  connectTimeout: 5000,  // Bağlantı zaman aşımı
  commandTimeout: 3000,  // Komut zaman aşımı

  enableReadyCheck: true,
  db: 0,
});

redis.on('error', (err) => {
  console.error('[Redis] Bağlantı hatası:', err.message);
});

redis.on('connect', () => {
  console.info('[Redis] Bağlantı kuruldu');
});

redis.on('reconnecting', (delay) => {
  console.warn(`[Redis] Yeniden bağlanıyor (${delay}ms)...`);
});

// Refresh token blacklist yardımcıları
export const TOKEN_BLACKLIST_PREFIX = 'blacklist:rt:';
export const ONLINE_STATUS_PREFIX = 'online:';
export const RATE_LIMIT_PREFIX = 'rl:';

export async function blacklistToken(tokenId, expiresInSeconds) {
  await redis.setex(`${TOKEN_BLACKLIST_PREFIX}${tokenId}`, expiresInSeconds, '1');
}

export async function isTokenBlacklisted(tokenId) {
  const result = await redis.exists(`${TOKEN_BLACKLIST_PREFIX}${tokenId}`);
  return result === 1;
}

export async function setUserOnline(userId) {
  await redis.set(`${ONLINE_STATUS_PREFIX}${userId}`, Date.now().toString());
}

export async function setUserOffline(userId) {
  await redis.del(`${ONLINE_STATUS_PREFIX}${userId}`);
}

export async function isUserOnline(userId) {
  return await redis.exists(`${ONLINE_STATUS_PREFIX}${userId}`);
}
