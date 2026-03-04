import { describe, it, expect } from 'vitest';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getTokenRemainingSeconds,
} from '../utils/jwt.js';

const mockUser = { id: 1, username: 'testuser', role: 'user' };

describe('JWT Yardımcıları', () => {
  describe('signAccessToken / verifyAccessToken', () => {
    it('geçerli access token üretir ve doğrular', () => {
      const token = signAccessToken(mockUser);
      expect(token).toBeTruthy();
      const decoded = verifyAccessToken(token);
      expect(decoded.sub).toBe(mockUser.id);
      expect(decoded.username).toBe(mockUser.username);
      expect(decoded.role).toBe(mockUser.role);
    });

    it('yanlış secret ile doğrulama başarısız olur', () => {
      const token = signAccessToken(mockUser);
      // Token'ı manipüle et
      const tampered = token.slice(0, -5) + 'XXXXX';
      expect(() => verifyAccessToken(tampered)).toThrow();
    });
  });

  describe('signRefreshToken / verifyRefreshToken', () => {
    it('geçerli refresh token üretir ve jti içerir', () => {
      const { token, jti } = signRefreshToken(mockUser.id);
      expect(token).toBeTruthy();
      expect(jti).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      const decoded = verifyRefreshToken(token);
      expect(decoded.sub).toBe(mockUser.id);
      expect(decoded.jti).toBe(jti);
    });
  });

  describe('getTokenRemainingSeconds', () => {
    it('pozitif kalan süre döner', () => {
      const token = signAccessToken(mockUser);
      const decoded = verifyAccessToken(token);
      const remaining = getTokenRemainingSeconds(decoded);
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(900); // 15 dakika
    });
  });
});
