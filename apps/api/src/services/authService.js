import bcrypt from 'bcrypt';
import { knex } from '../db/knex.js';
import { redis, blacklistToken, isTokenBlacklisted } from '../utils/redis.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  getTokenRemainingSeconds,
} from '../utils/jwt.js';

const BCRYPT_ROUNDS = 12;
const REFRESH_COOKIE_NAME = 'kc_refresh';
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: false, // process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60, // 7 gün (saniye)
};

/**
 * Giriş: kullanıcı adı + şifre doğrula, token çifti döner
 */
export async function login(username, password) {
  const user = await knex('users')
    .where({ username })
    .whereNot({ is_active: false })
    .first();

  if (!user) {
    throw new AuthError('INVALID_CREDENTIALS', 'Kullanıcı adı veya şifre hatalı.');
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    throw new AuthError('INVALID_CREDENTIALS', 'Kullanıcı adı veya şifre hatalı.');
  }

  const accessToken = signAccessToken(user);
  const { token: refreshToken, jti } = signRefreshToken(user.id);

  // Refresh token'ı DB'ye kaydet (hash ile)
  const tokenHash = await bcrypt.hash(refreshToken, 10);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await knex('refresh_tokens').insert({
    user_id: user.id,
    token_hash: tokenHash,
    jti,
    expires_at: expiresAt,
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      role: user.role,
      is_online: user.is_online,
      last_seen: user.last_seen,
    },
  };
}

/**
 * Token yenileme: refresh token → yeni access token
 */
export async function refresh(refreshToken) {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new AuthError('INVALID_TOKEN', 'Geçersiz oturum. Lütfen tekrar giriş yapın.');
  }

  // Blacklist kontrolü
  const blacklisted = await isTokenBlacklisted(decoded.jti);
  if (blacklisted) {
    throw new AuthError('TOKEN_REVOKED', 'Oturum iptal edilmiş. Lütfen tekrar giriş yapın.');
  }

  // DB'de aktif token kontrolü
  const storedToken = await knex('refresh_tokens')
    .where({ jti: decoded.jti, user_id: decoded.sub, revoked: false })
    .where('expires_at', '>', new Date())
    .first();

  if (!storedToken) {
    throw new AuthError('INVALID_TOKEN', 'Oturum bulunamadı. Lütfen tekrar giriş yapın.');
  }

  const user = await knex('users')
    .where({ id: decoded.sub, is_active: true })
    .first('id', 'username', 'role');

  if (!user) {
    throw new AuthError('USER_INACTIVE', 'Hesabınız devre dışı bırakılmıştır.');
  }

  const newAccessToken = signAccessToken(user);
  return { accessToken: newAccessToken };
}

/**
 * Çıkış: refresh token'ı iptal et
 */
export async function logout(refreshToken) {
  try {
    const decoded = verifyRefreshToken(refreshToken);

    // DB'de revoke et
    await knex('refresh_tokens').where({ jti: decoded.jti }).update({ revoked: true });

    // Redis blacklist'e ekle (kalan süre kadar)
    const remaining = getTokenRemainingSeconds(decoded);
    if (remaining > 0) {
      await blacklistToken(decoded.jti, remaining);
    }
  } catch {
    // Token zaten geçersizse sessizce devam et
  }
}

/**
 * Şifre hash'i oluştur (kullanıcı oluşturma için)
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Şifre değiştir: mevcut şifreyi doğrula, yeni şifreyi kaydet
 */
export async function changePassword(userId, currentPassword, newPassword) {
  const user = await knex('users').where({ id: userId }).first();
  if (!user) {
    throw new AuthError('USER_NOT_FOUND', 'Kullanıcı bulunamadı.');
  }

  const match = await bcrypt.compare(currentPassword, user.password_hash);
  if (!match) {
    throw new AuthError('INVALID_CREDENTIALS', 'Mevcut şifre hatalı.');
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await knex('users').where({ id: userId }).update({ password_hash: newHash });
}

export { REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTIONS };

// ─── Hata Sınıfı ──────────────────────────────────────────────────────────────
export class AuthError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
