import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_EXPIRES_IN = process.env.REFRESH_EXPIRES_IN || '7d';

if (!JWT_SECRET || !REFRESH_SECRET) {
  throw new Error('JWT_SECRET ve REFRESH_SECRET .env dosyasında tanımlanmalıdır');
}

/**
 * Access token üret (kısa ömürlü: 15 dakika)
 */
export function signAccessToken(payload) {
  return jwt.sign(
    { sub: payload.id, username: payload.username, display_name: payload.display_name, role: payload.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN, issuer: 'AlbaChat' }
  );
}

/**
 * Refresh token üret (uzun ömürlü: 7 gün)
 * jti (JWT ID) ile blacklist kontrolü yapılır
 */
export function signRefreshToken(userId) {
  const jti = uuidv4();
  const token = jwt.sign(
    { sub: userId, jti },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES_IN, issuer: 'AlbaChat' }
  );
  return { token, jti };
}

/**
 * Access token doğrula
 * @throws {jwt.JsonWebTokenError | jwt.TokenExpiredError}
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET, { issuer: 'AlbaChat' });
}

/**
 * Refresh token doğrula
 * @throws {jwt.JsonWebTokenError | jwt.TokenExpiredError}
 */
export function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET, { issuer: 'AlbaChat' });
}

/**
 * Token'ın kalan süresini saniye cinsinden hesapla
 */
export function getTokenRemainingSeconds(decoded) {
  return decoded.exp - Math.floor(Date.now() / 1000);
}
