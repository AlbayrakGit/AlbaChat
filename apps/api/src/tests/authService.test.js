import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthError, hashPassword } from '../services/authService.js';

describe('authService — hashPassword', () => {
  it('şifreyi hash\'ler ve doğrulama başarılı olur', async () => {
    const { default: bcrypt } = await import('bcrypt');
    const password = 'GizliSifre123!';
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash.startsWith('$2b$')).toBe(true);

    const match = await bcrypt.compare(password, hash);
    expect(match).toBe(true);
  });

  it('farklı şifre hash ile eşleşmez', async () => {
    const { default: bcrypt } = await import('bcrypt');
    const hash = await hashPassword('dogru_sifre');
    const match = await bcrypt.compare('yanlis_sifre', hash);
    expect(match).toBe(false);
  });
});

describe('AuthError', () => {
  it('doğru code ve message içerir', () => {
    const err = new AuthError('INVALID_CREDENTIALS', 'Kullanıcı adı veya şifre hatalı.');
    expect(err.code).toBe('INVALID_CREDENTIALS');
    expect(err.message).toBe('Kullanıcı adı veya şifre hatalı.');
    expect(err instanceof Error).toBe(true);
    expect(err instanceof AuthError).toBe(true);
  });
});
