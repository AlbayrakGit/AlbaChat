import { verifyAccessToken } from '../utils/jwt.js';

/**
 * JWT access token doğrulama middleware'i.
 * Authorization: Bearer <token> başlığını kontrol eder.
 * Geçerli ise request'e user bilgisini ekler: req.user = { id, username, role }
 */
export async function authenticate(req, reply) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Kimlik doğrulama gerekli.' },
    });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = verifyAccessToken(token);
    req.user = { id: decoded.sub, username: decoded.username, role: decoded.role };
  } catch (err) {
    const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
    return reply.code(401).send({
      success: false,
      error: { code, message: 'Geçersiz veya süresi dolmuş oturum.' },
    });
  }
}

/**
 * Admin rol kontrolü. authenticate() sonrasında kullanılır.
 */
export async function requireAdmin(req, reply) {
  if (!req.user || req.user.role !== 'admin') {
    return reply.code(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Bu işlem için yönetici yetkisi gerekli.' },
    });
  }
}
